-- Ensure triggers exist for business logic and auditing
-- Drop existing triggers to avoid duplicates
DROP TRIGGER IF EXISTS trg_notify_gestores_nova_nota ON public.notas_medicos;
DROP TRIGGER IF EXISTS trg_clean_rejected_notes ON public.notas_medicos;
DROP TRIGGER IF EXISTS trg_atualizar_status_pagamento_ao_receber_nota ON public.notas_medicos;
DROP TRIGGER IF EXISTS update_notas_medicos_updated_at ON public.notas_medicos;
DROP TRIGGER IF EXISTS update_pagamentos_updated_at ON public.pagamentos;

-- Trigger: Notify gestores automatically when a new nota pendente is inserted
CREATE TRIGGER trg_notify_gestores_nova_nota
AFTER INSERT ON public.notas_medicos
FOR EACH ROW
EXECUTE FUNCTION public.notify_gestores_on_nota_insert();

-- Trigger: Clean rejected notes for the same pagamento when a new pending nota is inserted
CREATE TRIGGER trg_clean_rejected_notes
AFTER INSERT ON public.notas_medicos
FOR EACH ROW
EXECUTE FUNCTION public.clean_rejected_notes();

-- Trigger: Update pagamento status when a nota is received
CREATE TRIGGER trg_atualizar_status_pagamento_ao_receber_nota
AFTER INSERT ON public.notas_medicos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_status_pagamento_ao_receber_nota();

-- Audit triggers to maintain updated_at timestamps
CREATE TRIGGER update_notas_medicos_updated_at
BEFORE UPDATE ON public.notas_medicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pagamentos_updated_at
BEFORE UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();