-- Criar job cron para enviar lembretes de notas pendentes a cada 12 horas
SELECT cron.schedule(
  'send-nota-pendente-reminders',
  '0 */12 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/send-reminders-nota-pendente',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);