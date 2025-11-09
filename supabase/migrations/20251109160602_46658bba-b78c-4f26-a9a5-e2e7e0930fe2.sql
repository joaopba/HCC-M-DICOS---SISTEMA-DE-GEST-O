
-- Remove triggers duplicados da tabela notas_medicos
-- Mantém apenas os triggers com prefixo 'trg_'

DROP TRIGGER IF EXISTS trigger_notify_gestores_nova_nota ON notas_medicos;
DROP TRIGGER IF EXISTS trigger_atualizar_status_pagamento ON notas_medicos;
DROP TRIGGER IF EXISTS clean_rejected_notes_trigger ON notas_medicos;
