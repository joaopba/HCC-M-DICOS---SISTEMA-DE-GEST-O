import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'nova_nota' | 'pagamento_realizado';
  pagamentoId: string;
  fileName?: string;
  valorLiquido?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, pagamentoId, fileName, valorLiquido }: NotificationRequest = await req.json();

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do pagamento
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select(`
        id,
        valor,
        mes_competencia,
        valor_liquido,
        medicos!inner (
          nome,
          especialidade
        )
      `)
      .eq('id', pagamentoId)
      .single();

    if (!pagamento) {
      throw new Error('Pagamento não encontrado');
    }

    // Buscar configurações
    const { data: config } = await supabase
      .from('configuracoes')
      .select('email_notificacoes')
      .single();

    if (!config?.email_notificacoes) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Notificações por email estão desabilitadas'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

    let subject = '';
    let message = '';

    if (type === 'nova_nota') {
      subject = '📋 Nova Nota Fiscal Recebida - HCC Hospital';
      message = `
        <h2>Nova Nota Fiscal Recebida</h2>
        <p><strong>Médico:</strong> ${(pagamento.medicos as any)?.nome}</p>
        <p><strong>Competência:</strong> ${pagamento.mes_competencia}</p>
        <p><strong>Valor Bruto:</strong> R$ ${pagamento.valor.toFixed(2)}</p>
        ${valorLiquido ? `<p><strong>Valor Líquido:</strong> R$ ${valorLiquido.toFixed(2)}</p>` : ''}
        <p><strong>Arquivo:</strong> ${fileName || 'nota.pdf'}</p>
        
        <p>A nota está disponível no sistema para download e processamento de pagamento.</p>
        
        <p>
          <a href="${Deno.env.get('SUPABASE_URL')}/dashboard/pagamentos" 
             style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Acessar Sistema
          </a>
        </p>
      `;
    } else if (type === 'pagamento_realizado') {
      subject = '💰 Pagamento Realizado - HCC Hospital';
      message = `
        <h2>Pagamento Realizado</h2>
        <p><strong>Médico:</strong> ${(pagamento.medicos as any)?.nome}</p>
        <p><strong>Competência:</strong> ${pagamento.mes_competencia}</p>
        <p><strong>Valor Pago:</strong> R$ ${(pagamento.valor_liquido || pagamento.valor).toFixed(2)}</p>
        
        <p>O pagamento foi processado e a notificação foi enviada ao médico via WhatsApp.</p>
      `;
    }

    console.log('Enviando notificação:', {
      type,
      subject,
      pagamentoId
    });

    // Enviar email via edge function send-email-notification
    try {
      const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          type,
          pagamentoId,
          fileName,
          valorLiquido
        })
      });

      const emailResult = await emailResponse.json();
      console.log('Email enviado:', emailResult);
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
      // Não falhar a função se o email falhar
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificação processada',
      type,
      subject
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    
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