-- Corrigir status do pagamento que foi marcado incorretamente como 'pago'
-- Ele deve estar como 'nota_recebida' já que a nota foi aprovada mas o pagamento não foi efetivamente realizado
UPDATE public.pagamentos 
SET status = 'nota_recebida',
    data_pagamento = NULL
WHERE id = '43eacdfd-f956-4b2a-b8ed-cd11bbfb90a2';