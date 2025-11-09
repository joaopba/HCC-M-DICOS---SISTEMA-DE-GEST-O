-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para enviar lembretes diários
-- Executa a cada hora e a função verifica se está no horário configurado
SELECT cron.schedule(
  'send-daily-reminders',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT
    net.http_post(
        url:='https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/send-daily-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);