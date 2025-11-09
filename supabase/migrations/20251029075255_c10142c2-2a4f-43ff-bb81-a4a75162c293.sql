-- Aumentar o tempo padrão de sessão para 30 dias (720 horas)
-- Isso permite que o dispositivo não precise autenticar novamente por um período muito maior
UPDATE configuracoes
SET verificacao_medico_duracao_sessao_horas = 720
WHERE verificacao_medico_duracao_sessao_horas = 24;