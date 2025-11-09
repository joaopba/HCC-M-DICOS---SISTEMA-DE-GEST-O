-- Corrigir política RLS para permitir inserção de médicos
DROP POLICY IF EXISTS "Gestores podem gerenciar médicos da sua empresa" ON public.medicos;

-- Criar política separada para INSERT com WITH CHECK correto
CREATE POLICY "Gestores podem inserir médicos da sua empresa" 
ON public.medicos
FOR INSERT
WITH CHECK (
  (empresa_id = get_user_empresa_id() OR is_super_admin())
);

-- Criar política para UPDATE
CREATE POLICY "Gestores podem atualizar médicos da sua empresa" 
ON public.medicos
FOR UPDATE
USING (empresa_id = get_user_empresa_id() OR is_super_admin())
WITH CHECK (empresa_id = get_user_empresa_id() OR is_super_admin());

-- Criar política para DELETE
CREATE POLICY "Gestores podem deletar médicos da sua empresa" 
ON public.medicos
FOR DELETE
USING (empresa_id = get_user_empresa_id() OR is_super_admin());