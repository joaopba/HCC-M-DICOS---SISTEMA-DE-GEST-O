-- Adicionar campos para OCR NFS-e na tabela configuracoes
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS ocr_nfse_habilitado boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ocr_nfse_api_key text,
ADD COLUMN IF NOT EXISTS permitir_nota_via_whatsapp boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.configuracoes.ocr_nfse_habilitado IS 'Habilita/desabilita o sistema de OCR para NFS-e';
COMMENT ON COLUMN public.configuracoes.ocr_nfse_api_key IS 'Chave de API para o serviço de OCR NFS-e';
COMMENT ON COLUMN public.configuracoes.permitir_nota_via_whatsapp IS 'Permite/bloqueia upload de notas via WhatsApp';

-- Adicionar campos na tabela notas_medicos para armazenar dados do OCR
ALTER TABLE public.notas_medicos
ADD COLUMN IF NOT EXISTS numero_nota text,
ADD COLUMN IF NOT EXISTS valor_bruto numeric,
ADD COLUMN IF NOT EXISTS ocr_processado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ocr_resultado jsonb;

COMMENT ON COLUMN public.notas_medicos.numero_nota IS 'Número da nota fiscal extraído do OCR';
COMMENT ON COLUMN public.notas_medicos.valor_bruto IS 'Valor bruto da nota extraído do OCR';
COMMENT ON COLUMN public.notas_medicos.ocr_processado IS 'Indica se a nota foi processada pelo OCR';
COMMENT ON COLUMN public.notas_medicos.ocr_resultado IS 'Resultado completo do OCR em JSON';