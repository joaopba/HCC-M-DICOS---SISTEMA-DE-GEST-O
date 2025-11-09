-- Adicionar campos de manutenção do dashboard médicos na tabela configuracoes
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS dashboard_medicos_manutencao boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dashboard_medicos_mensagem_manutencao text DEFAULT 'Dashboard em manutenção. Por favor, tente novamente mais tarde.',
ADD COLUMN IF NOT EXISTS dashboard_medicos_previsao_retorno timestamp with time zone;

-- Criar comentários para documentação
COMMENT ON COLUMN public.configuracoes.dashboard_medicos_manutencao IS 'Indica se o dashboard dos médicos está em manutenção';
COMMENT ON COLUMN public.configuracoes.dashboard_medicos_mensagem_manutencao IS 'Mensagem personalizada exibida durante a manutenção';
COMMENT ON COLUMN public.configuracoes.dashboard_medicos_previsao_retorno IS 'Data e hora prevista para retorno do dashboard';