-- Corrigir search_path das funções criadas
CREATE OR REPLACE FUNCTION public.cleanup_old_whatsapp_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.whatsapp_queue
  WHERE created_at < now() - interval '7 days'
  AND status IN ('enviado', 'falhou');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_whatsapp_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  janela TIMESTAMP WITH TIME ZONE;
  contador INTEGER;
  limite INTEGER;
BEGIN
  -- Janela de 1 minuto
  janela := date_trunc('minute', now());
  
  -- Buscar ou criar registro da janela
  INSERT INTO public.whatsapp_rate_limit (janela_tempo, mensagens_enviadas)
  VALUES (janela, 0)
  ON CONFLICT (janela_tempo) DO NOTHING;
  
  -- Verificar contador atual
  SELECT mensagens_enviadas, limite_por_janela
  INTO contador, limite
  FROM public.whatsapp_rate_limit
  WHERE janela_tempo = janela;
  
  -- Retornar se pode enviar
  RETURN (contador < limite);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_whatsapp_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  janela TIMESTAMP WITH TIME ZONE;
BEGIN
  janela := date_trunc('minute', now());
  
  UPDATE public.whatsapp_rate_limit
  SET mensagens_enviadas = mensagens_enviadas + 1
  WHERE janela_tempo = janela;
END;
$$;