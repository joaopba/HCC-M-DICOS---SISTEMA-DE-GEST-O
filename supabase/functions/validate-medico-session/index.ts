import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: RequestBody = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se a sessão é válida
    const { data: sessao, error: sessaoError } = await supabase
      .from('sessoes_medico')
      .select('*, medicos!inner(*)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (sessaoError) throw sessaoError;

    if (!sessao) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Sessão inválida ou expirada' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Buscar configuração para verificar se está habilitado
    const { data: config } = await supabase
      .from('configuracoes')
      .select('verificacao_medico_habilitada')
      .eq('empresa_id', sessao.medicos.empresa_id)
      .single();

    // Se a verificação foi desabilitada, invalidar a sessão
    if (!config?.verificacao_medico_habilitada) {
      return new Response(
        JSON.stringify({ valid: false, verificacaoDesabilitada: true }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        valid: true,
        medicoId: sessao.medico_id,
        expiresAt: sessao.expires_at
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('validate-medico-session error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message || 'Erro ao validar sessão' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});