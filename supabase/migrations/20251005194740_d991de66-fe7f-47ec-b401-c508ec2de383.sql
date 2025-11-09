-- Criar tabela de mensagens do chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('medico', 'financeiro')),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_medico_id ON public.chat_messages(medico_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON public.chat_messages(read) WHERE read = false;

-- Habilitar RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Gestores podem ver todas mensagens"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (is_manager(auth.uid()));

CREATE POLICY "Gestores podem inserir mensagens"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_manager(auth.uid()));

CREATE POLICY "Gestores podem atualizar mensagens"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (is_manager(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Replica Identity para realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

COMMENT ON TABLE public.chat_messages IS 'Mensagens do chat entre médicos e financeiro';