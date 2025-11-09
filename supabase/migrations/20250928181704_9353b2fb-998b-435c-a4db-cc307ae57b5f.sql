-- Remover a constraint única que impede múltiplas notas para o mesmo pagamento
-- Isso permite que médicos enviem novas notas após rejeição
ALTER TABLE public.notas_medicos DROP CONSTRAINT IF EXISTS notas_medicos_pagaments_id_key;

-- Adicionar constraint única composta que permite múltiplas notas, mas apenas uma ativa por pagamento
-- Removemos notas rejeitadas quando uma nova é enviada
CREATE UNIQUE INDEX notas_medicos_pagamento_ativo_idx 
ON public.notas_medicos (pagamento_id) 
WHERE status = 'pendente';

-- Criar função para limpar notas rejeitadas antes de inserir nova
CREATE OR REPLACE FUNCTION public.clean_rejected_notes()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está inserindo uma nova nota pendente, remove as rejeitadas do mesmo pagamento
  IF NEW.status = 'pendente' THEN
    DELETE FROM public.notas_medicos 
    WHERE pagamento_id = NEW.pagamento_id 
    AND status = 'rejeitado';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para executar a limpeza
DROP TRIGGER IF EXISTS clean_rejected_notes_trigger ON public.notas_medicos;
CREATE TRIGGER clean_rejected_notes_trigger
  BEFORE INSERT ON public.notas_medicos
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_rejected_notes();