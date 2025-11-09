-- Confirmar o email do usuário existente
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'joaopedro@gmail.com' AND email_confirmed_at IS NULL;