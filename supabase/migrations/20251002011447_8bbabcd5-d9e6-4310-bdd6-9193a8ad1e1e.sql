-- Adicionar novos valores ao enum payment_status
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'nota_rejeitada';