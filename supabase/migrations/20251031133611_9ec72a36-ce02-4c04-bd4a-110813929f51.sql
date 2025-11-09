-- Criar função que notifica gestores via webhook quando nota é inserida
CREATE OR REPLACE FUNCTION notify_gestores_on_nota_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas notifica se a nota está pendente
  IF NEW.status = 'pendente' THEN
    PERFORM net.http_post(
      url := 'https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/notify-gestores-nova-nota',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4'
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger que executa após inserção de nota
DROP TRIGGER IF EXISTS trigger_notify_gestores_nova_nota ON notas_medicos;
CREATE TRIGGER trigger_notify_gestores_nova_nota
  AFTER INSERT ON notas_medicos
  FOR EACH ROW
  EXECUTE FUNCTION notify_gestores_on_nota_insert();

-- Comentários
COMMENT ON FUNCTION notify_gestores_on_nota_insert() IS 'Notifica gestores via webhook quando uma nova nota pendente é inserida';
COMMENT ON TRIGGER trigger_notify_gestores_nova_nota ON notas_medicos IS 'Trigger que chama função de notificação aos gestores';