-- Tabela para armazenar logs de debug dos webhooks
CREATE TABLE IF NOT EXISTS public.webhook_debug_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB,
  query_params JSONB,
  raw_body TEXT,
  parsed_body JSONB,
  user_agent TEXT,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_debug_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view webhook logs" 
ON public.webhook_debug_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert webhook logs" 
ON public.webhook_debug_logs 
FOR INSERT 
WITH CHECK (true);

-- Index para performance
CREATE INDEX idx_webhook_debug_logs_timestamp ON public.webhook_debug_logs(timestamp DESC);