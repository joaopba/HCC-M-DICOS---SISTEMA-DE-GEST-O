-- Corrigir política de INSERT para gestores incluir tipo 'sistema'
DROP POLICY IF EXISTS "chat_insert_gestor_auth" ON public.chat_messages;

CREATE POLICY "chat_insert_gestor_auth"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  ) AND sender_type IN ('financeiro', 'sistema')
);

-- Permitir médicos verem todas as mensagens (incluindo 'sistema')
DROP POLICY IF EXISTS "chat_select_public" ON public.chat_messages;

CREATE POLICY "chat_select_all"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);