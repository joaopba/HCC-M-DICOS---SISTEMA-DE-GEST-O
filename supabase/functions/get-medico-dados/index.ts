import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody { cpf?: string; medicoId?: string; token?: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, medicoId, token }: RequestBody = await req.json();
    if (!cpf && !medicoId) {
      return new Response(JSON.stringify({ error: 'CPF ou medicoId é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let medico;
    
    if (medicoId) {
      // Buscar médico ativo por ID
      const { data, error: medicoError } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .eq('id', medicoId)
        .maybeSingle();
      
      if (medicoError) throw medicoError;
      medico = data;
    } else {
      // Buscar médico ativo por documento (CPF ou CNPJ)
      const cpfNumeros = cpf!.replace(/\D/g, '');
      const { data, error: medicoError } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .eq('documento', cpfNumeros)
        .maybeSingle();
      
      if (medicoError) throw medicoError;
      medico = data;
    }
    if (!medico) {
      return new Response(JSON.stringify({ medico: null }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Check if verification is enabled for this doctor's company
    const { data: config } = await supabase
      .from('configuracoes')
      .select('verificacao_medico_habilitada')
      .eq('empresa_id', medico.empresa_id)
      .single();

    // VALIDAÇÃO OBRIGATÓRIA: quando verificação está habilitada, SEMPRE exigir token válido
    if (config?.verificacao_medico_habilitada) {
      const authHeader = req.headers.get('authorization') || '';
      const headerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : undefined;
      const providedToken = token || headerToken;

      // Se não forneceu token, retornar erro
      if (!providedToken) {
        return new Response(
          JSON.stringify({ error: 'Token de autenticação obrigatório', code: 'SESSION_REQUIRED' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Validar o token fornecido
      const { data: sessao, error: sessaoError } = await supabase
        .from('sessoes_medico')
        .select('id, expires_at')
        .eq('token', providedToken)
        .eq('medico_id', medico.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (sessaoError) throw sessaoError;
      
      if (!sessao) {
        return new Response(
          JSON.stringify({ error: 'Sessão inválida ou expirada', code: 'INVALID_SESSION' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      console.log(`✅ Sessão validada para médico ${medico.nome} até ${sessao.expires_at}`);
    }

    // Pagamentos do médico com notas associadas - SEGURANÇA REFORÇADA
    const { data: pagamentos, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select(`*, notas_medicos!left ( id, status, arquivo_url, created_at )`)
      .eq('medico_id', medico.id)
      .order('mes_competencia', { ascending: false });

    if (pagamentosError) throw pagamentosError;

    // Notas do médico com dados de pagamentos - SEGURANÇA REFORÇADA
    const { data: notas, error: notasError } = await supabase
      .from('notas_medicos')
      .select(`*, pagamentos!inner ( valor, mes_competencia, data_pagamento )`)
      .eq('medico_id', medico.id)
      .order('created_at', { ascending: false });

    if (notasError) throw notasError;

    // VALIDAÇÃO CRÍTICA: garantir que apenas dados do médico logado sejam retornados
    const pagamentosFiltrados = pagamentos?.filter(p => p.medico_id === medico.id) || [];
    const notasFiltradas = notas?.filter(nota => nota.medico_id === medico.id) || [];

    return new Response(JSON.stringify({ 
      medico, 
      pagamentos: pagamentosFiltrados, 
      notas: notasFiltradas 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    console.error('get-medico-dados error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});