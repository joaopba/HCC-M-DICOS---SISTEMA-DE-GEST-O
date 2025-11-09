# 🔗 Configuração do Webhook no Supabase

## 📋 Informações do Projeto

- **Projeto:** nnytrkgsjajsecotasqv
- **URL:** https://nnytrkgsjajsecotasqv.supabase.co
- **Service Role Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyMTc4NSwiZXhwIjoyMDc0NTk3Nzg1fQ.7k5dgbLpH56EIUNiJpER7-BFksUR7R11iOrNwiBDN24

## ⚙️ Passos para Configurar o Webhook

### 1. Acessar o Dashboard do Supabase
1. Acesse: https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto: **nnytrkgsjajsecotasqv**

### 2. Configurar a Edge Function
A Edge Function `webhook-handler` já está configurada no seu projeto e fará:
- Receber webhooks da API externa
- Processar dados de pagamentos
- Enviar notificações WhatsApp
- Registrar logs de debug

### 3. URL do Webhook
Sua URL de webhook para configurar na API externa é:
```
https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/webhook-handler
```

### 4. Configurar Secrets no Supabase

Acesse: **Settings > Edge Functions** e configure os seguintes secrets:

```env
SUPABASE_URL=https://nnytrkgsjajsecotasqv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyMTc4NSwiZXhwIjoyMDc0NTk3Nzg1fQ.7k5dgbLpH56EIUNiJpER7-BFksUR7R11iOrNwiBDN24
RESEND_API_KEY=re_SeuResendAPIKey  # Configure com sua chave do Resend
```

### 5. Configurar Redirect URLs (Autenticação)
Acesse: **Authentication > URL Configuration** e adicione:

**Site URL:**
```
https://seu-dominio.com
```

**Redirect URLs:**
```
https://hcc.chatconquista.com/**
https://hcc.chatconquista.com/auth/callback
```

### 6. Testar o Webhook

Use este comando para testar se o webhook está funcionando:

```bash
curl -X POST \
  https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/webhook-handler \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4" \
  -d '{
    "event_type": "payment_created",
    "data": {
      "medico_id": "test",
      "valor": "1000.00",
      "mes_competencia": "2024-01"
    }
  }'
```

## 📊 Edge Functions Disponíveis

Seu projeto tem as seguintes Edge Functions configuradas:

### 1. `webhook-handler`
- **URL:** `/functions/v1/webhook-handler`
- **Função:** Processar webhooks de pagamentos
- **Método:** POST

### 2. `send-whatsapp-template`
- **URL:** `/functions/v1/send-whatsapp-template`
- **Função:** Enviar mensagens WhatsApp
- **Método:** POST

### 3. `send-email-notification`
- **URL:** `/functions/v1/send-email-notification`
- **Função:** Enviar emails via Resend
- **Método:** POST

## 🔍 Monitoramento

### Ver Logs das Edge Functions
1. Acesse: **Edge Functions** no dashboard
2. Clique na function desejada
3. Vá na aba **Logs**

### Verificar Webhook Debug Logs
Os webhooks são automaticamente logados na tabela `webhook_debug_logs`. Você pode consultar via SQL Editor:

```sql
SELECT * FROM webhook_debug_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## 🔧 Configurações da API Externa

Configure na sua API externa para chamar o webhook:
- **URL:** `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/webhook-handler`
- **Método:** POST
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4`

## 🚀 Status das Funcionalidades

- ✅ Database configurado
- ✅ Edge Functions deployadas
- ✅ Webhook handler configurado
- ✅ WhatsApp integration pronta
- ✅ Email notifications prontas
- ✅ Row Level Security configurado
- ⚠️ Precisa configurar Resend API Key
- ⚠️ Precisa configurar URLs de redirect

---

**🎉 Após seguir estes passos, seu webhook estará totalmente funcional no Supabase!**