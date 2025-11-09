-- Atualizar configurações da API do WhatsApp
UPDATE public.configuracoes 
SET 
  api_url = 'https://api.hcchospital.com.br/v2/api/external/569d53c5-b3e8-44bc-a475-d495e046d35e',
  auth_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MywicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoyLCJpYXQiOjE3NjAwNzQ4NTQsImV4cCI6MTgyMzE0Njg1NH0.b8ZkiTar8EHPGRS6pRjZYszjcyv3ac1QE2CFtQ0E2rM',
  updated_at = now()
WHERE id IS NOT NULL;