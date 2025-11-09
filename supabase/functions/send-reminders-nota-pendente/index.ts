import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Pagamento {
  id: string;
  medico_id: string;
  mes_competencia: string;
  valor: number;
  data_solicitacao: string;
  medicos: Array<{
    nome: string;
    numero_whatsapp: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Iniciando processamento de lembretes de notas pendentes');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar pagamentos solicitados sem nota recebida
    const { data: pagamentosPendentes, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select(`
        id,
        medico_id,
        mes_competencia,
        valor,
        data_solicitacao,
        medicos (
          id,
          nome,
          numero_whatsapp,
          numero_whatsapp_contador,
          ativo
        )
      `)
      .eq('status', 'solicitado')
      .not('data_solicitacao', 'is', null)
      .order('data_solicitacao', { ascending: true });

    if (pagamentosError) {
      console.error('Erro ao buscar pagamentos pendentes:', pagamentosError);
      throw pagamentosError;
    }

    if (!pagamentosPendentes || pagamentosPendentes.length === 0) {
      console.log('✅ Nenhum pagamento pendente encontrado');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum pagamento pendente' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar quais pagamentos JÁ TÊM NOTA enviada (mesmo que pendente)
    const pagamentoIds = pagamentosPendentes.map((p: any) => p.id);
    const { data: notasExistentes } = await supabase
      .from('notas_medicos')
      .select('pagamento_id, status')
      .in('pagamento_id', pagamentoIds)
      .in('status', ['pendente', 'aprovado']);

    // Criar Set de IDs que já têm nota para filtrar
    const pagamentosComNota = new Set(
      (notasExistentes || []).map((n: any) => n.pagamento_id)
    );

    // Filtrar apenas pagamentos SEM NOTA ENVIADA e com médico ativo
    const pagamentosSemNota = (pagamentosPendentes as any[]).filter(
      (p: any) => !pagamentosComNota.has(p.id) && p.medicos?.ativo === true
    );

    console.log(`📊 ${pagamentosSemNota.length} pagamentos sem nota de ${pagamentosPendentes.length} solicitados`);

    // Log de debug para entender a estrutura dos dados
    if (pagamentosSemNota.length > 0) {
      console.log('🔍 Estrutura do primeiro pagamento:', JSON.stringify(pagamentosSemNota[0], null, 2));
    }

    if (pagamentosSemNota.length === 0) {
      console.log('✅ Todos os pagamentos solicitados já têm nota enviada');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Todos os pagamentos já têm nota enviada' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agora = new Date();
    const lembretesEnviados: string[] = [];
    const erros: string[] = [];

    for (const pagamento of pagamentosSemNota) {
      try {
        const medico = pagamento.medicos;
        if (!medico || !medico.nome || !medico.numero_whatsapp) {
          console.log(`⏭️ Pulando pagamento ${pagamento.id} - médico não encontrado ou incompleto`);
          continue;
        }

        const dataSolicitacao = new Date(pagamento.data_solicitacao);
        const horasDesdesolicitacao = (agora.getTime() - dataSolicitacao.getTime()) / (1000 * 60 * 60);
        
        // Verificar se deve enviar lembrete
        let deveEnviar = false;
        let tipoLembrete = '';

        if (horasDesdesolicitacao >= 24 && horasDesdesolicitacao < 48) {
          // 24h após primeira solicitação
          // Verificar se já enviou lembrete nesse período
          const { data: disparosRecentes } = await supabase
            .from('disparos_notas')
            .select('created_at')
            .eq('pagamento_id', pagamento.id)
            .eq('tipo', 'nota_pendente')
            .gte('created_at', new Date(agora.getTime() - 25 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!disparosRecentes) {
            deveEnviar = true;
            tipoLembrete = 'primeiro_lembrete_24h';
          }
        } else if (horasDesdesolicitacao >= 48) {
          // A cada 2 dias após as primeiras 24h
          const { data: ultimoDisparo } = await supabase
            .from('disparos_notas')
            .select('created_at')
            .eq('pagamento_id', pagamento.id)
            .eq('tipo', 'nota_pendente')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ultimoDisparo) {
            const ultimoEnvio = new Date(ultimoDisparo.created_at);
            const horasDesdeUltimoEnvio = (agora.getTime() - ultimoEnvio.getTime()) / (1000 * 60 * 60);
            
            // Enviar se passaram mais de 48h desde o último envio
            if (horasDesdeUltimoEnvio >= 48) {
              deveEnviar = true;
              tipoLembrete = 'lembrete_periodico_48h';
            }
          } else {
            // Nunca enviou lembrete, deve enviar
            deveEnviar = true;
            tipoLembrete = 'primeiro_lembrete_atrasado';
          }
        }

        if (deveEnviar) {
          console.log(`📤 Enviando lembrete para ${medico.nome} - ${tipoLembrete}`);

          // Formatar mês de competência
          const [ano, mes] = pagamento.mes_competencia.split('-');
          const meses = [
            'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
          ];
          const competenciaFormatada = `${meses[parseInt(mes) - 1]} - ${ano}`;

          // Enviar mensagem WhatsApp usando template nota_pendente
          const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp-template', {
            body: {
              type: 'nota_pendente',
              medico: {
                nome: medico.nome,
                numero_whatsapp: medico.numero_whatsapp
              },
              medico_id: pagamento.medico_id,
              competencia: competenciaFormatada,
              valor: pagamento.valor,
              pagamentoId: pagamento.id
            }
          });

          if (whatsappError) {
            console.error(`❌ Erro ao enviar WhatsApp para ${medico.nome}:`, whatsappError);
            erros.push(`${medico.nome}: ${whatsappError.message}`);
          } else {
            console.log(`✅ Lembrete enviado para ${medico.nome}`);
            
            // Registrar disparo
            await supabase
              .from('disparos_notas')
              .insert({
                pagamento_id: pagamento.id,
                tipo: 'nota_pendente',
                numero: medico.numero_whatsapp
              });

            lembretesEnviados.push(`${medico.nome} (${tipoLembrete})`);
          }
        } else {
          console.log(`⏭️ Pulando ${medico.nome} - ainda não é hora de enviar lembrete`);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar pagamento ${pagamento.id}:`, error);
        erros.push(`Pagamento ${pagamento.id}: ${error.message}`);
      }
    }

    const resultado = {
      success: true,
      lembretesEnviados: lembretesEnviados.length,
      detalhes: lembretesEnviados,
      erros: erros.length > 0 ? erros : undefined
    };

    console.log('📊 Resultado final:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
