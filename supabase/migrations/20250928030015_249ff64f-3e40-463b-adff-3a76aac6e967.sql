-- Corrigir políticas usando apenas 'gestor' (não 'admin')
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Política para visualizar perfis
CREATE POLICY "Users and managers can view profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role = 'gestor'
  )
);

-- Política para atualizar perfis
CREATE POLICY "Users can update own profile, managers all" ON public.profiles
FOR UPDATE USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role = 'gestor'
  )
);

-- Política para inserir perfis (apenas gestores podem criar usuários)
CREATE POLICY "Managers can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role = 'gestor'
  )
);

-- Política para deletar perfis (apenas gestores)
CREATE POLICY "Managers can delete profiles" ON public.profiles
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role = 'gestor'
  )
);