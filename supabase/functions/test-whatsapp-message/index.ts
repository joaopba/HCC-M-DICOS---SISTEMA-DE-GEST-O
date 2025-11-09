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
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Enviando mensagem de teste...');

    // Enviar mensagem de teste usando a função send-whatsapp-template
    const { data, error } = await supabase.functions.invoke('send-whatsapp-template', {
      body: {
        type: 'encaminhar_nota',
        numero: '5577981086497',
        nome: 'Teste',
        valor: '1000.00',
        competencia: 'Janeiro/2025'
      }
    });

    if (error) {
      console.error('Erro ao enviar:', error);
      throw error;
    }

    console.log('Mensagem enviada com sucesso:', data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensagem de teste enviada',
      data
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro:', error);
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
