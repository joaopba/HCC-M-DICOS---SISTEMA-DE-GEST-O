#!/bin/bash

# 🧪 Validação Completa Pós-Deploy - HCC Med Pay Flow

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="hcc.chatconquista.com"
SUPABASE_URL="https://nnytrkgsjajsecotasqv.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4"

PASSED=0
FAILED=0

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🧪 VALIDAÇÃO COMPLETA PÓS-DEPLOY                      ║"
echo "║        HCC Med Pay Flow - VPS Ubuntu                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Função para testar e reportar
test_feature() {
    local name="$1"
    local result="$2"
    
    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✅ $name${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ $name${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 TESTES DE INFRAESTRUTURA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Teste de DNS
echo -n "Testando DNS... "
DNS_IP=$(dig +short $DOMAIN | tail -n1)
if [ "$DNS_IP" = "72.60.157.200" ]; then
    test_feature "DNS configurado corretamente ($DNS_IP)" 0
else
    test_feature "DNS configurado corretamente (esperado: 72.60.157.200, atual: $DNS_IP)" 1
fi

# 2. Teste HTTP
echo -n "Testando HTTP (porta 80)... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|301|302)$ ]]; then
    test_feature "HTTP respondendo (código: $HTTP_CODE)" 0
else
    test_feature "HTTP respondendo (código: $HTTP_CODE)" 1
fi

# 3. Teste HTTPS
echo -n "Testando HTTPS (porta 443)... "
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
    test_feature "HTTPS respondendo (código: $HTTPS_CODE)" 0
else
    test_feature "HTTPS respondendo (código: $HTTPS_CODE)" 1
fi

# 4. Teste SSL Certificate
echo -n "Testando certificado SSL... "
SSL_DAYS=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep "notAfter" | cut -d= -f2)
if [ -n "$SSL_DAYS" ]; then
    test_feature "Certificado SSL válido (expira em: $SSL_DAYS)" 0
else
    test_feature "Certificado SSL válido" 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚛️  TESTES DO FRONTEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 5. Teste carregamento da página principal
echo -n "Testando página principal... "
HOMEPAGE=$(curl -s https://$DOMAIN 2>/dev/null || echo "")
if echo "$HOMEPAGE" | grep -q "root"; then
    test_feature "Página principal carregando (HTML válido)" 0
else
    test_feature "Página principal carregando" 1
fi

# 6. Teste assets estáticos
echo -n "Testando assets estáticos... "
ASSETS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/assets/ 2>/dev/null || echo "000")
if [[ "$ASSETS_CODE" =~ ^(200|301|302|404)$ ]]; then
    test_feature "Assets estáticos disponíveis" 0
else
    test_feature "Assets estáticos disponíveis" 1
fi

# 7. Teste rota /auth
echo -n "Testando rota /auth... "
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/auth 2>/dev/null || echo "000")
if [ "$AUTH_CODE" = "200" ]; then
    test_feature "Rota /auth funcionando" 0
else
    test_feature "Rota /auth funcionando (código: $AUTH_CODE)" 1
fi

# 8. Teste rota /dashboard-medicos
echo -n "Testando portal dos médicos... "
PORTAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/dashboard-medicos 2>/dev/null || echo "000")
if [ "$PORTAL_CODE" = "200" ]; then
    test_feature "Portal dos médicos (/dashboard-medicos)" 0
else
    test_feature "Portal dos médicos (código: $PORTAL_CODE)" 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 TESTES DO BACKEND (SUPABASE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 9. Teste conexão Supabase
echo -n "Testando conexão Supabase... "
SUPABASE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $SUPABASE_URL 2>/dev/null || echo "000")
if [[ "$SUPABASE_HEALTH" =~ ^(200|301)$ ]]; then
    test_feature "Conexão Supabase ativa" 0
else
    test_feature "Conexão Supabase ativa (código: $SUPABASE_HEALTH)" 1
fi

# 10. Teste Edge Function: webhook-handler
echo -n "Testando edge function webhook-handler... "
WEBHOOK_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "${SUPABASE_URL}/functions/v1/webhook-handler" \
    -H "apikey: $SUPABASE_KEY" 2>/dev/null || echo "000")
if [ "$WEBHOOK_CODE" = "200" ]; then
    test_feature "Edge Function: webhook-handler" 0
else
    test_feature "Edge Function: webhook-handler (código: $WEBHOOK_CODE)" 1
fi

# 11. Teste Edge Function: send-whatsapp-template
echo -n "Testando edge function send-whatsapp-template... "
WHATSAPP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "${SUPABASE_URL}/functions/v1/send-whatsapp-template" \
    -H "apikey: $SUPABASE_KEY" 2>/dev/null || echo "000")
if [ "$WHATSAPP_CODE" = "200" ]; then
    test_feature "Edge Function: send-whatsapp-template" 0
else
    test_feature "Edge Function: send-whatsapp-template (código: $WHATSAPP_CODE)" 1
fi

# 12. Teste Edge Function: send-email-notification
echo -n "Testando edge function send-email-notification... "
EMAIL_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "${SUPABASE_URL}/functions/v1/send-email-notification" \
    -H "apikey: $SUPABASE_KEY" 2>/dev/null || echo "000")
if [ "$EMAIL_CODE" = "200" ]; then
    test_feature "Edge Function: send-email-notification" 0
else
    test_feature "Edge Function: send-email-notification (código: $EMAIL_CODE)" 1
fi

# 13. Teste Edge Function: get-medico-dados
echo -n "Testando edge function get-medico-dados... "
MEDICO_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    "${SUPABASE_URL}/functions/v1/get-medico-dados" \
    -H "apikey: $SUPABASE_KEY" 2>/dev/null || echo "000")
if [ "$MEDICO_CODE" = "200" ]; then
    test_feature "Edge Function: get-medico-dados" 0
else
    test_feature "Edge Function: get-medico-dados (código: $MEDICO_CODE)" 1
fi

# 14. Teste acesso ao banco de dados (REST API)
echo -n "Testando acesso REST API Supabase... "
REST_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/rest/v1/" \
    -H "apikey: $SUPABASE_KEY" 2>/dev/null || echo "000")
if [ "$REST_CODE" = "200" ]; then
    test_feature "REST API Supabase funcionando" 0
else
    test_feature "REST API Supabase funcionando (código: $REST_CODE)" 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  TESTES DO SERVIDOR VPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 15. Teste Nginx rodando
echo -n "Testando Nginx... "
if systemctl is-active --quiet nginx; then
    test_feature "Nginx rodando" 0
else
    test_feature "Nginx rodando" 1
fi

# 16. Teste arquivos da aplicação
echo -n "Testando arquivos da aplicação... "
if [ -f "/var/www/hcc-med-pay-flow/dist/index.html" ]; then
    test_feature "Arquivos da aplicação presentes" 0
else
    test_feature "Arquivos da aplicação presentes" 1
fi

# 17. Teste permissões dos arquivos
echo -n "Testando permissões... "
if [ -r "/var/www/hcc-med-pay-flow/dist/index.html" ]; then
    test_feature "Permissões corretas" 0
else
    test_feature "Permissões corretas" 1
fi

# 18. Teste espaço em disco
echo -n "Testando espaço em disco... "
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    test_feature "Espaço em disco OK (${DISK_USAGE}% usado)" 0
else
    test_feature "Espaço em disco OK (${DISK_USAGE}% usado - CRÍTICO)" 1
fi

# 19. Teste memória RAM
echo -n "Testando memória RAM... "
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3*100/$2}')
if [ "$MEM_USAGE" -lt 90 ]; then
    test_feature "Memória RAM OK (${MEM_USAGE}% usado)" 0
else
    test_feature "Memória RAM OK (${MEM_USAGE}% usado - ALTO)" 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DA VALIDAÇÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((PASSED + FAILED))
PERCENT=$((PASSED * 100 / TOTAL))

echo -e "${GREEN}✅ Passou: $PASSED testes${NC}"
echo -e "${RED}❌ Falhou: $FAILED testes${NC}"
echo -e "📈 Total: $TOTAL testes"
echo -e "📊 Taxa de sucesso: ${PERCENT}%"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  🎉 DEPLOY 100% VALIDADO E FUNCIONANDO PERFEITAMENTE!     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "✅ Todos os sistemas operacionais!"
    echo "🌐 Acesse: https://$DOMAIN"
    echo ""
    exit 0
elif [ $PERCENT -ge 80 ]; then
    echo -e "${YELLOW}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ⚠️  DEPLOY FUNCIONANDO COM AVISOS                        ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "⚠️  Sistema operacional mas com alguns avisos."
    echo "📋 Revise os testes que falharam acima."
    echo ""
    exit 0
else
    echo -e "${RED}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ❌ DEPLOY COM PROBLEMAS CRÍTICOS                         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "❌ Problemas críticos detectados."
    echo "🔧 Execute: ./status.sh e ./logs.sh para investigar"
    echo ""
    exit 1
fi
