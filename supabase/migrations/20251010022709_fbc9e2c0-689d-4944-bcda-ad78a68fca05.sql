-- Adicionar coluna sender_type 'sistema' na tabela chat_messages
-- Primeiro vamos remover a constraint existente se houver
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check;

-- Adicionar nova constraint com 'sistema' incluído
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_sender_type_check 
  CHECK (sender_type IN ('medico', 'financeiro', 'sistema'));