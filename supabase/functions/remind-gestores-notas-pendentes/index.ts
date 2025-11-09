import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔔 Verificando notas pendentes para lembrar gestores');

    // Buscar configurações
    const { data: config } = await supabase
      .from('configuracoes')
      .select('intervalo_cobranca_nota_horas')
      .single();

    const intervaloHoras = config?.intervalo_cobranca_nota_horas || 24;
    const agora = new Date();
    const limiteData = new Date(agora.getTime() - intervaloHoras * 60 * 60 * 1000);

    console.log(`⏰ Buscando notas pendentes há mais de ${intervaloHoras}h (desde ${limiteData.toISOString()})`);

    // Buscar notas pendentes há mais tempo que o intervalo
    const { data: notasPendentes, error: notasError } = await supabase
      .from('notas_medicos')
      .select(`
        id,
        status,
        created_at,
        arquivo_url,
        pagamento_id,
        pagamentos (
          id,
          mes_competencia,
          valor,
          empresa_id,
          medicos (
            nome,
            documento,
            especialidade,
            numero_whatsapp
          )
        )
      `)
      .eq('status', 'pendente')
      .lt('created_at', limiteData.toISOString())
      .order('created_at', { ascending: true });

    if (notasError) {
      console.error('Erro ao buscar notas pendentes:', notasError);
      throw notasError;
    }

    if (!notasPendentes || notasPendentes.length === 0) {
      console.log('✅ Nenhuma nota pendente encontrada há mais de ' + intervaloHoras + 'h');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma nota pendente antiga' 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log(`📋 Encontradas ${notasPendentes.length} notas pendentes antigas`);

    // Agrupar por empresa
    const notasPorEmpresa = notasPendentes.reduce((acc: any, nota: any) => {
      const empresaId = nota.pagamentos.empresa_id;
      if (!acc[empresaId]) acc[empresaId] = [];
      acc[empresaId].push(nota);
      return acc;
    }, {});

    let lembretesEnviados = 0;
    let erros = 0;

    // Para cada empresa, buscar gestores e enviar lembretes
    for (const [empresaId, notas] of Object.entries(notasPorEmpresa) as [string, any[]][]) {
      console.log(`\n🏢 Processando empresa ${empresaId} com ${notas.length} nota(s)`);

      // Buscar gestores da empresa
      const { data: gestores, error: gestoresError } = await supabase
        .from('profiles')
        .select('id, name, numero_whatsapp')
        .eq('role', 'gestor')
        .eq('empresa_id', empresaId)
        .eq('whatsapp_notifications_enabled', true)
        .not('numero_whatsapp', 'is', null);

      if (gestoresError || !gestores || gestores.length === 0) {
        console.log(`⚠️ Nenhum gestor encontrado para empresa ${empresaId}`);
        continue;
      }

      console.log(`👥 Encontrados ${gestores.length} gestor(es)`);

      // Preparar resumo das notas
      const totalValor = notas.reduce((sum, n) => sum + Number(n.pagamentos.valor), 0);
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(totalValor);

      // Agrupar por urgência
      const criticas = notas.filter(n => {
        const horas = (agora.getTime() - new Date(n.created_at).getTime()) / (1000 * 60 * 60);
        return horas >= 72; // 3 dias
      });
      const urgentes = notas.filter(n => {
        const horas = (agora.getTime() - new Date(n.created_at).getTime()) / (1000 * 60 * 60);
        return horas >= 48 && horas < 72; // 2-3 dias
      });

      let mensagem = `⚠️ *LEMBRETE - Notas Pendentes de Aprovação*\n\n`;
      mensagem += `📊 *RESUMO URGENTE*\n`;
      mensagem += `   • Total: ${notas.length} nota(s)\n`;
      mensagem += `   • Valor: ${valorFormatado}\n`;
      if (criticas.length > 0) mensagem += `   • 🔴 Críticas (>72h): ${criticas.length}\n`;
      if (urgentes.length > 0) mensagem += `   • 🟡 Urgentes (>48h): ${urgentes.length}\n`;
      mensagem += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Listar até 5 notas mais antigas
      mensagem += `📋 *NOTAS MAIS ANTIGAS*\n\n`;
      const notasAMostrar = notas.slice(0, 5);
      for (const nota of notasAMostrar) {
        const pagamento = nota.pagamentos;
        const medico = Array.isArray(pagamento.medicos) ? pagamento.medicos[0] : pagamento.medicos;
        const horas = Math.floor((agora.getTime() - new Date(nota.created_at).getTime()) / (1000 * 60 * 60));
        const dias = Math.floor(horas / 24);
        const emoji = dias >= 3 ? '🔴' : dias >= 2 ? '🟡' : '⚠️';
        
        const mesFormatado = formatMesCompetencia(pagamento.mes_competencia);
        const valor = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(pagamento.valor);

        mensagem += `${emoji} *${medico.nome}*\n`;
        mensagem += `   💰 ${valor} • ${mesFormatado}\n`;
        mensagem += `   ⏱️ Aguardando há ${dias} dia(s) e ${horas % 24}h\n\n`;

        // Criar tokens para aprovar/rejeitar
        const tokenAprovar = btoa(`${nota.id}-${nota.created_at}-approve`).substring(0, 30);
        const tokenRejeitar = btoa(`${nota.id}-${nota.created_at}-reject`).substring(0, 30);
        mensagem += `   ✅ Aprovar: https://hcc.chatconquista.com/aprovar?i=${nota.id}&t=${tokenAprovar}\n`;
        mensagem += `   ❌ Rejeitar: https://hcc.chatconquista.com/rejeitar?i=${nota.id}&t=${tokenRejeitar}\n\n`;
      }

      if (notas.length > 5) {
        mensagem += `_...e mais ${notas.length - 5} nota(s)_\n\n`;
      }

      mensagem += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      mensagem += `🔗 *Portal:* https://hcc.chatconquista.com/aprovar-nota\n\n`;
      mensagem += `⚡ Por favor, revise e aprove as notas pendentes para liberar os pagamentos.`;

      // Enviar para cada gestor
      for (const gestor of gestores) {
        try {
          console.log(`📤 Enviando para ${gestor.name} (${gestor.numero_whatsapp})`);
          
          const { error } = await supabase.functions.invoke('send-notification-gestores', {
            body: {
              phoneNumber: gestor.numero_whatsapp,
              message: mensagem
            }
          });

          if (error) {
            console.error(`❌ Erro ao enviar para ${gestor.name}:`, error);
            erros++;
          } else {
            console.log(`✅ Lembrete enviado para ${gestor.name}`);
            lembretesEnviados++;
          }
        } catch (error: any) {
          console.error(`❌ Erro ao enviar para ${gestor.name}:`, error);
          erros++;
        }
      }
    }

    console.log(`\n✅ Processamento concluído: ${lembretesEnviados} enviados, ${erros} erros`);

    return new Response(JSON.stringify({
      success: true,
      notasPendentes: notasPendentes.length,
      lembretesEnviados,
      erros
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
