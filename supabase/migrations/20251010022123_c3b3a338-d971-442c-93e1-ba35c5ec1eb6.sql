-- Criar tabela de tickets de chat
CREATE TABLE public.chat_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  gestor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'finalizado')),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_chat_tickets_medico ON public.chat_tickets(medico_id);
CREATE INDEX idx_chat_tickets_gestor ON public.chat_tickets(gestor_id);
CREATE INDEX idx_chat_tickets_status ON public.chat_tickets(status);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_chat_tickets_updated_at
  BEFORE UPDATE ON public.chat_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.chat_tickets ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Gestores podem ver todos os tickets
CREATE POLICY "Gestores podem ver todos tickets"
  ON public.chat_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'gestor'
    )
  );

-- Gestores podem criar tickets
CREATE POLICY "Gestores podem criar tickets"
  ON public.chat_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'gestor'
    )
  );

-- Gestores podem atualizar seus próprios tickets
CREATE POLICY "Gestores podem atualizar seus tickets"
  ON public.chat_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = gestor_id AND user_id = auth.uid() AND role = 'gestor'
    )
  );

-- Médicos podem ver seus próprios tickets (público para o dashboard)
CREATE POLICY "Médicos podem ver seus tickets"
  ON public.chat_tickets
  FOR SELECT
  USING (true);

-- Médicos podem avaliar tickets finalizados (público)
CREATE POLICY "Médicos podem avaliar tickets"
  ON public.chat_tickets
  FOR UPDATE
  USING (status = 'finalizado')
  WITH CHECK (status = 'finalizado');