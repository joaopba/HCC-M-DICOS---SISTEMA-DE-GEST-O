import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API Meta WhatsApp (oficial)
const META_PHONE_ID = '468233466375447';
const META_TOKEN = 'EAAXSNrvzpbABP6IYXowGhZBzQbatbThlDDsidvOs77h6BAmhaJLZAos2SWzqZARSl57YiBvZCYJFCjJWSDbP5XuZAWT4ORdREQ2yBdaiYyk7si0boZB5LkoDzcCw6ZCiBy6tPMZBlrVtCcLZBQivZBc7xlIrDnQk1v8zgp3vK0coPZAGXAp0DSrEf9fVmjlZCXUk9gZDZD';
const META_API_URL = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`;

interface Medico {
  id: string;
  nome: string;
  documento: string;
}

interface Pagamento {
  id: string;
  mes_competencia: string;
  valor: number;
  status: string;
  medico_id: string;
  medicos: Medico;
}

interface NotaPendente {
  id: string;
  pagamento_id: string;
  created_at: string;
  pagamentos: {
    mes_competencia: string;
    valor: number;
    medicos: Medico;
  };
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

    console.log('Iniciando envio de lembretes diários');

    // Buscar horário configurado
    const { data: config } = await supabase
      .from('configuracoes')
      .select('horario_envio_relatorios')
      .single();

    if (config?.horario_envio_relatorios) {
      // Converter UTC para horário de Brasília (UTC-3)
      const now = new Date();
      const brasiliaOffset = -3; // UTC-3
      const horaAtualBrasilia = (now.getUTCHours() + brasiliaOffset + 24) % 24;
      
      const [horaConfig, minutoConfig] = config.horario_envio_relatorios.split(':').map(Number);
      
      // Verifica se está no horário configurado (mesma hora)
      if (horaAtualBrasilia !== horaConfig) {
        console.log(`Não está no horário configurado. Hora atual (Brasília): ${horaAtualBrasilia}, Hora configurada: ${horaConfig}`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Fora do horário configurado',
          horaAtualBrasilia,
          horaConfig
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`✅ No horário configurado! Hora Brasília: ${horaAtualBrasilia}, Configurado: ${horaConfig}`);
    }

    const { data: gestores, error: gestoresError } = await supabase
      .from('profiles')
      .select('id, name, numero_whatsapp')
      .eq('role', 'gestor')
      .not('numero_whatsapp', 'is', null);

    if (gestoresError) {
      console.error('Erro ao buscar gestores:', gestoresError);
      throw gestoresError;
    }

    if (!gestores || gestores.length === 0) {
      console.log('Nenhum gestor com WhatsApp configurado');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum gestor para enviar lembretes' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Encontrados ${gestores.length} gestor(es)`);

    const { data: notasPendentes, error: notasError } = await supabase
      .from('notas_medicos')
      .select(`
        id,
        pagamento_id,
        created_at,
        pagamentos(
          mes_competencia,
          valor,
          medicos(
            id,
            nome,
            documento
          )
        )
      `)
      .eq('status', 'pendente');

    if (notasError) {
      console.error('Erro ao buscar notas pendentes:', notasError);
    }

    const { data: pagamentosAprovados, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select(`
        id,
        mes_competencia,
        valor,
        status,
        medico_id,
        medicos(
          id,
          nome,
          documento
        )
      `)
      .eq('status', 'aprovado');

    if (pagamentosError) {
      console.error('Erro ao buscar pagamentos aprovados:', pagamentosError);
    }

    // Buscar pagamentos que não tem solicitação de nota (status 'pendente')
    const { data: pagamentosPendentes, error: pagamentosPendentesError } = await supabase
      .from('pagamentos')
      .select(`
        id,
        mes_competencia,
        valor,
        status,
        medico_id,
        medicos(
          id,
          nome,
          documento
        )
      `)
      .eq('status', 'pendente');

    if (pagamentosPendentesError) {
      console.error('Erro ao buscar pagamentos pendentes:', pagamentosPendentesError);
    }

    console.log(`Notas pendentes: ${notasPendentes?.length || 0}`);
    console.log(`Pagamentos aprovados não pagos: ${pagamentosAprovados?.length || 0}`);
    console.log(`Pagamentos pendentes sem nota: ${pagamentosPendentes?.length || 0}`);

    for (const gestor of gestores) {
      try {
        // Verificar se já enviou relatório hoje
        const hoje = new Date().toISOString().split('T')[0];
        const { data: ultimoEnvio } = await supabase
          .from('whatsapp_queue')
          .select('created_at')
          .eq('destinatario', gestor.numero_whatsapp)
          .or('mensagem.ilike.%Sistema de Gestão de Pagamentos%,mensagem.ilike.%Relatório Diário%')
          .gte('created_at', `${hoje}T00:00:00`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (ultimoEnvio) {
          console.log(`⏭️ Relatório já enviado hoje para ${gestor.name}`);
          continue;
        }

        const relatorios = [];
        
        // Verificar se há notas pendentes
        if (notasPendentes && notasPendentes.length > 0) {
          relatorios.push(gerarRelatorioNotasPendentes(notasPendentes, gestor.name));
        }

        // Verificar se há pagamentos aprovados
        if (pagamentosAprovados && pagamentosAprovados.length > 0) {
          relatorios.push(gerarRelatorioPagamentosAprovados(pagamentosAprovados, gestor.name));
        }

        // Verificar se há pagamentos sem solicitação
        if (pagamentosPendentes && pagamentosPendentes.length > 0) {
          relatorios.push(gerarRelatorioPagamentosPendentes(pagamentosPendentes, gestor.name));
        }

        // Se tem relatórios, enviar UMA ÚNICA mensagem com todos
        if (relatorios.length > 0) {
          const intro = `🤖 *Sistema de Gestão de Pagamentos - HCC Hospital*\n` +
            `Estou aqui para te ajudar a manter tudo em dia. Segue o panorama gerencial de hoje:\n\n`;
          const mensagemCompleta = intro + relatorios.join('\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n');
          await enviarMensagemWhatsApp(supabase, gestor.numero_whatsapp, mensagemCompleta);
          console.log(`Relatório completo enviado para ${gestor.name}`);
        } else {
          // Se não há nada pendente, enviar mensagem de "tudo OK"
          const mensagemTudoOk = `✅ *Relatório Diário - HCC Hospital*\n\n` +
            `📅 ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n\n` +
            `Olá ${gestor.name}!\n\n` +
            `🎉 *Tudo em dia!*\n\n` +
            `Não há notas pendentes de aprovação, pagamentos aguardando processamento ou pagamentos sem nota solicitada.`;
          
          await enviarMensagemWhatsApp(supabase, gestor.numero_whatsapp, mensagemTudoOk);
          console.log(`Mensagem "tudo OK" enviada para ${gestor.name}`);
        }

      } catch (error) {
        console.error(`Erro ao enviar lembretes para ${gestor.name}:`, error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Lembretes enviados com sucesso',
      gestores: gestores.length,
      notasPendentes: notasPendentes?.length || 0,
      pagamentosAprovados: pagamentosAprovados?.length || 0,
      pagamentosPendentes: pagamentosPendentes?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function gerarRelatorioNotasPendentes(notas: any[], nomeGestor: string): string {
  const totalValor = notas.reduce((sum, n) => sum + Number(n.pagamentos.valor), 0);
  const valorMedio = totalValor / notas.length;
  const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  // Calcular tempo médio de espera
  const tempoMedioEspera = notas.reduce((sum, n) => {
    const dias = Math.floor((Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return sum + dias;
  }, 0) / notas.length;
  
  // Notas críticas (mais de 5 dias)
  const notasCriticas = notas.filter(n => {
    const dias = Math.floor((Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return dias > 5;
  }).length;
  
  const header = `📄 *NOTAS FISCAIS PENDENTES*\n` +
    `${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Olá *${nomeGestor}*!\n\n` +
    `📊 *RESUMO EXECUTIVO*\n` +
    `   • Total de Notas: *${notas.length}*\n` +
    `   • Valor Total: *${formatValor(totalValor)}*\n` +
    `   • Valor Médio: ${formatValor(valorMedio)}\n` +
    `   • Tempo Médio: ${tempoMedioEspera.toFixed(1)} dias\n` +
    (notasCriticas > 0 ? `   • ⚠️ Críticas (>5d): ${notasCriticas}\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *NOTAS AGUARDANDO APROVAÇÃO*\n\n`;

  const listaNotas = notas.slice(0, 8).map((nota, idx) => {
    const diasPendente = Math.floor((Date.now() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const emoji = diasPendente > 5 ? '🔴' : diasPendente > 3 ? '🟡' : '🟢';
    return `${emoji} *${idx + 1}. ${nota.pagamentos.medicos.nome}*\n` +
      `   💰 ${formatValor(nota.pagamentos.valor)} • ${nota.pagamentos.mes_competencia}\n` +
      `   ⏱️ ${diasPendente} dia(s) aguardando\n`;
  }).join('\n');

  const rodape = notas.length > 8
    ? `\n_...e mais ${notas.length - 8} notas_\n\n`
    : '\n';

  const total = `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *VALOR TOTAL: ${formatValor(totalValor)}*\n\n` +
    `🔗 *Portal:* https://hcc.chatconquista.com\n\n` +
    `⚡ *Ação Urgente:* Aprovar ${notas.length} nota(s) para liberar pagamentos\n\n` +
    `_Impacto financeiro de ${formatValor(totalValor)} aguardando processamento_`;

  return header + listaNotas + rodape + total;
}

function gerarRelatorioPagamentosAprovados(pagamentos: any[], nomeGestor: string): string {
  const totalValor = pagamentos.reduce((sum, p) => sum + Number(p.valor), 0);
  const valorMedio = totalValor / pagamentos.length;
  const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  // Agrupar por mês de competência
  const porMes = pagamentos.reduce((acc, p) => {
    const mes = p.mes_competencia;
    if (!acc[mes]) acc[mes] = { count: 0, valor: 0 };
    acc[mes].count++;
    acc[mes].valor += Number(p.valor);
    return acc;
  }, {} as Record<string, { count: number; valor: number }>);
  
  const mesesDistintos = Object.keys(porMes).length;
  
  const header = `✅ *PAGAMENTOS APROVADOS*\n` +
    `${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Olá *${nomeGestor}*!\n\n` +
    `📊 *ANÁLISE FINANCEIRA*\n` +
    `   • Total Aprovado: *${formatValor(totalValor)}*\n` +
    `   • Quantidade: ${pagamentos.length} pagamento(s)\n` +
    `   • Valor Médio: ${formatValor(valorMedio)}\n` +
    `   • Competências: ${mesesDistintos} mês(es)\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 *PAGAMENTOS PRONTOS PARA PROCESSAR*\n\n`;

  const listaPagamentos = pagamentos.slice(0, 8).map((pag, idx) => {
    return `✅ *${idx + 1}. ${pag.medicos.nome}*\n` +
      `   💵 ${formatValor(pag.valor)} • ${pag.mes_competencia}\n` +
      `   📋 Aprovado - Pronto para Pagar\n`;
  }).join('\n');

  const rodape = pagamentos.length > 8
    ? `\n_...e mais ${pagamentos.length - 8} pagamentos_\n\n`
    : '\n';
  
  // Breakdown por mês
  let breakdownMes = `━━━━━━━━━━━━━━━━━━━━━━\n\n📅 *BREAKDOWN POR MÊS*\n`;
  Object.entries(porMes).slice(0, 3).forEach(([mes, info]: [string, any]) => {
    breakdownMes += `   • ${mes}: ${info.count} pag(s) • ${formatValor(info.valor)}\n`;
  });
  breakdownMes += `\n`;

  const total = `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *TOTAL A PROCESSAR: ${formatValor(totalValor)}*\n\n` +
    `🔗 *Portal:* https://hcc.chatconquista.com/pagamentos\n\n` +
    `🚀 *Próxima Ação:* Processar ${pagamentos.length} pagamento(s) aprovado(s)\n\n` +
    `_Valores prontos para transferência bancária_`;

  return header + listaPagamentos + rodape + breakdownMes + total;
}

function gerarRelatorioPagamentosPendentes(pagamentos: any[], nomeGestor: string): string {
  const totalValor = pagamentos.reduce((sum, p) => sum + Number(p.valor), 0);
  const valorMedio = totalValor / pagamentos.length;
  const formatValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  
  // Calcular tempo de espera
  const tempoMedio = pagamentos.reduce((sum, p) => {
    const dias = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return sum + dias;
  }, 0) / pagamentos.length;
  
  // Agrupar por mês
  const porMes = pagamentos.reduce((acc, p) => {
    const mes = p.mes_competencia;
    if (!acc[mes]) acc[mes] = { count: 0, valor: 0 };
    acc[mes].count++;
    acc[mes].valor += Number(p.valor);
    return acc;
  }, {} as Record<string, { count: number; valor: number }>);
  
  const header = `⏳ *PAGAMENTOS AGUARDANDO NOTA*\n` +
    `${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Olá *${nomeGestor}*!\n\n` +
    `📊 *SITUAÇÃO ATUAL*\n` +
    `   • Pagamentos Parados: *${pagamentos.length}*\n` +
    `   • Valor Bloqueado: *${formatValor(totalValor)}*\n` +
    `   • Valor Médio: ${formatValor(valorMedio)}\n` +
    `   • Tempo Médio: ${tempoMedio.toFixed(1)} dias\n\n` +
    `⚠️ *Estes valores estão aguardando solicitação de nota para processamento*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *PAGAMENTOS SEM NOTA SOLICITADA*\n\n`;

  const listaPagamentos = pagamentos.slice(0, 8).map((pag, idx) => {
    const diasEspera = Math.floor((Date.now() - new Date(pag.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return `⏳ *${idx + 1}. ${pag.medicos.nome}*\n` +
      `   💰 ${formatValor(pag.valor)} • ${pag.mes_competencia}\n` +
      `   📅 ${diasEspera}d sem solicitação\n`;
  }).join('\n');

  const rodape = pagamentos.length > 8
    ? `\n_...e mais ${pagamentos.length - 8} pagamentos_\n\n`
    : '\n';

  // Análise por mês
  let analise = `━━━━━━━━━━━━━━━━━━━━━━\n\n📅 *ANÁLISE POR COMPETÊNCIA*\n`;
  Object.entries(porMes).slice(0, 3).forEach(([mes, info]: [string, any]) => {
    analise += `   • ${mes}: ${info.count} • ${formatValor(info.valor)}\n`;
  });
  analise += `\n`;

  const total = `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *VALOR TOTAL PARADO: ${formatValor(totalValor)}*\n\n` +
    `🔗 *Portal:* https://hcc.chatconquista.com/pagamentos\n\n` +
    `🚀 *Ação Requerida:* Solicitar ${pagamentos.length} nota(s) para desbloquear fluxo\n\n` +
    `_${formatValor(totalValor)} aguardando início do processo de pagamento_`;

  return header + listaPagamentos + rodape + analise + total;
}

async function enviarMensagemWhatsApp(
  supabase: any,
  numero: string,
  mensagem: string
): Promise<void> {
  // Enviar mensagem livre usando API Meta oficial
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: numero,
    type: "text",
    text: {
      preview_url: false,
      body: mensagem
    }
  };

  const response = await fetch(META_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${META_TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Erro Meta API:`, response.status, errorText);
    throw new Error(`Erro ao enviar mensagem: ${errorText}`);
  }
  
  const result = await response.json();
  console.log(`✅ Mensagem enviada via Meta API:`, result);
}
