
-- Corrigir o agendamento do cron job para executar apenas 1 vez por dia
-- O cron job atual está rodando a cada minuto, causando spam de relatórios

-- Primeiro, remover o cron job atual
SELECT cron.unschedule('send-daily-reminders');

-- Recriar o cron job para rodar a cada hora (a função já tem lógica interna para verificar o horário correto)
-- Isso permite flexibilidade no horário configurado, mas evita execuções a cada minuto
SELECT cron.schedule(
  'send-daily-reminders',
  '0 * * * *', -- Executa no minuto 0 de cada hora
  $$
  SELECT
    net.http_post(
        url:='https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/send-daily-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
