-- Atualizar pagamentos que têm notas pendentes mas não estão marcados como nota_recebida
UPDATE pagamentos 
SET status = 'nota_recebida', 
    data_resposta = COALESCE(data_resposta, now())
WHERE id IN (
  SELECT DISTINCT p.id 
  FROM pagamentos p
  INNER JOIN notas_medicos nm ON p.id = nm.pagamento_id
  WHERE nm.status = 'pendente' 
  AND p.status NOT IN ('nota_recebida', 'pago')
);

-- Atualizar a nota_pdf_url para pagamentos que têm notas mas não têm a URL definida
UPDATE pagamentos 
SET nota_pdf_url = nm.arquivo_url
FROM notas_medicos nm
WHERE pagamentos.id = nm.pagamento_id
AND pagamentos.nota_pdf_url IS NULL
AND nm.status IN ('pendente', 'aprovado');