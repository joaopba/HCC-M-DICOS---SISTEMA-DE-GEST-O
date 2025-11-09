-- Adicionar coluna de número sequencial para tickets
ALTER TABLE chat_tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- Criar sequência para numeração automática de tickets
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1000;

-- Atualizar tickets existentes com números
UPDATE chat_tickets 
SET ticket_number = nextval('ticket_number_seq')
WHERE ticket_number IS NULL;

-- Tornar a coluna NOT NULL após atualizar registros existentes
ALTER TABLE chat_tickets ALTER COLUMN ticket_number SET NOT NULL;

-- Adicionar constraint unique
ALTER TABLE chat_tickets ADD CONSTRAINT unique_ticket_number UNIQUE (ticket_number);

-- Criar função para auto-incrementar ticket_number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := nextval('ticket_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para auto-incrementar
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON chat_tickets;
CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON chat_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_tickets_number ON chat_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_medico_sender ON chat_messages(medico_id, sender_type);

-- Comentários para documentação
COMMENT ON COLUMN chat_tickets.ticket_number IS 'Número sequencial único do ticket para identificação';
COMMENT ON SEQUENCE ticket_number_seq IS 'Sequência para gerar números únicos de tickets começando em 1000';