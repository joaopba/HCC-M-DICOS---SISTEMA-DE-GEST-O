-- Deletar registros de tabelas relacionadas primeiro (para evitar problemas de foreign key)
DELETE FROM disparos_notas 
WHERE pagamento_id IN (
  SELECT id FROM pagamentos WHERE mes_competencia != '2025-09'
);

DELETE FROM message_logs 
WHERE pagamento_id IN (
  SELECT id FROM pagamentos WHERE mes_competencia != '2025-09'
);

-- Deletar notas relacionadas a pagamentos que não são de setembro/2025
DELETE FROM notas_medicos 
WHERE pagamento_id IN (
  SELECT id FROM pagamentos WHERE mes_competencia != '2025-09'
);

-- Deletar pagamentos que não são de setembro/2025
DELETE FROM pagamentos 
WHERE mes_competencia != '2025-09';