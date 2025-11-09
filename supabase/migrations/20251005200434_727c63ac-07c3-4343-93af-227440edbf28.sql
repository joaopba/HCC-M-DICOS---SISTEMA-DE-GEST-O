-- Corrigir políticas RLS para chat_messages
-- Primeiro, remover as políticas existentes se houver
DROP POLICY IF EXISTS "Gestores podem ver todas as mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem inserir mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Gestores podem atualizar mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem ver suas mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Médicos podem inserir suas mensagens" ON public.chat_messages;

-- Criar função para verificar se o usuário é gestor
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'gestor'
  )
$$;

-- Políticas para gestores
CREATE POLICY "Gestores podem ver todas as mensagens"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.is_gestor());

CREATE POLICY "Gestores podem inserir mensagens"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_gestor() AND sender_type = 'financeiro');

CREATE POLICY "Gestores podem atualizar mensagens"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (public.is_gestor());

-- Políticas para médicos (qualquer usuário autenticado pode enviar como médico)
CREATE POLICY "Médicos podem ver suas mensagens"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Médicos podem inserir suas mensagens"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (sender_type = 'medico');