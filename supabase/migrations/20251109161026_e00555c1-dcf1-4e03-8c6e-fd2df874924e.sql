
-- Criar cron job para lembrar gestores sobre notas pendentes a cada 6 horas
SELECT cron.schedule(
  'remind-gestores-notas-pendentes',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/remind-gestores-notas-pendentes',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
