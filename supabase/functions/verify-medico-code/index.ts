import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  cpf: string;
  codigo: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, codigo }: RequestBody = await req.json();
    
    if (!cpf || !codigo) {
      return new Response(
        JSON.stringify({ error: 'CPF e código são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cpfNumeros = cpf.replace(/\D/g, '');

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('*')
      .eq('ativo', true)
      .eq('documento', cpfNumeros)
      .maybeSingle();

    if (medicoError) throw medicoError;
    
    if (!medico) {
      return new Response(
        JSON.stringify({ error: 'Médico não encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Buscar código de verificação válido
    const { data: verificacao, error: verificacaoError } = await supabase
      .from('verificacao_medico')
      .select('*')
      .eq('medico_id', medico.id)
      .eq('codigo', codigo)
      .eq('verificado', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificacaoError) throw verificacaoError;

    if (!verificacao) {
      return new Response(
        JSON.stringify({ error: 'Código inválido ou expirado' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Marcar código como verificado
    await supabase
      .from('verificacao_medico')
      .update({ verificado: true })
      .eq('id', verificacao.id);

    // Invalidar sessões anteriores deste médico (garantir uma sessão por médico)
    await supabase
      .from('sessoes_medico')
      .delete()
      .eq('medico_id', medico.id);

    // Criar nova sessão com duração fixa de 1 hora
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Sessão válida por 1 hora

    const { error: sessionError } = await supabase
      .from('sessoes_medico')
      .insert({
        medico_id: medico.id,
        token,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) throw sessionError;

    console.log(`Código verificado para médico ${medico.nome} - Token: ${token}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        token,
        expiresAt: expiresAt.toISOString(),
        message: 'Código verificado com sucesso' 
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('verify-medico-code error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao verificar código' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});