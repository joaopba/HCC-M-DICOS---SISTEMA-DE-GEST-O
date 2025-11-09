-- Adicionar 'nota_pendente' aos tipos permitidos em disparos_notas
ALTER TABLE public.disparos_notas
DROP CONSTRAINT IF EXISTS disparos_notas_tipo_check;

ALTER TABLE public.disparos_notas
ADD CONSTRAINT disparos_notas_tipo_check 
CHECK (tipo = ANY (ARRAY['nota'::text, 'pagamento'::text, 'manual'::text, 'nota_pendente'::text]));