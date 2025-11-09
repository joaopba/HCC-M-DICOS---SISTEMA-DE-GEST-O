-- Remove TODAS as políticas RLS conflitantes de chat_messages
DROP POLICY IF EXISTS "Gestores podem ver todas mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem ver todas as mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Leitura pública de mensagens (dashboard médicos)" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem inserir mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem atualizar mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem ver suas mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem inserir suas mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem inserir mensagens" ON public.chat_messages;

-- Garantir que RLS está habilitada
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: Leitura pública (qualquer um pode ler)
CREATE POLICY "chat_select_public"
ON public.chat_messages
FOR SELECT
USING (true);

-- POLÍTICA 2: Inserção pública (qualquer um pode inserir desde que seja médico)
CREATE POLICY "chat_insert_medico_public"
ON public.chat_messages
FOR INSERT
WITH CHECK (sender_type = 'medico');

-- POLÍTICA 3: Inserção autenticada (gestores podem inserir como financeiro)
CREATE POLICY "chat_insert_gestor_auth"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  )
  AND sender_type = 'financeiro'
);

-- POLÍTICA 4: Atualização apenas para gestores autenticados
CREATE POLICY "chat_update_gestor"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  )
);