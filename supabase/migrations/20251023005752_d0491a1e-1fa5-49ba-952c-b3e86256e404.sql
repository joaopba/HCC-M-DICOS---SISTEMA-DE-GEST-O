-- Adicionar novos campos de configuração
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS horario_envio_relatorios TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS intervalo_cobranca_nota_horas INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS lembrete_periodico_horas INTEGER DEFAULT 48;