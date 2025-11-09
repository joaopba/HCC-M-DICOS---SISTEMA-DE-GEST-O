-- Corrigir pagamentos marcados como 'pago' sem data de pagamento
UPDATE public.pagamentos
SET status = 'aprovado', data_pagamento = NULL
WHERE status = 'pago' AND data_pagamento IS NULL;