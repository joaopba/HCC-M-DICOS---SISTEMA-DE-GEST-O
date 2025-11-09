-- Corrigir pagamentos com nota recebida mas status ainda em 'solicitado'
UPDATE pagamentos
SET 
  status = 'nota_recebida',
  data_resposta = COALESCE(data_resposta, NOW())
WHERE id IN (
  SELECT p.id
  FROM pagamentos p
  INNER JOIN notas_medicos nm ON p.id = nm.pagamento_id
  WHERE p.status = 'solicitado'
    AND nm.status IN ('pendente', 'aprovado')
);

-- Criar função que atualiza status do pagamento quando nota é inserida
CREATE OR REPLACE FUNCTION public.atualizar_status_pagamento_ao_receber_nota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando uma nota é inserida, atualizar o pagamento para 'nota_recebida'
  UPDATE public.pagamentos
  SET 
    status = 'nota_recebida',
    data_resposta = COALESCE(data_resposta, NOW())
  WHERE id = NEW.pagamento_id
    AND status = 'solicitado';
  
  RETURN NEW;
END;
$$;

-- Criar trigger que executa a função após inserção na tabela notas_medicos
DROP TRIGGER IF EXISTS trigger_atualizar_status_pagamento ON public.notas_medicos;

CREATE TRIGGER trigger_atualizar_status_pagamento
  AFTER INSERT ON public.notas_medicos
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_status_pagamento_ao_receber_nota();