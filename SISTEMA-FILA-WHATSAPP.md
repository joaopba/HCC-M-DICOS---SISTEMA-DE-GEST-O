# Sistema de Fila WhatsApp - HCC Hospital

## 📋 Visão Geral

Sistema de filas implementado para controlar o envio de mensagens WhatsApp e evitar ban da API (WhatsApp Business API).

## 🎯 Características

### 1. **Fila de Mensagens**
- Todas as mensagens são adicionadas a uma fila antes do envio
- Processamento assíncrono controlado
- Sistema de prioridades (1=alta, 5=normal, 10=baixa)

### 2. **Rate Limiting**
- Limite padrão: **80 mensagens por minuto**
- Janela de controle de 1 minuto
- Previne sobrecarga da API do WhatsApp

### 3. **Retry com Backoff Exponencial**
- 3 tentativas automáticas por padrão
- Intervalo entre tentativas: 2^n minutos
  - 1ª falha: aguarda 2 minutos
  - 2ª falha: aguarda 4 minutos
  - 3ª falha: marca como falhou
- Mensagens falhas ficam registradas para análise

### 4. **Deduplicação**
- Previne envio de mensagens duplicadas
- Verificação de mensagens enviadas nos últimos 20 segundos

## 🏗️ Estrutura

### Tabelas

#### `whatsapp_queue`
Armazena as mensagens pendentes de envio.

```sql
- id: UUID (PK)
- numero_destino: TEXT
- tipo_mensagem: TEXT ('template', 'text', 'notification')
- payload: JSONB (conteúdo da mensagem)
- prioridade: INTEGER (1-10)
- tentativas: INTEGER
- max_tentativas: INTEGER (padrão: 3)
- proximo_envio: TIMESTAMP
- status: TEXT ('pendente', 'processando', 'enviado', 'falhou')
- erro_mensagem: TEXT
- enviado_em: TIMESTAMP
```

#### `whatsapp_rate_limit`
Controla o rate limiting por janela de tempo.

```sql
- id: UUID (PK)
- janela_tempo: TIMESTAMP (minuto atual)
- mensagens_enviadas: INTEGER
- limite_por_janela: INTEGER (padrão: 80)
```

### Edge Functions

#### `send-whatsapp-template`
**Modificada** para adicionar mensagens à fila ao invés de enviar diretamente.

#### `process-whatsapp-queue` (NOVA)
Processador de fila que deve ser executado periodicamente (recomendado: a cada 1 minuto).

**Funcionamento:**
1. Verifica rate limit
2. Busca até 10 mensagens pendentes (ordenadas por prioridade)
3. Envia cada mensagem
4. Atualiza status e incrementa rate limit
5. Em caso de erro, agenda retry com backoff

## 🚀 Configuração e Uso

### 1. Processar a Fila Manualmente

Você pode chamar a função diretamente:

```bash
curl -X POST https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/process-whatsapp-queue \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 2. Automatizar com Cron Job (Recomendado)

#### Opção A: Cron Job no VPS

Adicione ao crontab para executar a cada minuto:

```bash
crontab -e

# Adicionar linha:
* * * * * curl -X POST https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/process-whatsapp-queue -H "Authorization: Bearer YOUR_ANON_KEY" >> /var/log/whatsapp-queue.log 2>&1
```

#### Opção B: Serviço de Cron Online

Use serviços como:
- **cron-job.org** (gratuito)
- **EasyCron**
- **Zapier** (Schedule trigger)

Configure para chamar a URL da função a cada 1 minuto.

#### Opção C: GitHub Actions (se usar GitHub)

Crie `.github/workflows/process-queue.yml`:

```yaml
name: Process WhatsApp Queue
on:
  schedule:
    - cron: '* * * * *' # A cada minuto
  workflow_dispatch: # Permite execução manual

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Process Queue
        run: |
          curl -X POST https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/process-whatsapp-queue \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

### 3. Monitorar a Fila

Consultar mensagens pendentes:

```sql
SELECT 
  status,
  COUNT(*) as total,
  MIN(created_at) as mais_antiga,
  MAX(created_at) as mais_recente
FROM whatsapp_queue
GROUP BY status;
```

Ver mensagens com erro:

```sql
SELECT 
  numero_destino,
  tentativas,
  erro_mensagem,
  created_at
FROM whatsapp_queue
WHERE status = 'falhou'
ORDER BY created_at DESC
LIMIT 20;
```

### 4. Limpar Mensagens Antigas

Execute periodicamente (ex: semanalmente):

```sql
SELECT cleanup_old_whatsapp_queue();
```

Ou adicione ao cron:

```bash
# Toda segunda-feira às 3h
0 3 * * 1 psql $DATABASE_URL -c "SELECT cleanup_old_whatsapp_queue();"
```

## 📊 Monitoramento

### Métricas Importantes

1. **Taxa de envio atual**
```sql
SELECT 
  janela_tempo,
  mensagens_enviadas,
  limite_por_janela,
  ROUND((mensagens_enviadas::DECIMAL / limite_por_janela * 100), 2) as uso_percentual
FROM whatsapp_rate_limit
WHERE janela_tempo >= now() - interval '1 hour'
ORDER BY janela_tempo DESC;
```

2. **Taxa de sucesso**
```sql
SELECT 
  status,
  COUNT(*) as total,
  ROUND(COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100, 2) as percentual
FROM whatsapp_queue
WHERE created_at >= now() - interval '24 hours'
GROUP BY status;
```

3. **Tempo médio de processamento**
```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (enviado_em - created_at))) as tempo_medio_segundos
FROM whatsapp_queue
WHERE status = 'enviado'
  AND created_at >= now() - interval '24 hours';
```

## ⚙️ Ajustes e Otimização

### Alterar Rate Limit

Se precisar aumentar/diminuir o limite:

```sql
UPDATE whatsapp_rate_limit
SET limite_por_janela = 100 -- Novo limite
WHERE janela_tempo >= now();
```

### Alterar Prioridades

No código da aplicação, ao adicionar à fila:

```typescript
// Alta prioridade (solicitações de nota)
prioridade: 1

// Prioridade normal
prioridade: 5

// Baixa prioridade
prioridade: 10
```

### Ajustar Tentativas

```sql
-- Para mensagens específicas
UPDATE whatsapp_queue
SET max_tentativas = 5
WHERE tipo_mensagem = 'template';
```

## 🔒 Segurança

- ✅ RLS habilitado (apenas service role)
- ✅ Rate limiting ativo
- ✅ Logs de auditoria
- ✅ Retry com backoff exponencial

## 📈 Escalabilidade

O sistema está preparado para:
- ✅ **Alto volume**: Fila com processamento controlado
- ✅ **Rate limiting**: Previne ban da API
- ✅ **Retry automático**: Aumenta taxa de sucesso
- ✅ **Monitoramento**: Logs e métricas detalhadas
- ✅ **Priorização**: Mensagens críticas enviadas primeiro

## ⚠️ Importante

1. **SEMPRE** executar o processador periodicamente
2. **MONITORAR** a fila para evitar acúmulo
3. **AJUSTAR** rate limit conforme plano WhatsApp Business
4. **LIMPAR** mensagens antigas regularmente
5. **REVISAR** logs de falha semanalmente
