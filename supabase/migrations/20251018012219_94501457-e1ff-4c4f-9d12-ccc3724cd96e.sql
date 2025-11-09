-- Inserir registro em notas_medicos para casos onde o pagamento tem PDF mas não tem registro
INSERT INTO public.notas_medicos (medico_id, pagamento_id, arquivo_url, nome_arquivo, status)
SELECT 
  p.medico_id,
  p.id,
  p.nota_pdf_url,
  CASE 
    WHEN p.nota_pdf_url LIKE '%blob%' THEN substring(p.nota_pdf_url from '[^/]+\.pdf')
    ELSE 'nota_fiscal.pdf'
  END,
  'pendente'
FROM public.pagamentos p
LEFT JOIN public.notas_medicos nm ON nm.pagamento_id = p.id
WHERE p.nota_pdf_url IS NOT NULL 
  AND p.status IN ('nota_recebida', 'solicitado')
  AND nm.id IS NULL
ON CONFLICT DO NOTHING;