-- Limpar todas as sessões de médicos existentes
-- Forçando nova validação para todos
DELETE FROM public.sessoes_medico;

-- Limpar também códigos de verificação pendentes
DELETE FROM public.verificacao_medico;