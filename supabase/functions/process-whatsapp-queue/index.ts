// EDGE FUNCTION DESATIVADA - Não usar mais fila de WhatsApp
// As mensagens agora são enviadas diretamente pela function send-whatsapp-template

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Iniciando processamento da fila de WhatsApp');

    // Verificar rate limit
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_whatsapp_rate_limit');

    if (rateLimitError) {
      console.error('Erro ao verificar rate limit:', rateLimitError);
      throw rateLimitError;
    }

    if (!rateLimitOk) {
      console.log('Rate limit atingido, aguardando próxima janela');
      return new Response(
        JSON.stringify({ message: 'Rate limit atingido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Buscar mensagens pendentes (lote de 50)
    const { data: mensagens, error: fetchError } = await supabase
      .from('whatsapp_queue')
      .select('*')
      .eq('status', 'pendente')
      .lte('proximo_envio', new Date().toISOString())
      .order('prioridade', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Erro ao buscar mensagens:', fetchError);
      throw fetchError;
    }

    if (!mensagens || mensagens.length === 0) {
      console.log('Nenhuma mensagem pendente');
      return new Response(
        JSON.stringify({ message: 'Nenhuma mensagem pendente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${mensagens.length} mensagens`);

    const resultados = {
      enviados: 0,
      falhas: 0,
      erros: [] as any[]
    };

    // Processar cada mensagem
    for (const mensagem of mensagens) {
      try {
        // Marcar como processando
        await supabase
          .from('whatsapp_queue')
          .update({ status: 'processando' })
          .eq('id', mensagem.id);

        // Buscar configurações da API
        const { data: config } = await supabase
          .from('configuracoes')
          .select('api_url, auth_token')
          .single();

        if (!config) {
          throw new Error('Configurações não encontradas');
        }

        // Enviar mensagem
        const apiUrl = mensagem.tipo_mensagem === 'template'
          ? `${config.api_url}/template`
          : mensagem.tipo_mensagem === 'file'
          ? `${config.api_url}/file`
          : config.api_url;

        // Normalizar payload para envio de arquivo conforme Postman
        let outgoingPayload: any = mensagem.payload;
        if (mensagem.tipo_mensagem === 'file') {
          const md = mensagem.payload?.mediaData || {};
          const file = mensagem.payload?.file || {};
          const caption = mensagem.payload?.body || md.caption || '';
          const fileName = file.fileName || file.filename || md.fileName || 'documento.pdf';
          const mediaBase64 = md.mediaBase64 || file.data || mensagem.payload?.mediaBase64;
          const url = md.url || file.url || mensagem.payload?.url;

          outgoingPayload = {
            number: mensagem.payload?.number || mensagem.numero_destino,
            body: caption,
            // Compatibilidade 1: mediaData
            mediaData: {
              ...(url ? { url } : {}),
              ...(mediaBase64 ? { mediaBase64 } : {}),
              caption,
              fileName
            },
            // Compatibilidade 2: file
            file: {
              ...(mediaBase64 ? { data: mediaBase64 } : {}),
              ...(url ? { url } : {}),
              fileName,
              filename: fileName
            }
          };
        }

        console.log(`Enviando mensagem para ${mensagem.numero_destino} (tipo: ${mensagem.tipo_mensagem})`);
        console.log(`URL da API: ${apiUrl}`);
        console.log(`Outgoing Payload:`, JSON.stringify({
          ...outgoingPayload,
          mediaData: outgoingPayload.mediaData ? { ...outgoingPayload.mediaData, mediaBase64: outgoingPayload.mediaData.mediaBase64 ? '...base64...' : undefined } : undefined,
          file: outgoingPayload.file ? { ...outgoingPayload.file, data: outgoingPayload.file.data ? '...base64...' : undefined } : undefined
        }, null, 2));

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
          },
          body: JSON.stringify(outgoingPayload)
        });

        const responseData = await response.json();

        if (response.ok) {
          // Sucesso
          await supabase
            .from('whatsapp_queue')
            .update({
              status: 'enviado',
              enviado_em: new Date().toISOString()
            })
            .eq('id', mensagem.id);

          // Incrementar rate limit
          await supabase.rpc('increment_whatsapp_rate_limit');

          resultados.enviados++;
          console.log(`✅ Mensagem ${mensagem.id} enviada com sucesso`);
        } else {
          throw new Error(JSON.stringify(responseData));
        }

      } catch (error: any) {
        console.error(`❌ Erro ao processar mensagem ${mensagem.id}:`, error);

        const novasTentativas = mensagem.tentativas + 1;
        const falhou = novasTentativas >= mensagem.max_tentativas;

        // Calcular próximo envio com backoff exponencial (2^tentativas minutos)
        const proximoEnvio = new Date();
        proximoEnvio.setMinutes(proximoEnvio.getMinutes() + Math.pow(2, novasTentativas));

        await supabase
          .from('whatsapp_queue')
          .update({
            status: falhou ? 'falhou' : 'pendente',
            tentativas: novasTentativas,
            proximo_envio: falhou ? null : proximoEnvio.toISOString(),
            erro_mensagem: error.message
          })
          .eq('id', mensagem.id);

        resultados.falhas++;
        resultados.erros.push({
          id: mensagem.id,
          numero: mensagem.numero_destino,
          erro: error.message
        });
      }
    }

    console.log('Processamento concluído:', resultados);

    return new Response(
      JSON.stringify(resultados),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro no processador de fila:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
