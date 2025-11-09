-- Confirmar email do usuário financeiro@hcchospital.com.br
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'financeiro@hcchospital.com.br'
AND email_confirmed_at IS NULL;