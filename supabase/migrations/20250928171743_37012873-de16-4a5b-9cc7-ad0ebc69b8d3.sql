-- Adicionar campo CPF na tabela medicos
ALTER TABLE public.medicos ADD COLUMN cpf TEXT;

-- Criar índice único para CPF
CREATE UNIQUE INDEX idx_medicos_cpf ON public.medicos(cpf) WHERE cpf IS NOT NULL;

-- Criar tabela para upload de notas pelos médicos
CREATE TABLE public.notas_medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  pagamento_id UUID NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Evitar duplicatas
  UNIQUE(pagamento_id)
);

-- Enable RLS
ALTER TABLE public.notas_medicos ENABLE ROW LEVEL SECURITY;

-- Políticas para notas_medicos
CREATE POLICY "Authenticated users can view notas_medicos" 
ON public.notas_medicos 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert notas_medicos" 
ON public.notas_medicos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update notas_medicos" 
ON public.notas_medicos 
FOR UPDATE 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_notas_medicos_updated_at
BEFORE UPDATE ON public.notas_medicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();