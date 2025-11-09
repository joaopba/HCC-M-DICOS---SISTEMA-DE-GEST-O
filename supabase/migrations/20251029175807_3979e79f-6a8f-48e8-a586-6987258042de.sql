-- Adicionar política para permitir leitura pública de configurações
-- necessárias para o dashboard de médicos funcionar
CREATE POLICY "Public can read public configuration settings"
ON public.configuracoes
FOR SELECT
TO anon, authenticated
USING (true);