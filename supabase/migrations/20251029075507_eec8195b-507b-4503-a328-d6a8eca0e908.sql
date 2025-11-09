-- Redefinir o tempo de sessão padrão para 1 hora
UPDATE configuracoes
SET verificacao_medico_duracao_sessao_horas = 1
WHERE verificacao_medico_duracao_sessao_horas = 720;