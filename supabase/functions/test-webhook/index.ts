import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testando webhook do WhatsApp');
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar um médico ativo para teste
    const { data: medicos } = await supabase
      .from('medicos')
      .select('id, nome, numero_whatsapp')
      .eq('ativo', true)
      .limit(1);

    if (!medicos || medicos.length === 0) {
      throw new Error('Nenhum médico ativo encontrado para teste');
    }

    const medico = medicos[0];
    console.log('Médico selecionado para teste:', medico.nome);

    // Criar dados simulados de webhook
    const mockWebhookData = {
      message: {
        type: 'document',
        from: medico.numero_whatsapp,
        document: {
          mime_type: 'application/pdf',
          filename: `nota_teste_${Date.now()}.pdf`,
          url: 'https://example.com/test.pdf',
          link: 'https://example.com/test.pdf'
        }
      }
    };

    console.log('Dados simulados do webhook:', JSON.stringify(mockWebhookData, null, 2));

    // Testar o webhook handler
    const webhookResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify(mockWebhookData)
    });

    const webhookResult = await webhookResponse.json();
    console.log('Resposta do webhook:', webhookResult);

    // Verificar status dos pagamentos
    const { data: pagamentos } = await supabase
      .from('pagamentos')
      .select(`
        id,
        status,
        medicos!inner(nome, numero_whatsapp)
      `)
      .eq('medicos.id', medico.id)
      .eq('status', 'solicitado')
      .limit(5);

    return new Response(JSON.stringify({
      success: true,
      message: 'Teste do webhook concluído',
      testResults: {
        webhookStatus: webhookResponse.ok ? 'OK' : 'ERRO',
        webhookResponse: webhookResult,
        medicoTeste: {
          nome: medico.nome,
          whatsapp: medico.numero_whatsapp
        },
        pagamentosPendentes: pagamentos?.length || 0,
        simulacao: mockWebhookData,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro no teste do webhook:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      details: 'Falha ao testar o webhook'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});