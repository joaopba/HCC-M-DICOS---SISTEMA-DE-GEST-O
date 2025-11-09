-- Permitir gestores deletarem mensagens
CREATE POLICY "chat_delete_gestor"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  )
);

-- Permitir gestores atualizarem mensagens (conteúdo)
DROP POLICY IF EXISTS "chat_update_gestor" ON public.chat_messages;

CREATE POLICY "chat_update_gestor_messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  )
);