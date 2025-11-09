import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
  return `${meses[mesIndex]} de ${ano}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Extrair apenas ano-mês (YYYY-MM) dos filtros para comparar com mes_competencia
    const startMonth = startDate ? startDate.substring(0, 7) : null;
    const endMonth = endDate ? endDate.substring(0, 7) : null;

    // Buscar todos os dados necessários
    let query = supabase
      .from('pagamentos')
      .select(`
        id,
        mes_competencia,
        valor,
        valor_liquido,
        status,
        data_solicitacao,
        data_resposta,
        data_pagamento,
        observacoes,
        created_at,
        medicos(
          nome,
          documento,
          numero_whatsapp,
          especialidade
        )
      `)
      .order('created_at', { ascending: false });

    // Filtros por mês de competência se fornecidos
    if (startMonth) {
      query = query.gte('mes_competencia', startMonth);
    }
    if (endMonth) {
      query = query.lte('mes_competencia', endMonth);
    }

    const { data: pagamentos, error } = await query;

    if (error) throw error;

    // Buscar datas de envio das mensagens de pagamento
    const { data: messageLogs } = await supabase
      .from('message_logs')
      .select('pagamento_id, created_at, tipo')
      .eq('tipo', 'whatsapp_pagamento')
      .in('pagamento_id', (pagamentos || []).map((p: any) => p.id));

    // Criar um mapa de pagamento_id -> data_envio_mensagem
    const mensagemPagamentoMap = new Map();
    (messageLogs || []).forEach((log: any) => {
      mensagemPagamentoMap.set(log.pagamento_id, log.created_at);
    });

    // Organizar dados nas três categorias solicitadas
    const solicitacao_de_dados = (pagamentos || [])
      .filter(p => p.data_solicitacao)
      .map((pagamento: any) => {
        const medico = Array.isArray(pagamento.medicos) ? pagamento.medicos[0] : pagamento.medicos;
        return {
          id: pagamento.id,
          medico_nome: medico?.nome || 'N/A',
          medico_documento: medico?.documento || 'N/A',
          numero_whatsapp: medico?.numero_whatsapp || 'N/A',
          especialidade: medico?.especialidade || 'N/A',
          mes_competencia: formatMesCompetencia(pagamento.mes_competencia),
          valor: pagamento.valor,
          data_solicitacao: pagamento.data_solicitacao,
          status: pagamento.status
        };
      });

    const dados_resposta = (pagamentos || [])
      .filter(p => p.data_resposta)
      .map((pagamento: any) => {
        const medico = Array.isArray(pagamento.medicos) ? pagamento.medicos[0] : pagamento.medicos;
        return {
          id: pagamento.id,
          medico_nome: medico?.nome || 'N/A',
          medico_documento: medico?.documento || 'N/A',
          mes_competencia: formatMesCompetencia(pagamento.mes_competencia),
          valor: pagamento.valor,
          data_resposta: pagamento.data_resposta,
          status: pagamento.status,
          observacoes: pagamento.observacoes || ''
        };
      });

    const pagamento_de_dados = (pagamentos || [])
      .filter(p => p.data_pagamento)
      .map((pagamento: any) => {
        const medico = Array.isArray(pagamento.medicos) ? pagamento.medicos[0] : pagamento.medicos;
        return {
          id: pagamento.id,
          medico_nome: medico?.nome || 'N/A',
          medico_documento: medico?.documento || 'N/A',
          especialidade: medico?.especialidade || 'N/A',
          mes_competencia: formatMesCompetencia(pagamento.mes_competencia),
          valor_bruto: pagamento.valor,
          valor_liquido: pagamento.valor_liquido || pagamento.valor,
          data_pagamento: pagamento.data_pagamento,
          data_envio_mensagem: mensagemPagamentoMap.get(pagamento.id) || null,
          status: pagamento.status
        };
      });

    // Estatísticas gerais
    const totalPagamentos = pagamentos?.length || 0;
    const valorTotal = pagamentos?.reduce((sum: number, p: any) => sum + (p.valor || 0), 0) || 0;
    const pagamentosPagos = pagamentos?.filter((p: any) => p.status === 'pago').length || 0;
    const valorPago = pagamentos?.filter((p: any) => p.status === 'pago').reduce((sum: number, p: any) => sum + (p.valor || 0), 0) || 0;

    return new Response(JSON.stringify({
      success: true,
      solicitacao_de_dados,
      dados_resposta,
      pagamento_de_dados,
      estatisticas: {
        total_pagamentos: totalPagamentos,
        pagamentos_pagos: pagamentosPagos,
        pendentes: totalPagamentos - pagamentosPagos,
        valor_total_bruto: valorTotal,
        valor_total_pago: valorPago,
        periodo: {
          inicio: startDate || 'início',
          fim: endDate || 'fim'
        }
      },
      data_geracao: new Date().toISOString()
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro ao buscar dados do relatório:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});