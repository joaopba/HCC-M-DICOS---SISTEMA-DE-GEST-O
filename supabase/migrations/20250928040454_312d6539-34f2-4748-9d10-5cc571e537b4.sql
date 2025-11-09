-- Primeiro, remover as políticas problemáticas
DROP POLICY IF EXISTS "Managers can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and managers can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile, managers all" ON public.profiles;

-- Criar função segura para verificar se o usuário é gestor
CREATE OR REPLACE FUNCTION public.is_manager(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = 'gestor'
  );
$$;

-- Criar políticas RLS seguras sem recursão
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_manager(auth.uid()));

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Managers can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (public.is_manager(auth.uid()));