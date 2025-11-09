-- Adicionar joaopedro@gmail.com como gestor
-- Buscar o user_id do usuário com esse email
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Tentar buscar o user_id do auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'joaopedro@gmail.com';
  
  -- Se o usuário existir, atualizar o perfil
  IF v_user_id IS NOT NULL THEN
    -- Atualizar o perfil para gestor
    UPDATE public.profiles
    SET role = 'gestor'
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Usuário joaopedro@gmail.com configurado como gestor';
  ELSE
    RAISE NOTICE 'Usuário joaopedro@gmail.com não encontrado. Será configurado como gestor no primeiro login';
  END IF;
END $$;