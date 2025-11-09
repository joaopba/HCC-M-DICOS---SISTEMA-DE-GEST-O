# Guia de Setup Multi-Tenant para Portal de Médicos

Este documento explica como configurar múltiplas instâncias do Portal de Médicos HCC para revenda (white-label) na sua VPS.

## Arquitetura Recomendada

### 1. Separação de Instâncias

Cada cliente terá:
- **Subdomínio único**: `cliente1.seudominio.com`, `cliente2.seudominio.com`
- **Banco de dados isolado**: Instância Supabase separada ou schema PostgreSQL isolado
- **Webhook dedicado**: Endpoint exclusivo para integração WhatsApp
- **Customização visual**: Logo, cores, domínio personalizado

### 2. Opções de Implementação

#### Opção A: Supabase Multi-Project (Recomendado para Poucos Clientes)

```bash
# Estrutura de diretórios
/var/www/
├── cliente1/
│   ├── frontend/          # Build do React com env vars do cliente1
│   ├── .env.production
│   └── supabase/          # Project ID e keys do Supabase do cliente1
├── cliente2/
│   ├── frontend/
│   ├── .env.production
│   └── supabase/
```

**Vantagens:**
- Isolamento total entre clientes
- Cada um pode ter seu próprio plano Supabase
- Migração/backup independente

**Desvantagens:**
- Custo maior (um projeto Supabase por cliente)
- Mais complexo de gerenciar

#### Opção B: Schema Isolation em PostgreSQL (Recomendado para Muitos Clientes)

Usar um único Supabase mas com schemas separados:

```sql
-- Para cada novo cliente
CREATE SCHEMA cliente1;
CREATE SCHEMA cliente2;

-- Criar tabelas em cada schema
CREATE TABLE cliente1.medicos (...);
CREATE TABLE cliente1.pagamentos (...);

CREATE TABLE cliente2.medicos (...);
CREATE TABLE cliente2.pagamentos (...);
```

**Vantagens:**
- Um único projeto Supabase
- Mais econômico
- Gerenciamento centralizado

**Desvantagens:**
- Todos os clientes no mesmo projeto
- Precisa garantir isolamento na aplicação

## Setup Passo a Passo

### 1. Preparar Ambiente VPS

```bash
# Instalar dependências
sudo apt update
sudo apt install -y nginx nodejs npm postgresql-client git

# Instalar PM2 para gerenciar processos
npm install -g pm2
```

### 2. Estrutura de Diretórios

```bash
# Criar estrutura base
mkdir -p /var/www/portal-medicos
cd /var/www/portal-medicos

# Para cada cliente
mkdir -p clientes/cliente1/{frontend,config}
mkdir -p clientes/cliente2/{frontend,config}
```

### 3. Build Customizado por Cliente

Crie um script para build de cada cliente:

```bash
#!/bin/bash
# build-client.sh

CLIENT_NAME=$1
CLIENT_DOMAIN=$2
SUPABASE_URL=$3
SUPABASE_KEY=$4

cd /var/www/portal-medicos/clientes/$CLIENT_NAME

# Clone do repositório (ou use git pull se já existir)
git clone <seu-repo> frontend 2>/dev/null || (cd frontend && git pull)

cd frontend

# Configurar variáveis de ambiente
cat > .env.production << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_KEY
VITE_APP_TITLE="Portal $CLIENT_NAME"
VITE_CLIENT_NAME=$CLIENT_NAME
EOF

# Build
npm install
npm run build

# Copiar build para pasta de servir
rm -rf /var/www/$CLIENT_DOMAIN
cp -r dist /var/www/$CLIENT_DOMAIN
```

### 4. Configurar Nginx por Cliente

```nginx
# /etc/nginx/sites-available/cliente1.seudominio.com

server {
    listen 80;
    server_name cliente1.seudominio.com;
    
    root /var/www/cliente1.seudominio.com;
    index index.html;
    
    # Logs separados por cliente
    access_log /var/log/nginx/cliente1-access.log;
    error_log /var/log/nginx/cliente1-error.log;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Webhook dedicado (se usar backend Node próprio)
    location /webhook {
        proxy_pass http://localhost:3001; # Porta exclusiva cliente1
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Configurar SSL

```bash
# Instalar certbot
sudo apt install certbot python3-certbot-nginx

# Para cada cliente
sudo certbot --nginx -d cliente1.seudominio.com
sudo certbot --nginx -d cliente2.seudominio.com
```

### 6. Setup do Banco de Dados

#### Opção A: Supabase Separado

1. Criar projeto no Supabase para cada cliente
2. Executar migrations em cada projeto
3. Configurar env vars com credenciais específicas

#### Opção B: Schema Isolation

```sql
-- Script: setup-new-client.sql
DO $$
DECLARE
    client_schema TEXT := 'cliente1';
BEGIN
    -- Criar schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', client_schema);
    
    -- Criar tabelas
    EXECUTE format('
        CREATE TABLE %I.medicos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nome TEXT NOT NULL,
            numero_whatsapp TEXT UNIQUE NOT NULL,
            documento TEXT UNIQUE,
            especialidade TEXT,
            tipo_pessoa TEXT DEFAULT ''CPF'',
            ativo BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )', client_schema);
    
    EXECUTE format('
        CREATE TABLE %I.pagamentos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            medico_id UUID REFERENCES %I.medicos(id),
            mes_competencia TEXT NOT NULL,
            valor NUMERIC NOT NULL,
            valor_liquido NUMERIC,
            status TEXT DEFAULT ''pendente'',
            data_solicitacao TIMESTAMPTZ,
            data_resposta TIMESTAMPTZ,
            data_pagamento TIMESTAMPTZ,
            observacoes TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )', client_schema, client_schema);
    
    -- RLS policies
    EXECUTE format('ALTER TABLE %I.medicos ENABLE ROW LEVEL SECURITY', client_schema);
    EXECUTE format('ALTER TABLE %I.pagamentos ENABLE ROW LEVEL SECURITY', client_schema);
END $$;
```

### 7. Customização Visual

Crie um arquivo de configuração por cliente:

```typescript
// config/cliente1.ts
export const clientConfig = {
  name: 'Clínica ABC',
  logo: '/logos/cliente1-logo.png',
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
  },
  domain: 'cliente1.seudominio.com',
  whatsappConfig: {
    apiUrl: process.env.WHATSAPP_API_URL,
    token: process.env.WHATSAPP_TOKEN,
  }
};
```

Modifique o código para ler essas configs:

```typescript
// src/lib/client-config.ts
import { clientConfig } from '@/../config/current-client';

export const getClientConfig = () => {
  return clientConfig;
};
```

### 8. Webhook Dedicado

Para cada cliente, configure um webhook handler separado:

```typescript
// supabase/functions/webhook-cliente1/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const CLIENT_SCHEMA = 'cliente1';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    {
      db: { schema: CLIENT_SCHEMA } // Usar schema específico
    }
  );
  
  // Lógica do webhook...
});
```

### 9. Deploy Automatizado

Crie um script de deploy:

```bash
#!/bin/bash
# deploy-client.sh

CLIENT_NAME=$1

echo "Deploying $CLIENT_NAME..."

# Pull código atualizado
cd /var/www/portal-medicos/source
git pull

# Build cliente
./build-client.sh $CLIENT_NAME <domain> <supabase-url> <supabase-key>

# Reiniciar Nginx
sudo systemctl reload nginx

# Deploy edge functions
cd supabase/functions
supabase functions deploy webhook-$CLIENT_NAME --project-ref <project-id>

echo "✅ Deploy concluído para $CLIENT_NAME"
```

### 10. Monitoramento

Configure monitoramento por cliente:

```bash
# PM2 Ecosystem para múltiplos clientes
# ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'webhook-cliente1',
      script: 'supabase/functions/webhook-cliente1/index.ts',
      instances: 1,
      env: {
        CLIENT_NAME: 'cliente1',
        SUPABASE_URL: process.env.CLIENTE1_SUPABASE_URL
      }
    },
    {
      name: 'webhook-cliente2',
      script: 'supabase/functions/webhook-cliente2/index.ts',
      instances: 1,
      env: {
        CLIENT_NAME: 'cliente2',
        SUPABASE_URL: process.env.CLIENTE2_SUPABASE_URL
      }
    }
  ]
};
```

## Considerações de Segurança

1. **Isolamento de Dados**: Sempre use RLS policies e valide tenant_id
2. **Logs Separados**: Mantenha logs separados por cliente
3. **Backups**: Configure backup automático por cliente
4. **Rate Limiting**: Configure limites por cliente no Nginx

```nginx
# Rate limiting por cliente
limit_req_zone $server_name zone=cliente1:10m rate=10r/s;
limit_req_zone $server_name zone=cliente2:10m rate=10r/s;
```

## Custos Estimados

### Opção A (Supabase Separado)
- Free tier: até 2 clientes grátis
- Pro ($25/mês): 2-10 clientes por projeto
- VPS: $20-50/mês (4GB RAM, 2 CPU)

### Opção B (Schema Isolation)
- Supabase Pro: $25/mês (até 100 clientes)
- VPS: $50-100/mês (8GB RAM, 4 CPU)

## Próximos Passos

1. Escolher arquitetura (A ou B)
2. Preparar VPS com scripts de automação
3. Criar template de cliente base
4. Configurar CI/CD para deploys
5. Documentar processo de onboarding de novo cliente

## Suporte

Para dúvidas sobre setup multi-tenant, consulte:
- Documentação Supabase: https://supabase.com/docs
- Nginx Multi-Tenant: https://www.nginx.com/blog/
