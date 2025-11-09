-- Primeiro dropar o trigger, depois a função, e recriar tudo corretamente
DROP TRIGGER IF EXISTS clean_rejected_notes_trigger ON public.notas_medicos;
DROP FUNCTION IF EXISTS public.clean_rejected_notes();

-- Recriar a função com configuração de segurança adequada
CREATE OR REPLACE FUNCTION public.clean_rejected_notes()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path TO public
LANGUAGE plpgsql AS $$
BEGIN
  -- Se está inserindo uma nova nota pendente, remove as rejeitadas do mesmo pagamento
  IF NEW.status = 'pendente' THEN
    DELETE FROM public.notas_medicos 
    WHERE pagamento_id = NEW.pagamento_id 
    AND status = 'rejeitado';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER clean_rejected_notes_trigger
  BEFORE INSERT ON public.notas_medicos
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_rejected_notes();