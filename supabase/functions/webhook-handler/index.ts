import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { processarOCRNota, enviarMensagemRejeicaoValor, enviarMensagemApenasPortal } from "./ocr-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API Meta WhatsApp oficial
const META_PHONE_ID = '468233466375447';
const META_TOKEN = 'EAAXSNrvzpbABP6IYXowGhZBzQbatbThlDDsidvOs77h6BAmhaJLZAos2SWzqZARSl57YiBvZCYJFCjJWSDbP5XuZAWT4ORdREQ2yBdaiYyk7si0boZB5LkoDzcCw6ZCiBy6tPMZBlrVtCcLZBQivZBc7xlIrDnQk1v8zgp3vK0coPZAGXAp0DSrEf9fVmjlZCXUk9gZDZD';
const META_API_URL = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`;
const META_MEDIA_URL = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/media`;

async function enviarVideoMeta(numero: string, videoUrl: string, caption: string): Promise<any> {
  try {
    // Baixar o vídeo
    console.log('[Meta API] Baixando vídeo:', videoUrl);
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    
    // Upload para Meta
    const formData = new FormData();
    formData.append('file', videoBlob, 'tutorial-anexar-nota.mp4');
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', 'video/mp4');

    console.log('[Meta API] Fazendo upload do vídeo...');
    const uploadResponse = await fetch(META_MEDIA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_TOKEN}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Erro ao fazer upload do vídeo: ${error}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[Meta API] Vídeo uploaded:', uploadResult);
    
    // Enviar mensagem com vídeo
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: numero,
      type: "video",
      video: {
        id: uploadResult.id,
        caption: caption
      }
    };

    console.log('[Meta API] Enviando mensagem com vídeo...');
    const sendResponse = await fetch(META_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${META_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      throw new Error(`Erro ao enviar vídeo: ${error}`);
    }

    const result = await sendResponse.json();
    console.log('[Meta API] Vídeo enviado com sucesso:', result);
    return result;
  } catch (error) {
    console.error('[Meta API] Erro ao enviar vídeo:', error);
    throw error;
  }
}

// Função para formatar mês de competência
function formatMesCompetencia(mesCompetencia: string): string {
  if (!mesCompetencia || !mesCompetencia.includes('-')) return mesCompetencia;
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  const mesNome = meses[mesIndex] || mes;
  return `${mesNome} - ${ano}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verificação inicial do webhook do WhatsApp
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Verificação do webhook WhatsApp:', { mode, token: token ? 'presente' : 'ausente', challenge: challenge ? 'presente' : 'ausente' });

    if (mode === 'subscribe' && token === (Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'webhook_verify_token')) {
      console.log('Verificação do webhook aprovada');
      return new Response(challenge, {
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        }
      });
    } else {
      console.log('Verificação do webhook rejeitada');
      return new Response('Forbidden', { 
        status: 403,
        headers: corsHeaders 
      });
    }
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const headers: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      headers[key] = value;
    }
    
    const url = new URL(req.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    
    let webhookData;
    let rawBody = '';
    
    try {
      const text = await req.text();
      rawBody = text;
      
      try {
        webhookData = JSON.parse(text);
      } catch {
        webhookData = text;
      }
    } catch {
      webhookData = 'Erro ao ler body';
    }

    console.log('Webhook recebido:', new Date().toISOString());
    console.log('Método:', req.method);
    console.log('📍 URL completa:', req.url);
    console.log('📝 Path:', url.pathname);
    console.log('🔗 Query Params:', JSON.stringify(queryParams, null, 2));
    console.log('📋 Headers:', JSON.stringify(headers, null, 2));
    console.log('📦 Raw Body:', rawBody);
    console.log('🎯 Parsed Body:', JSON.stringify(webhookData, null, 2));
    console.log('📏 Content-Length:', headers['content-length'] || 'não informado');
    console.log('📄 Content-Type:', headers['content-type'] || 'não informado');
    console.log('🔒 User-Agent:', headers['user-agent'] || 'não informado');
    console.log('='.repeat(80));
    
    try {
      await supabase.from('webhook_debug_logs').insert({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: headers,
        query_params: queryParams,
        raw_body: rawBody,
        parsed_body: webhookData,
        user_agent: headers['user-agent'] || null,
        content_type: headers['content-type'] || null
      });
    } catch (dbError) {
      console.log('Erro ao salvar log:', dbError);
    }

    // Verificar se é um clique no botão "Encaminhar Nota"
    if (webhookData.msg && webhookData.msg.type === 'button' && 
        webhookData.msg.button && webhookData.msg.button.payload === 'Encaminhar Nota') {
      
      const from = webhookData.ticket?.contact?.number || webhookData.msg.from;
      console.log('Botão "Encaminhar Nota" clicado por:', from);
      
      try {
        // Enviar mensagem de solicitação com vídeo anexado via Meta API
        const mensagem = "🏥 Portal de Notas Fiscais - HCC Hospital\n\nOlá! Para agilizar seu pagamento, precisamos da sua nota fiscal.\n\n🔗 Acesse o portal: https://hcc.chatconquista.com/dashboard-medicos\n\nPasso a passo:\n1) Digite seu CPF\n2) Localize o pagamento pendente\n3) Clique em \"Anexar Nota Fiscal\"\n4) Faça upload do PDF (máx. 10MB)\n\nDicas:\n• Envie o documento legível e completo\n• Confira os dados antes de enviar\n\n📹 Veja o vídeo tutorial que enviamos mostrando como anexar sua nota passo a passo!\n\nApós o envio, você receberá confirmação e será avisado sobre a análise.";
        
        console.log('Enviando mensagem de solicitação com vídeo via botão (Meta API)');

        const messageResponseData = await enviarVideoMeta(
          from,
          'https://hcc.chatconquista.com/videos/tutorial-anexar-nota.mp4',
          mensagem
        );

        console.log('Resposta da mensagem com vídeo via botão:', messageResponseData);

        // Registrar log da mensagem de solicitação (apenas se houver pagamento associado)
        try {
          const numeroLimpo = String(from || '').replace(/\D/g, '');
          const { data: pagamentosAssoc } = await supabase
            .from('pagamentos')
            .select(`id, status, medicos!inner(numero_whatsapp)`) 
            .in('status', ['pendente','solicitado'])
            .ilike('medicos.numero_whatsapp', `%${numeroLimpo}%`)
            .order('created_at', { ascending: false })
            .limit(1);

          const pagamentoId = pagamentosAssoc?.[0]?.id;
          if (pagamentoId) {
            await supabase
              .from('message_logs')
              .insert([{ 
                pagamento_id: pagamentoId,
                tipo: 'solicitacao_nota',
                payload: { number: from, hasVideo: true },
                success: true,
                response: messageResponseData
              }]);

            // Atualizar status do pagamento para garantir visibilidade no portal do médico
            await supabase
              .from('pagamentos')
              .update({ status: 'solicitado', data_solicitacao: new Date().toISOString() })
              .eq('id', pagamentoId);
          } else {
            console.warn('Sem pagamento associado para log de solicitação; pulando insert.');
          }
        } catch (logError) {
          console.warn('Falha ao registrar log de solicitação:', logError);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Mensagem de solicitação enviada via botão'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        });

      } catch (error) {
        console.error('Erro ao enviar mensagem via botão:', error);
      }
    }

    // Verificar se é uma mensagem com texto "Encaminhar Nota"
    if (webhookData.msg && webhookData.msg.text && 
        webhookData.msg.text.body && 
        webhookData.msg.text.body.toLowerCase().includes('encaminhar nota')) {
      
      const from = webhookData.ticket?.contact?.number || webhookData.msg.from;
      console.log('Mensagem "Encaminhar Nota" recebida de:', from);
      
      try {
        // Buscar médico por número de WhatsApp usando variações
        const numeroLimpo = from.replace(/\D/g, '');
        console.log('Número limpo para busca:', numeroLimpo);
        
        // Gerar todas as variações possíveis do número
        const variants = brPhoneVariants(numeroLimpo);
        console.log('Variações do número geradas:', variants);
        
        const { data: medicos, error: medicoError } = await supabase
          .from('medicos')
          .select('id, nome, numero_whatsapp')
          .in('numero_whatsapp', variants)
          .limit(1);

        if (medicoError || !medicos || medicos.length === 0) {
          console.log('Médico não encontrado para número:', numeroLimpo, 'Variações testadas:', variants);
          return new Response(JSON.stringify({
            success: false,
            message: 'Médico não encontrado'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            },
          });
        }

        const medico = medicos[0];
        
        // Buscar pagamento pendente do médico
        const { data: pagamentos, error: pagamentoError } = await supabase
          .from('pagamentos')
          .select('id, valor, mes_competencia')
          .eq('medico_id', medico.id)
          .in('status', ['pendente', 'solicitado'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (pagamentoError || !pagamentos || pagamentos.length === 0) {
          console.log('Nenhum pagamento pendente encontrado para médico:', medico.id);
          return new Response(JSON.stringify({
            success: false,
            message: 'Nenhum pagamento pendente'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            },
          });
        }

        const pagamento = pagamentos[0];
        console.log('Pagamento encontrado:', pagamento);

        // Enviar mensagem com vídeo anexado via Meta API
        const competenciaFormatada = formatMesCompetencia(pagamento.mes_competencia);
        const mensagem = `🏥 Portal de Notas Fiscais - HCC Hospital\n\nOlá ${medico.nome}! Para darmos sequência ao seu pagamento referente a ${competenciaFormatada}, precisamos da sua nota fiscal.\n\n🔗 Acesse o portal oficial:\nhttps://hcc.chatconquista.com/dashboard-medicos\n\n📝 Passo a passo:\n1) Digite seu CPF\n2) Localize o pagamento pendente\n3) Clique em \"Anexar Nota Fiscal\"\n4) Envie o arquivo PDF (legível, até 10MB)\n\n⚡ Dicas importantes:\n• Envie o documento completo e sem senha\n• Revise os dados antes de enviar\n\n📹 Veja o vídeo tutorial que enviamos mostrando como anexar sua nota passo a passo!\n\n✅ Após o envio: você receberá confirmação e será avisado sobre a análise.`;
        
        console.log('Enviando mensagem com vídeo anexado (Meta API)');

        const linkResponseData = await enviarVideoMeta(
          from,
          'https://hcc.chatconquista.com/videos/tutorial-anexar-nota.mp4',
          mensagem
        );

        console.log('Resposta da mensagem com vídeo:', linkResponseData);

        // Registrar log da mensagem
        try {
          await supabase
            .from('message_logs')
            .insert([{
              pagamento_id: pagamento.id,
              tipo: 'encaminhar_nota_link',
              payload: { number: from, hasVideo: true },
              success: true,
              response: linkResponseData
            }]);
        } catch (logError) {
          console.warn('Erro ao registrar log:', logError);
        }

        // Atualizar status do pagamento para garantir visibilidade no portal do médico
        try {
          await supabase
            .from('pagamentos')
            .update({ status: 'solicitado', data_solicitacao: new Date().toISOString() })
            .eq('id', pagamento.id);
        } catch (updateErr) {
          console.warn('Falha ao atualizar status do pagamento:', updateErr);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Link de encaminhamento enviado'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          },
        });

      } catch (error) {
        console.error('Erro ao enviar link de encaminhamento:', error);
      }
    }

    // Verificar se é uma mensagem com arquivo PDF (formato atualizado)
    if ((webhookData.msg && webhookData.msg.type === 'document') || 
        (webhookData.msg && webhookData.msg.mediaType === 'document')) {
      const { msg, ticket } = webhookData;
      const document = msg.document;
      const from = ticket?.contact?.number || msg.from;
      const wabaMediaId = msg.wabaMediaId || document?.id;
      
      console.log('Detalhes do documento:', { document, wabaMediaId, from });
      
      // Verificar se temos as informações necessárias
      if (!wabaMediaId) {
        console.log('wabaMediaId não encontrado no documento');
        return new Response(JSON.stringify({ status: 'success', message: 'wabaMediaId não encontrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Determinar o nome do arquivo e sanitizar
      let filename = 'documento.pdf';
      if (document?.filename) {
        filename = sanitizeFilename(document.filename);
      } else if (msg.body) {
        // Se não tem document.filename, usar o body da mensagem que pode conter o nome
        filename = sanitizeFilename(msg.body);
      }
      
      console.log('Nome do arquivo sanitizado:', filename);

      if ((document && document.mime_type === 'application/pdf') || 
          (msg.mediaType === 'document' && wabaMediaId)) {
        console.log('PDF recebido de:', from, 'Arquivo:', filename);

        // Buscar pagamento pendente para este número
        const numeroLimpo = from.replace(/\D/g, '');
        console.log('📞 Número limpo extraído:', numeroLimpo);
        
        // Gerar variações do número (com e sem o 9)
        const variants = brPhoneVariants(numeroLimpo);
        console.log('🔄 Variações geradas:', variants);
        
        // Buscar médico usando as variações
        const { data: medico } = await supabase
          .from('medicos')
          .select('id, nome, numero_whatsapp')
          .in('numero_whatsapp', variants)
          .limit(1);
        
        console.log('Médico encontrado:', medico);
        
        let pagamento: any = null;
        
        // Se encontrou o médico, buscar pagamento pendente
        if (medico && medico.length > 0) {
          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('id, valor, status, created_at, medico_id, mes_competencia')
            .in('status', ['pendente','solicitado'])
            .eq('medico_id', medico[0].id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (pagamentos && pagamentos.length > 0) {
            pagamento = pagamentos[0];
            console.log('✅ Pagamento encontrado:', pagamento.id);
          }
        }

        // Fallback final: associar pelo log de solicitação (message_logs)
        if (!pagamento) {
          try {
            const variants = brPhoneVariants(numeroLimpo);
            const { data: logs } = await supabase
              .from('message_logs')
              .select('pagamento_id, payload, created_at')
              .eq('tipo', 'solicitacao_nota')
              .order('created_at', { ascending: false })
              .limit(20);
            const found = (logs || []).find((l: any) => {
              const n = String(l?.payload?.number || '');
              return variants.some(v => n.includes(v));
            });
            const pagamentoId = found?.pagamento_id;
            if (pagamentoId) {
              const { data: pagamentoById } = await supabase
                .from('pagamentos')
                .select('id, valor, status, created_at, medico_id, mes_competencia')
                .eq('id', pagamentoId)
                .maybeSingle();
              if (pagamentoById) pagamento = pagamentoById;
            }
          } catch (assocErr) {
            console.warn('Falha no fallback por logs:', assocErr);
          }
        }

        if (pagamento) {
          // Buscar configurações
          const { data: config, error: configError } = await supabase
            .from('configuracoes')
            .select('ocr_nfse_habilitado, ocr_nfse_api_key, permitir_nota_via_whatsapp, api_url, auth_token')
            .single();

          if (configError || !config) {
            console.error('❌ Erro ao buscar configurações:', configError);
            return new Response(JSON.stringify({ 
              success: false, 
              message: 'Erro ao buscar configurações do sistema' 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const permitirWhatsApp = config.permitir_nota_via_whatsapp === true;
          
          if (!permitirWhatsApp) {
            console.log('Upload via WhatsApp desativado');
            
            const { data: medicoData } = await supabase
              .from('medicos')
              .select('nome')
              .eq('id', pagamento.medico_id)
              .single();
            
            await enviarMensagemApenasPortal(supabase, from, medicoData?.nome || 'Médico');
            
            return new Response(JSON.stringify({ 
              success: true, 
              message: 'Upload via WhatsApp desativado - direcionado ao portal' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
            console.log('Upload via WhatsApp ativado - processando nota');
            
            // Download do arquivo PDF
          try {
            const wabaToken = ticket?.whatsapp?.bmToken;
            
            if (!wabaToken) {
              console.error('❌ Token WABA não encontrado no webhook');
              throw new Error('Token de autenticação WhatsApp não encontrado');
            }
            
            console.log('📥 Fazendo download do PDF - Media ID:', wabaMediaId);
            
            // Primeiro, obter a URL real do arquivo usando o wabaMediaId
            const mediaInfoUrl = `https://graph.facebook.com/v20.0/${wabaMediaId}`;
            console.log('🔍 Buscando informações do arquivo:', mediaInfoUrl);
            
            const mediaInfoResponse = await fetch(mediaInfoUrl, {
              headers: {
                'Authorization': `Bearer ${wabaToken}`,
              }
            });
            
            if (!mediaInfoResponse.ok) {
              const errorText = await mediaInfoResponse.text();
              console.error('❌ Erro ao buscar informações do arquivo:', mediaInfoResponse.status, errorText);
              throw new Error(`Erro ao buscar informações do arquivo: ${mediaInfoResponse.status}`);
            }
            
            const mediaInfo = await mediaInfoResponse.json();
            console.log('✅ Informações do arquivo obtidas:', { 
              id: mediaInfo.id, 
              mime_type: mediaInfo.mime_type,
              file_size: mediaInfo.file_size 
            });
            
            if (!mediaInfo.url) {
              console.error('❌ URL do arquivo não encontrada na resposta da API');
              throw new Error('URL do arquivo não encontrada');
            }
            
            // Agora fazer o download do arquivo usando a URL obtida
            console.log('📥 Baixando arquivo da URL:', mediaInfo.url);
            
            const fileResponse = await fetch(mediaInfo.url, {
              headers: {
                'Authorization': `Bearer ${wabaToken}`,
              }
            });
            
            if (!fileResponse.ok) {
              const errorText = await fileResponse.text();
              console.error('❌ Erro ao baixar arquivo:', fileResponse.status, errorText);
              throw new Error(`Erro ao baixar arquivo: ${fileResponse.status}`);
            }
            
            if (fileResponse.ok) {
              const fileData = await fileResponse.arrayBuffer();
              
              console.log('✅ Arquivo baixado com sucesso, tamanho:', fileData.byteLength, 'bytes');
              
              // Verificar tamanho do arquivo (máx 10MB)
              const maxSize = 10 * 1024 * 1024; // 10MB em bytes
              if (fileData.byteLength > maxSize) {
                const sizeInMB = (fileData.byteLength / 1024 / 1024).toFixed(2);
                console.error(`❌ Arquivo muito grande: ${sizeInMB}MB`);
                
                // Enviar mensagem ao médico informando sobre o tamanho
                const { data: medicoData } = await supabase
                  .from('medicos')
                  .select('nome')
                  .eq('id', pagamento.medico_id)
                  .single();
                
                const form = new FormData();
                form.append('number', from);
                form.append('body', `⚠️ *Arquivo muito grande*\n\nOlá ${medicoData?.nome || 'Médico'}!\n\nO arquivo enviado (${sizeInMB}MB) excede o limite de 10MB.\n\nPor favor, envie um arquivo menor através do portal:\nhttps://hcc.chatconquista.com/dashboard-medicos`);
                form.append('externalKey', `erro_tamanho_${Date.now()}`);
                form.append('isClosed', 'false');
                
                await fetch(config.api_url, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${config.auth_token}` },
                  body: form
                });
                
                throw new Error(`Arquivo muito grande: ${sizeInMB}MB. Máximo permitido: 10MB`);
              }
              
              // Nome do arquivo já está sanitizado
              const uniqueName = `${pagamento.id}_${wabaMediaId}_${Date.now()}_${filename}`;
              const filePath = `${pagamento.id}/${uniqueName}`;
              
              console.log('📤 Preparando upload para storage:', { 
                filePath, 
                size: `${(fileData.byteLength / 1024).toFixed(2)}KB`,
                pagamentoId: pagamento.id 
              });
              
              // Fazer upload para o Supabase Storage
              console.log('📤 Fazendo upload para storage bucket "notas"...');
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('notas')
                .upload(filePath, fileData, {
                  contentType: 'application/pdf',
                  cacheControl: '3600',
                  upsert: false // Não sobrescrever se existir
                });

              if (uploadError) {
                console.error('❌ Erro no upload para storage:', uploadError);
                
                // Se erro de duplicação, tentar com timestamp adicional
                if (uploadError.message?.includes('already exists')) {
                  const retryPath = `${pagamento.id}/${Date.now()}_${filename}`;
                  console.log('🔄 Tentando upload novamente com caminho:', retryPath);
                  
                  const { error: retryError } = await supabase.storage
                    .from('notas')
                    .upload(retryPath, fileData, {
                      contentType: 'application/pdf',
                      cacheControl: '3600'
                    });
                  
                  if (retryError) {
                    throw new Error(`Erro ao fazer upload do PDF: ${retryError.message}`);
                  }
                } else {
                  throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
                }
              }

              console.log('✅ Arquivo enviado para storage:', uploadData);

              // Processar OCR se habilitado
              let numeroNota: string | null = null;
              let valorBruto: number | null = null;
              let valorLiquido: number | null = null;
              let ocrProcessado = false;
              
              // Verificar cache OCR: se já temos nota processada para este pagamento, reutilizar
              const { data: notaExistenteCache } = await supabase
                .from('notas_medicos')
                .select('id, ocr_processado, numero_nota, valor_liquido')
                .eq('pagamento_id', pagamento.id)
                .eq('ocr_processado', true)
                .single();
              
              if (notaExistenteCache?.ocr_processado) {
              console.log('Cache OCR encontrado, reutilizando dados anteriores');
              numeroNota = notaExistenteCache.numero_nota;
              valorLiquido = notaExistenteCache.valor_liquido;
              ocrProcessado = true;
            } else if (config?.ocr_nfse_api_key) {
              console.log('Iniciando processamento OCR da nota');
              
              try {
                const ocrResult = await processarOCRNota(fileData, config.ocr_nfse_api_key, supabase);
                
                if (ocrResult.success) {
                  numeroNota = ocrResult.numeroNota ?? null;
                  valorBruto = (typeof ocrResult.valorBruto === 'number') ? ocrResult.valorBruto : null;
                  valorLiquido = (typeof ocrResult.valorLiquido === 'number') ? ocrResult.valorLiquido : null;
                  ocrProcessado = true;
                  
                  console.log('Resultado OCR:', {
                    numeroNota: numeroNota || 'não identificado',
                    valorBruto: valorBruto ?? 'não identificado',
                    valorLiquido: valorLiquido ?? 'não calculado'
                  });
                  
                  if (typeof valorBruto === 'number') {
                    const valorEsperado = parseFloat(pagamento.valor);
                    const diferenca = Math.abs(valorEsperado - valorBruto);
                    
                    console.log('Validação de valor:', {
                      esperado: valorEsperado,
                      recebido: valorBruto,
                      diferenca: diferenca,
                      tolerancia: 0.01
                    });
                    
                    if (diferenca > 0.01) {
                      console.log('Valor incorreto, rejeitando nota');
                        
                        const { data: medicoData } = await supabase
                          .from('medicos')
                          .select('nome')
                          .eq('id', pagamento.medico_id)
                          .single();

                        try {
                          await supabase.storage.from('notas').remove([filePath]);
                          console.log('PDF rejeitado removido');
                        } catch (removeErr) {
                          console.warn('Erro ao remover PDF:', removeErr);
                        }
                        
                        await enviarMensagemRejeicaoValor(
                          supabase, from, medicoData?.nome || 'Médico',
                          valorEsperado, valorBruto, 
                          formatMesCompetencia(pagamento.mes_competencia)
                        );
                        
                        return new Response(JSON.stringify({ 
                          success: false, 
                          message: 'Nota rejeitada - valor incorreto',
                          details: {
                            valorEsperado,
                            valorRecebido: valorBruto,
                            diferenca
                          }
                        }), {
                          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                      } else {
                      console.log('Valor validado com sucesso');
                    }
                  } else {
                    console.warn('Valor bruto não identificado - prosseguindo sem validação');
                  }
                } else {
                  console.warn('OCR não retornou sucesso:', ocrResult.erro || 'erro desconhecido');
                }
              } catch (ocrError: any) {
                console.error('Erro no processamento OCR:', ocrError.message || ocrError);
              }
            } else {
              console.log('OCR desativado - API key não configurada');
            }

              const updateData: any = {
                status: 'nota_recebida',
                data_resposta: new Date().toISOString(),
                nota_pdf_url: `notas/${filePath}`,
              };

              if (ocrProcessado && valorLiquido !== null && valorLiquido !== undefined) {
                updateData.valor_liquido = valorLiquido;
                console.log('Atualizando valor líquido:', valorLiquido);
              }

              const { error: updateError } = await supabase
                .from('pagamentos')
                .update(updateData)
                .eq('id', pagamento.id);

              if (updateError) {
                console.error('Erro ao atualizar pagamento:', updateError);
                throw updateError;
              }

              console.log('Inserindo nota:', { numeroNota, valorBruto, valorLiquido, ocrProcessado });
              
              const notaInsertData: any = {
                medico_id: pagamento.medico_id,
                pagamento_id: pagamento.id,
                arquivo_url: filePath,
                nome_arquivo: filename,
                status: 'pendente',
                numero_nota: numeroNota || null,
                valor_bruto: valorBruto || null,
                ocr_processado: ocrProcessado,
                ocr_resultado: ocrProcessado ? { numeroNota, valorBruto, valorLiquido } : null
              };

              // Incluir valor_liquido se foi processado pelo OCR
              if (ocrProcessado && valorLiquido !== null && valorLiquido !== undefined) {
                notaInsertData.valor_liquido = valorLiquido;
              }

              const { data: insertData, error: insertError } = await supabase
                .from('notas_medicos')
                .insert([notaInsertData])
                .select('*, pagamentos!inner(mes_competencia)')
                .single();

              if (insertError) {
                console.error('Erro ao inserir nota:', insertError);
                throw insertError;
              }

              console.log('Nota inserida com sucesso:', insertData);

              // Buscar dados do médico para enviar notificação
              const { data: medicoData } = await supabase
                .from('medicos')
                .select('nome, numero_whatsapp, especialidade')
                .eq('id', pagamento.medico_id)
                .single();

              // Enviar notificação via WhatsApp Template
              if (medicoData) {
                try {
                  await supabase.functions.invoke('send-whatsapp-template', {
                    body: {
                      type: 'nota_recebida',
                      medico: {
                        nome: medicoData.nome,
                        numero_whatsapp: medicoData.numero_whatsapp
                      },
                      medico_id: pagamento.medico_id,
                      competencia: insertData.pagamentos.mes_competencia,
                      pagamentoId: pagamento.id
                    }
                  });
                  console.log('Notificação de nota recebida enviada via WhatsApp');
                } catch (whatsappError) {
                  console.warn('Erro ao enviar notificação via WhatsApp:', whatsappError);
                }
              }

              // Enviar PDF com botões de aprovação/rejeição para TODOS os gestores
              try {
                // Buscar TODOS os gestores ativos com WhatsApp válido (não nulo e não vazio)
                const { data: gestores } = await supabase
                  .from('profiles')
                  .select('numero_whatsapp, name')
                  .eq('role', 'gestor')
                  .eq('whatsapp_notifications_enabled', true)
                  .not('numero_whatsapp', 'is', null)
                  .neq('numero_whatsapp', '');

                if (gestores && gestores.length > 0 && medicoData) {
                  console.log(`Preparando envio de PDF para ${gestores.length} gestores...`);
                  
                  // Baixar o PDF do storage
                  const { data: pdfData, error: downloadError } = await supabase.storage
                    .from('notas')
                    .download(filePath);

                  if (downloadError) {
                    console.error('Erro ao baixar PDF:', downloadError);
                    throw downloadError;
                  }

                  console.log('PDF baixado, tamanho:', pdfData.size);

                  // Converter para base64
                  const arrayBuffer = await pdfData.arrayBuffer();
                  const base64 = btoa(
                    new Uint8Array(arrayBuffer)
                      .reduce((data, byte) => data + String.fromCharCode(byte), '')
                  );

                  console.log('PDF convertido para base64, tamanho:', base64.length);

                  // Criar tokens no formato correto (mesmo formato das páginas de aprovação/rejeição)
                  const tokenAprovar = btoa(`${insertData.id}-${insertData.created_at}-approve`).substring(0, 20);
                  const tokenRejeitar = btoa(`${insertData.id}-${insertData.created_at}-reject`).substring(0, 20);
                  const linkAprovar = `https://hcc.chatconquista.com/aprovar?i=${insertData.id}&t=${tokenAprovar}`;
                  const linkRejeitar = `https://hcc.chatconquista.com/rejeitar?i=${insertData.id}&t=${tokenRejeitar}`;

                  console.log('Links gerados:', { linkAprovar, linkRejeitar });

                  // Enviar para cada gestor
                  for (const gestor of gestores) {
                    try {
                      console.log(`Enviando notificação para gestor: ${gestor.name} (${gestor.numero_whatsapp})`);
                      
                      await supabase.functions.invoke('send-notification-gestores', {
                        body: {
                          phoneNumber: gestor.numero_whatsapp,
                          message: `🔔 *NOVA NOTA FISCAL*\n\n👨‍⚕️ *Médico:* ${medicoData.nome}\n💰 *Valor:* R$ ${pagamento.valor.toFixed(2)}\n📅 *Competência:* ${formatMesCompetencia(pagamento.mes_competencia)}\n${numeroNota ? `📋 *Número NF:* ${numeroNota}\n` : ''}${valorBruto ? `💵 *Valor Bruto:* R$ ${valorBruto.toFixed(2)}\n` : ''}${valorLiquido ? `💸 *Valor Líquido:* R$ ${valorLiquido.toFixed(2)}\n` : ''}\n\n✅ *Aprovar:* ${linkAprovar}\n\n❌ *Rejeitar:* ${linkRejeitar}`,
                          pdf_base64: base64,
                          pdf_filename: filename
                        }
                      });
                      
                      console.log(`Notificação enviada com sucesso para ${gestor.name}`);
                    } catch (gestorError) {
                      console.error(`Erro ao enviar para gestor ${gestor.name}:`, gestorError);
                    }
                  }
                  
                  console.log('Notificações de aprovação enviadas a todos os gestores com PDF');
                } else {
                  console.warn('Nenhum gestor ativo com WhatsApp encontrado');
                }
              } catch (financeiroError) {
                console.warn('Erro ao enviar notificação aos gestores:', financeiroError);
              }

              console.log('Pagamento atualizado com sucesso');

              // Enviar notificação por email com PDF anexado e botões de ação
              try {
                // Criar tokens e URLs para email
                const tokenEmail = btoa(`${insertData.id}-${insertData.created_at}-approve`).substring(0, 20);
                const approvalUrl = `https://hcc.chatconquista.com/aprovar?i=${insertData.id}&t=${tokenEmail}`;
                const tokenReject = btoa(`${insertData.id}-${insertData.created_at}-reject`).substring(0, 20);
                const rejectionUrl = `https://hcc.chatconquista.com/rejeitar?i=${insertData.id}&t=${tokenReject}`;
                
                // Criar URL assinada do PDF
                const { data: signedUrl } = await supabase.storage
                  .from('notas')
                  .createSignedUrl(filePath, 7 * 24 * 60 * 60); // 7 dias

                await supabase.functions.invoke('send-email-notification', {
                  body: {
                    type: 'nova_nota',
                    pagamentoId: pagamento.id,
                    notaId: insertData.id,
                    fileName: filename,
                    valorLiquido: valorLiquido,
                    pdfPath: filePath,
                    pdfSignedUrl: signedUrl?.signedUrl,
                    approvalUrl: approvalUrl,
                    rejectionUrl: rejectionUrl,
                    medicoNome: medicoData?.nome,
                    medicoEspecialidade: medicoData?.especialidade || '',
                    mes_competencia: pagamento.mes_competencia,
                    valor: pagamento.valor
                  }
                });
                console.log('Email de notificação enviado com PDF anexado e botões de ação');
              } catch (emailError) {
                console.warn('Erro ao enviar notificação por email:', emailError);
              }

              // Enviar WhatsApp para gestores com PDF anexado
              try {
                // Buscar médico com especialidade
                const { data: medicoCompleto } = await supabase
                  .from('medicos')
                  .select('nome, especialidade')
                  .eq('id', pagamento.medico_id)
                  .single();
                
                const medicoInfo = medicoCompleto || medicoData;
                
                if (medicoInfo) {
                  const { data: gestores } = await supabase
                    .from('profiles')
                    .select('numero_whatsapp, name')
                    .eq('role', 'gestor')
                    .not('numero_whatsapp', 'is', null);

                  if (gestores && gestores.length > 0) {
                    console.log(`Enviando WhatsApp para ${gestores.length} gestor(es) com PDF`);

                    const mesFormatado = formatMesCompetencia(pagamento.mes_competencia);
                    const valorFormatado = new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL' 
                    }).format(pagamento.valor);

                    // Criar tokens únicos para aprovar e rejeitar
                    const tokenAprovar = btoa(`${insertData.id}-${insertData.created_at}-approve`).substring(0, 20);
                    const tokenRejeitar = btoa(`${insertData.id}-${insertData.created_at}-reject`).substring(0, 20);
                    const linkAprovar = `https://hcc.chatconquista.com/aprovar?i=${insertData.id}&t=${tokenAprovar}`;
                    const linkRejeitar = `https://hcc.chatconquista.com/rejeitar?i=${insertData.id}&t=${tokenRejeitar}`;

                    // Baixar o PDF para enviar aos gestores
                    const { data: pdfDataGestor, error: pdfError } = await supabase.storage
                      .from('notas')
                      .download(filePath);

                    if (pdfError) {
                      console.error('Erro ao baixar PDF para gestores:', pdfError);
                      throw pdfError;
                    }

                    let pdfBase64 = '';
                    if (pdfDataGestor) {
                      const arrayBuffer = await pdfDataGestor.arrayBuffer();
                      pdfBase64 = btoa(
                        new Uint8Array(arrayBuffer)
                          .reduce((data, byte) => data + String.fromCharCode(byte), '')
                      );
                      console.log(`PDF convertido para base64: ${pdfBase64.length} chars`);
                    }

                    // Preparar informações da nota
                    const especialidadeInfo = medicoInfo.especialidade ? `\n🩺 *Especialidade:* ${medicoInfo.especialidade}` : '';
                    
                    // Formatação do valor líquido
                    let valorLiquidoInfo = '';
                    if (valorLiquido) {
                      const valorLiquidoFormatado = new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      }).format(valorLiquido);
                      valorLiquidoInfo = `\n💵 *Valor Líquido:* ${valorLiquidoFormatado}`;
                    }

                    // Informação do número da nota
                    const numeroNotaInfo = numeroNota ? `\n🔢 *Número da Nota:* ${numeroNota}` : '';

                    const mensagem = `🏥 *Nova Nota Fiscal Recebida - HCC Hospital*\n\n` +
                      `📋 *Médico:* ${medicoInfo.nome}${especialidadeInfo}\n` +
                      `📅 *Competência:* ${mesFormatado}\n` +
                      `💰 *Valor Bruto:* ${valorFormatado}${valorLiquidoInfo}${numeroNotaInfo}\n` +
                      `📄 *Arquivo:* ${filename}\n\n` +
                      `⚠️ *Aguardando aprovação*\n\n` +
                      `✅ *Aprovar:*\n${linkAprovar}\n\n` +
                      `❌ *Rejeitar:*\n${linkRejeitar}`;

                     for (const gestor of gestores) {
                      try {
                        console.log(`Enviando para gestor ${gestor.name} (${gestor.numero_whatsapp})`);
                        await supabase.functions.invoke('send-notification-gestores', {
                          body: {
                            phoneNumber: gestor.numero_whatsapp,
                            message: mensagem,
                            pdf_base64: pdfBase64,
                            pdf_filename: filename
                          }
                        });
                        console.log(`✅ WhatsApp com PDF enviado para gestor ${gestor.name}`);
                      } catch (gestorError) {
                        console.warn(`❌ Erro ao enviar WhatsApp para gestor ${gestor.name}:`, gestorError);
                      }
                    }
                  }
                }
              } catch (whatsappError) {
                console.warn('Erro ao enviar notificações WhatsApp para gestores:', whatsappError);
              }

              return new Response(JSON.stringify({
                success: true,
                message: 'Nota fiscal processada com sucesso',
                pagamentoId: pagamento.id
              }), {
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders 
                },
              });

            } else {
              console.error('Erro no download do arquivo:', fileResponse.status);
            }
          } catch (downloadError) {
            console.error('Erro ao fazer download do PDF:', downloadError);
          }
        } else {
          console.log('Nenhum pagamento pendente encontrado para:', from);
        }
      }
    }

    // Resposta padrão para outros tipos de webhook
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook recebido',
      processed: false
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});

// Função auxiliar para normalizar e gerar variações de números BR (com/sem o 9)
function brPhoneVariants(num: string): string[] {
  const digits = (num || '').replace(/\D/g, '');
  const set = new Set<string>();
  if (!digits) return [];
  set.add(digits);
  // Inserir 9 após DDI+DDD (ex: 55 77 -> índice 4)
  if (digits.startsWith('55')) {
    if (digits.length === 12) { // provavelmente sem o 9
      set.add(digits.slice(0, 4) + '9' + digits.slice(4));
    }
    if (digits.length === 13 && digits[4] === '9') { // com 9, gerar sem 9
      set.add(digits.slice(0, 4) + digits.slice(5));
    }
  }
  return Array.from(set);
}

// Função para sanitizar nome de arquivo
function sanitizeFilename(filename: string): string {
  // Remove caracteres especiais, espaços e acentos
  let sanitized = filename
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais por _
    .replace(/\.pdf(\.pdf)+$/gi, '.pdf') // Remove múltiplos .pdf
    .replace(/_{2,}/g, '_') // Substitui múltiplos _ por um único
    .toLowerCase();
  
  // Garante que termina com .pdf
  if (!sanitized.endsWith('.pdf')) {
    sanitized = sanitized.replace(/\.[^.]*$/, '') + '.pdf';
  }
  
  // Limita o tamanho do nome
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    const extension = '.pdf';
    sanitized = sanitized.substring(0, maxLength - extension.length) + extension;
  }
  
  return sanitized;
}

// Funções auxiliares para extração de texto (placeholder)
async function extractTextFromPDF(fileData: ArrayBuffer): Promise<string> {
  // Implementar extração de texto real usando uma biblioteca como pdf-parse
  return '';
}

function extractLiquidValue(text: string): number | null {
  // Implementar regex para extrair valor líquido do texto
  const matches = text.match(/valor\s*l[ií]quido[\s:]*r?\$?\s*(\d+[.,]?\d*)/i);
  return matches ? parseFloat(matches[1].replace(',', '.')) : null;
}