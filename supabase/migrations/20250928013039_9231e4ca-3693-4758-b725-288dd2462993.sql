-- Criar enum para tipos de usuário
CREATE TYPE public.user_role AS ENUM ('gestor', 'usuario');

-- Criar enum para status de pagamento
CREATE TYPE public.payment_status AS ENUM ('pendente', 'solicitado', 'nota_recebida', 'pago');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'usuario',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de médicos
CREATE TABLE public.medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  numero_whatsapp TEXT NOT NULL,
  especialidade TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pagamentos mensais
CREATE TABLE public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  mes_competencia TEXT NOT NULL, -- formato YYYY-MM
  valor DECIMAL(10,2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pendente',
  data_solicitacao TIMESTAMP WITH TIME ZONE,
  data_resposta TIMESTAMP WITH TIME ZONE,
  data_pagamento TIMESTAMP WITH TIME ZONE,
  valor_liquido DECIMAL(10,2),
  nota_pdf_url TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(medico_id, mes_competencia)
);

-- Tabela de configurações do sistema
CREATE TABLE public.configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_url TEXT NOT NULL DEFAULT 'https://api.hcchospital.com.br/v2/api/external/43e14118-b615-419a-b827-23480915ddcb',
  auth_token TEXT NOT NULL,
  webhook_url TEXT,
  email_notificacoes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de mensagens
CREATE TABLE public.message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id UUID NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'solicitacao' ou 'pagamento'
  payload JSONB NOT NULL,
  response JSONB,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para médicos (apenas usuários autenticados)
CREATE POLICY "Authenticated users can view medicos" ON public.medicos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage medicos" ON public.medicos
FOR ALL TO authenticated USING (true);

-- Políticas RLS para pagamentos (apenas usuários autenticados)
CREATE POLICY "Authenticated users can view pagamentos" ON public.pagamentos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pagamentos" ON public.pagamentos
FOR ALL TO authenticated USING (true);

-- Políticas RLS para configurações (apenas usuários autenticados)
CREATE POLICY "Authenticated users can view configuracoes" ON public.configuracoes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage configuracoes" ON public.configuracoes
FOR ALL TO authenticated USING (true);

-- Políticas RLS para message_logs (apenas usuários autenticados)
CREATE POLICY "Authenticated users can view message_logs" ON public.message_logs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage message_logs" ON public.message_logs
FOR ALL TO authenticated USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medicos_updated_at
  BEFORE UPDATE ON public.medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 
    NEW.email,
    'usuario'
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inserir configuração padrão
INSERT INTO public.configuracoes (auth_token) 
VALUES ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MywicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoyLCJpYXQiOjE3NTgxMjkzMjMsImV4cCI6MTgyMTIwMTMyM30.dEvjbe3ZYLkFn3Bx7N8uKcsw34ZOJoCApJRgAAMmW2w');

-- Criar bucket para armazenar arquivos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('notas', 'notas', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprovantes', 'comprovantes', false);

-- Políticas de storage para notas
CREATE POLICY "Authenticated users can upload notas" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notas');

CREATE POLICY "Authenticated users can view notas" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'notas');

-- Políticas de storage para comprovantes
CREATE POLICY "Authenticated users can upload comprovantes" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "Authenticated users can view comprovantes" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes');