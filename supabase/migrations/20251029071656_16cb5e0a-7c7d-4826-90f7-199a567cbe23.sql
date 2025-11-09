-- Corrigir trigger para incluir empresa_id ao criar novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role, empresa_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'usuario'::user_role),
    '00000000-0000-0000-0000-000000000001'::uuid -- HCC Hospital como empresa padrão
  );
  RETURN NEW;
END;
$$;