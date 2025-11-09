-- Habilitar Row Level Security e realtime nas tabelas necessárias
ALTER TABLE public.pagamentos REPLICA IDENTITY FULL;
ALTER TABLE public.notas_medicos REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação de realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;