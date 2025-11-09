-- Fix RLS policies for chat_messages to resolve insert violations and allow proper roles

-- Ensure RLS is enabled
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Gestores podem ver todas mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem ver todas as mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem inserir mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem atualizar mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem ver suas mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem inserir suas mensagens" ON public.chat_messages;

-- SELECT policies
-- Gestores podem ver todas as mensagens (requires authenticated user with gestor role)
CREATE POLICY "Gestores podem ver todas as mensagens"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (is_gestor());

-- Médicos (interface pública) podem ler mensagens do chat (mantém comportamento atual)
-- Nota: Como o dashboard de médicos é público, mantemos leitura aberta.
CREATE POLICY "Leitura pública de mensagens (dashboard médicos)"
ON public.chat_messages
FOR SELECT
USING (true);

-- INSERT policies
-- Médicos podem inserir mensagens (origem: dashboard público)
CREATE POLICY "Médicos podem inserir mensagens"
ON public.chat_messages
FOR INSERT
WITH CHECK (sender_type = 'medico');

-- Gestores podem inserir mensagens (origem: app autenticado)
CREATE POLICY "Gestores podem inserir mensagens"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (is_gestor() AND sender_type = 'financeiro');

-- UPDATE policies
-- Gestores podem atualizar mensagens (ex.: marcar como lidas)
CREATE POLICY "Gestores podem atualizar mensagens"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (is_gestor());