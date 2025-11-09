-- Adicionar configurações de verificação de médico
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS verificacao_medico_habilitada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verificacao_medico_template_nome text DEFAULT 'verificamedico',
ADD COLUMN IF NOT EXISTS verificacao_medico_duracao_sessao_horas integer DEFAULT 24;

-- Criar tabela para armazenar códigos de verificação
CREATE TABLE IF NOT EXISTS verificacao_medico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verificado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verificacao_medico_codigo_length CHECK (length(codigo) = 6)
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_verificacao_medico_codigo ON verificacao_medico(medico_id, codigo, expires_at);

-- Criar tabela para sessões de médicos verificados
CREATE TABLE IF NOT EXISTS sessoes_medico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Criar índice para busca rápida de sessões
CREATE INDEX IF NOT EXISTS idx_sessoes_medico_token ON sessoes_medico(token, expires_at);

-- Limpar códigos e sessões expirados automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM verificacao_medico WHERE expires_at < now();
  DELETE FROM sessoes_medico WHERE expires_at < now();
END;
$$;

-- RLS policies para verificacao_medico
ALTER TABLE verificacao_medico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage verificacao_medico"
ON verificacao_medico
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies para sessoes_medico
ALTER TABLE sessoes_medico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage sessoes_medico"
ON sessoes_medico
FOR ALL
USING (true)
WITH CHECK (true);