-- Adicionar suporte para número do contador e CNPJ nos médicos
ALTER TABLE public.medicos 
ADD COLUMN numero_whatsapp_contador text,
ADD COLUMN tipo_pessoa text DEFAULT 'CPF' CHECK (tipo_pessoa IN ('CPF', 'CNPJ'));

-- Renomear coluna cpf para documento (mais genérico)
ALTER TABLE public.medicos 
RENAME COLUMN cpf TO documento;

-- Adicionar campo para permitir ajuste de valor pelo gestor
ALTER TABLE public.notas_medicos
ADD COLUMN valor_ajustado numeric,
ADD COLUMN motivo_ajuste text,
ADD COLUMN ajustado_por uuid REFERENCES public.profiles(id),
ADD COLUMN ajustado_em timestamp with time zone;

-- Limpar dados de teste
TRUNCATE TABLE public.notas_medicos CASCADE;
TRUNCATE TABLE public.pagamentos CASCADE;
TRUNCATE TABLE public.disparos_notas CASCADE;
TRUNCATE TABLE public.message_logs CASCADE;