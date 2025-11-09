-- Criar tabela de fila de mensagens
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_destino TEXT NOT NULL,
  tipo_mensagem TEXT NOT NULL, -- 'template', 'text', 'notification'
  payload JSONB NOT NULL,
  prioridade INTEGER DEFAULT 5, -- 1=alta, 5=normal, 10=baixa
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  proximo_envio TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pendente', -- 'pendente', 'processando', 'enviado', 'falhou'
  erro_mensagem TEXT,
  enviado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_whatsapp_queue_status_prioridade ON public.whatsapp_queue(status, prioridade, proximo_envio) WHERE status = 'pendente';
CREATE INDEX idx_whatsapp_queue_numero ON public.whatsapp_queue(numero_destino);
CREATE INDEX idx_whatsapp_queue_created_at ON public.whatsapp_queue(created_at);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_queue_updated_at
  BEFORE UPDATE ON public.whatsapp_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage whatsapp_queue"
  ON public.whatsapp_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para limpar mensagens antigas (mais de 7 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_whatsapp_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.whatsapp_queue
  WHERE created_at < now() - interval '7 days'
  AND status IN ('enviado', 'falhou');
END;
$$;

-- Tabela para controle de rate limiting
CREATE TABLE IF NOT EXISTS public.whatsapp_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  janela_tempo TIMESTAMP WITH TIME ZONE NOT NULL,
  mensagens_enviadas INTEGER DEFAULT 0,
  limite_por_janela INTEGER DEFAULT 80, -- 80 mensagens por minuto (seguro para WhatsApp Business API)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(janela_tempo)
);

-- Índice para rate limiting
CREATE INDEX idx_whatsapp_rate_limit_janela ON public.whatsapp_rate_limit(janela_tempo);

-- RLS para rate limit
ALTER TABLE public.whatsapp_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate_limit"
  ON public.whatsapp_rate_limit
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para verificar rate limit
CREATE OR REPLACE FUNCTION public.check_whatsapp_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Função para incrementar contador de rate limit
CREATE OR REPLACE FUNCTION public.increment_whatsapp_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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