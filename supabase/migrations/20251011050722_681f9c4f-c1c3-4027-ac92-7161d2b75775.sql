-- Deletar notas relacionadas ao pagamento
DELETE FROM notas_medicos WHERE pagamento_id = '6c67840b-cf46-4ea1-9d4e-2f75eb43b515';

-- Deletar o pagamento
DELETE FROM pagamentos WHERE id = '6c67840b-cf46-4ea1-9d4e-2f75eb43b515';