import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para formatar mês de competência (YYYY-MM) para português
function formatMesCompetencia(mesCompetencia: string): string {
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  return `${meses[mesIndex]}/${ano}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Iniciando envio FORÇADO de relatórios diários');

    // Buscar configurações
    const { data: config } = await supabase
      .from('configuracoes')
      .select('*')
      .single();

    if (!config) {
      throw new Error('Configurações não encontradas');
    }

    // Buscar todos os gestores com WhatsApp
    const { data: gestores } = await supabase
      .from('profiles')
      .select('id, name, email, numero_whatsapp, whatsapp_notifications_enabled, empresa_id')
      .eq('role', 'gestor')
      .eq('whatsapp_notifications_enabled', true)
      .not('numero_whatsapp', 'is', null);

    if (!gestores || gestores.length === 0) {
      console.log('⚠️ Nenhum gestor com WhatsApp habilitado');
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhum gestor encontrado' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`📋 Encontrados ${gestores.length} gestores`);

    let enviosRealizados = 0;
    let erros = 0;
    let pularPorJaEnviado = 0;

    for (const gestor of gestores) {
      try {
        // Verificar se já enviou relatório hoje
        const hoje = new Date().toISOString().split('T')[0];
        const { data: ultimoEnvio } = await supabase
          .from('whatsapp_queue')
          .select('created_at')
          .eq('destinatario', gestor.numero_whatsapp)
          .ilike('mensagem', '%RELATÓRIO GERENCIAL DIÁRIO%')
          .gte('created_at', `${hoje}T00:00:00`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (ultimoEnvio) {
          console.log(`⏭️ Relatório já enviado hoje para ${gestor.name}`);
          pularPorJaEnviado++;
          continue;
        }
        // Buscar todas as estatísticas necessárias
        const { data: todosPagamentos } = await supabase
          .from('pagamentos')
          .select('id, mes_competencia, valor, status, medico_id, created_at, data_solicitacao, data_resposta, medicos!inner(nome)')
          .eq('empresa_id', gestor.empresa_id)
          .order('created_at', { ascending: false });

        const { data: notasPendentes } = await supabase
          .from('notas_medicos')
          .select('id, medico_id, created_at, pagamentos(valor, mes_competencia, medicos(nome, empresa_id))')
          .eq('status', 'pendente')
          .eq('pagamentos.medicos.empresa_id', gestor.empresa_id);

        const { data: notasAprovadas } = await supabase
          .from('notas_medicos')
          .select('id, created_at, pagamentos(valor)')
          .eq('status', 'aprovado')
          .eq('pagamentos.empresa_id', gestor.empresa_id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        // Calcular KPIs
        const pagamentosPendentes = todosPagamentos?.filter(p => ['pendente', 'solicitado'].includes(p.status)) || [];
        const pagamentosAprovados = todosPagamentos?.filter(p => p.status === 'aprovado') || [];
        const pagamentosPagos = todosPagamentos?.filter(p => p.status === 'pago') || [];
        
        const valorTotalPendente = pagamentosPendentes.reduce((sum, p) => sum + Number(p.valor || 0), 0);
        const valorTotalAprovado = pagamentosAprovados.reduce((sum, p) => sum + Number(p.valor || 0), 0);
        const valorTotalPago = pagamentosPagos.reduce((sum, p) => sum + Number(p.valor || 0), 0);
        const valorTotalNotas = notasPendentes?.reduce((sum, n: any) => sum + Number(n.pagamentos?.valor || 0), 0) || 0;

        const totalPendentes = pagamentosPendentes.length + (notasPendentes?.length || 0);

        // Calcular tempo médio de resposta dos médicos
        const pagamentosComResposta = todosPagamentos?.filter(p => p.data_solicitacao && p.data_resposta) || [];
        const tempoMedioResposta = pagamentosComResposta.length > 0
          ? pagamentosComResposta.reduce((sum, p) => {
              const diff = new Date(p.data_resposta!).getTime() - new Date(p.data_solicitacao!).getTime();
              return sum + diff / (1000 * 60 * 60); // em horas
            }, 0) / pagamentosComResposta.length
          : 0;

        // Taxa de aprovação (últimos 30 dias)
        const totalNotasUltimos30 = (notasPendentes?.length || 0) + (notasAprovadas?.length || 0);
        const taxaAprovacao = totalNotasUltimos30 > 0 
          ? ((notasAprovadas?.length || 0) / totalNotasUltimos30 * 100) 
          : 0;

        // Formatar valores - mover ANTES do primeiro if
        const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL' 
        }).format(v);

        const dataHoje = new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' });

        if (totalPendentes === 0 && pagamentosAprovados.length === 0) {
          // Enviar mensagem de "tudo OK" profissional
          const mensagemSucesso = `✅ *RELATÓRIO GERENCIAL DIÁRIO*\n` +
            `${dataHoje}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👋 Olá, *${gestor.name}*!\n\n` +
            `🤖 Sou o *Sistema de Gestão de Pagamentos do HCC Hospital*. Estou aqui para te ajudar a manter tudo em dia.\n\n` +
            `🎉 *SISTEMA EM DIA*\n\n` +
            `Todas as operações estão em conformidade:\n\n` +
            `✓ Sem notas pendentes de aprovação\n` +
            `✓ Sem pagamentos aguardando nota\n` +
            `✓ Sem pagamentos pendentes de processamento\n\n` +
            `💰 *Resumo Financeiro:*\n` +
            `   • Pagos (mês): ${formatValor(valorTotalPago)}\n` +
            `   • Pendências: R$ 0,00\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 *Operações fluxo normal*\n\n` +
            `_Relatório automático • ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_`;
          
          try {
            const form = new FormData();
            form.append('number', gestor.numero_whatsapp);
            form.append('body', mensagemSucesso);
            form.append('externalKey', `relatorio_ok_${gestor.id}_${Date.now()}`);
            form.append('isClosed', 'false');

            const response = await fetch('https://apibot.chatconquista.com/v2/api/external/0b50b721-3442-407c-b5b5-231034f3ff01', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoxLCJpYXQiOjE3NjE4MDQ2NjYsImV4cCI6MTgyNDg3NjY2Nn0.xlhKoH-yVWUOlsGK4h9Ukcll05k1P3fT-TGiqW4cU6Q'
              },
              body: form
            });

            if (response.ok) {
              console.log(`✅ Relatório "tudo OK" enviado para ${gestor.name}`);
              enviosRealizados++;
            } else {
              console.error(`❌ Erro ao enviar para ${gestor.name}`);
              erros++;
            }
          } catch (error) {
            console.error(`❌ Erro ao enviar para ${gestor.name}:`, error);
            erros++;
          }
          
          continue;
        }

        
        // Montar relatório gerencial completo
        let mensagem = `📊 *RELATÓRIO GERENCIAL DIÁRIO*\n`;
        mensagem += `${dataHoje}\n`;
        mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        mensagem += `👋 Olá, *${gestor.name}*!\n\n`;
        mensagem += `🤖 Sou o *Sistema de Gestão de Pagamentos do HCC Hospital*. Estou aqui para te ajudar a manter tudo em dia.\n\n`;
        
        // KPIs Principais
        mensagem += `📈 *INDICADORES PRINCIPAIS*\n\n`;
        
        if (totalPendentes > 0) {
          mensagem += `⚠️ *Itens Aguardando Ação:* ${totalPendentes}\n`;
          mensagem += `   • Pagamentos: ${pagamentosPendentes.length}\n`;
          mensagem += `   • Notas: ${notasPendentes?.length || 0}\n\n`;
        }
        
        mensagem += `💰 *VALORES FINANCEIROS*\n`;
        mensagem += `   • Pendente: ${formatValor(valorTotalPendente)}\n`;
        
        if (valorTotalNotas > 0) {
          mensagem += `   • Notas Análise: ${formatValor(valorTotalNotas)}\n`;
        }
        
        if (valorTotalAprovado > 0) {
          mensagem += `   • Aprovado: ${formatValor(valorTotalAprovado)}\n`;
        }
        
        mensagem += `   • Pago (mês): ${formatValor(valorTotalPago)}\n\n`;
        
        // Métricas de Performance
        mensagem += `📊 *PERFORMANCE OPERACIONAL*\n`;
        
        if (tempoMedioResposta > 0) {
          const horas = Math.floor(tempoMedioResposta);
          mensagem += `   • Tempo Médio Resposta: ${horas}h\n`;
        }
        
        if (totalNotasUltimos30 > 0) {
          mensagem += `   • Taxa Aprovação (30d): ${taxaAprovacao.toFixed(1)}%\n`;
          mensagem += `   • Notas Processadas: ${totalNotasUltimos30}\n`;
        }
        
        mensagem += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // Detalhamento de pendências
        if (pagamentosPendentes.length > 0) {
          mensagem += `⏳ *PAGAMENTOS AGUARDANDO NOTA*\n\n`;
          
          const top5Pagamentos = pagamentosPendentes.slice(0, 5);
          top5Pagamentos.forEach((pag: any, idx: number) => {
            mensagem += `${idx + 1}. ${pag.medicos?.nome}\n`;
            mensagem += `   ${formatValor(Number(pag.valor))} • ${formatMesCompetencia(pag.mes_competencia)}\n`;
          });
          
          if (pagamentosPendentes.length > 5) {
            mensagem += `\n_...e mais ${pagamentosPendentes.length - 5} pagamentos_\n`;
          }
          
          mensagem += `\n`;
        }

        if (notasPendentes && notasPendentes.length > 0) {
          mensagem += `📄 *NOTAS AGUARDANDO APROVAÇÃO*\n\n`;
          
          const top5Notas = notasPendentes.slice(0, 5);
          top5Notas.forEach((nota: any, idx: number) => {
            const diasPendente = Math.floor((Date.now() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60 * 24));
            mensagem += `${idx + 1}. ${nota.pagamentos?.medicos?.nome}\n`;
            mensagem += `   ${formatValor(Number(nota.pagamentos?.valor || 0))} • ${diasPendente}d aguardando\n`;
          });
          
          if (notasPendentes.length > 5) {
            mensagem += `\n_...e mais ${notasPendentes.length - 5} notas_\n`;
          }
          
          mensagem += `\n`;
        }
        
        mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        mensagem += `🔗 *Portal:* https://hcc.chatconquista.com\n\n`;
        mensagem += `⚡ *Ações necessárias para processar ${totalPendentes} item(ns)*\n\n`;
        mensagem += `_Relatório automático • ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_`;

        // Enviar via WhatsApp diretamente para a API
        try {
          const form = new FormData();
          form.append('number', gestor.numero_whatsapp);
          form.append('body', mensagem);
          form.append('externalKey', `relatorio_diario_${gestor.id}_${Date.now()}`);
          form.append('isClosed', 'false');

          const response = await fetch('https://apibot.chatconquista.com/v2/api/external/0b50b721-3442-407c-b5b5-231034f3ff01', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoxLCJpYXQiOjE3NjE4MDQ2NjYsImV4cCI6MTgyNDg3NjY2Nn0.xlhKoH-yVWUOlsGK4h9Ukcll05k1P3fT-TGiqW4cU6Q'
            },
            body: form
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro ao enviar para ${gestor.name}:`, errorText);
            erros++;
          } else {
            console.log(`✅ Relatório enviado para ${gestor.name} (${gestor.numero_whatsapp})`);
            enviosRealizados++;
          }
        } catch (fetchError) {
          console.error(`❌ Erro ao enviar para ${gestor.name}:`, fetchError);
          erros++;
        }

        // Aguardar 2 segundos entre envios para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Erro ao processar gestor ${gestor.name}:`, error);
        erros++;
      }
    }

    const resultado = {
      success: true,
      timestamp: new Date().toISOString(),
      gestoresProcessados: gestores.length,
      enviosRealizados,
      jaEnviadosHoje: pularPorJaEnviado,
      erros,
      message: `Relatórios processados: ${enviosRealizados} enviados, ${pularPorJaEnviado} já enviados hoje, ${erros} erros`
    };

    console.log('📊 Resultado final:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao enviar relatórios' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});