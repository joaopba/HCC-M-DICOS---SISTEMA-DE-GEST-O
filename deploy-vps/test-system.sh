#!/bin/bash

# 🧪 Teste Completo do Sistema - HCC Med Pay Flow

set -e

DOMAIN="hcc.chatconquista.com"
IP="72.60.157.200"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Função para teste
test_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [ "$result" = "pass" ]; then
        echo -e "${GREEN}✅ $test_name${NC}: $message"
        ((TESTS_PASSED++))
    elif [ "$result" = "fail" ]; then
        echo -e "${RED}❌ $test_name${NC}: $message"
        ((TESTS_FAILED++))
    else
        echo -e "${YELLOW}⚠️  $test_name${NC}: $message"
        ((TESTS_WARNING++))
    fi
}

clear
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║               🧪 TESTE COMPLETO DO SISTEMA                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. TESTES DE SISTEMA
echo -e "${BLUE}🖥️  TESTES DE SISTEMA${NC}"
echo "════════════════════════════════════════════════════════════════"

# Teste de uptime
uptime_minutes=$(awk '{print int($1/60)}' /proc/uptime)
if [ $uptime_minutes -gt 5 ]; then
    test_result "Uptime" "pass" "$uptime_minutes minutos"
else
    test_result "Uptime" "warning" "$uptime_minutes minutos (sistema recém reiniciado)"
fi

# Teste de memória
memory_usage=$(free | grep '^Mem:' | awk '{printf "%.1f", $3/$2 * 100.0}')
memory_usage_int=${memory_usage%.*}
if [ $memory_usage_int -lt 80 ]; then
    test_result "Memória RAM" "pass" "$memory_usage% em uso"
elif [ $memory_usage_int -lt 90 ]; then
    test_result "Memória RAM" "warning" "$memory_usage% em uso (alto)"
else
    test_result "Memória RAM" "fail" "$memory_usage% em uso (crítico)"
fi

# Teste de disco
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $disk_usage -lt 80 ]; then
    test_result "Espaço em disco" "pass" "$disk_usage% usado"
elif [ $disk_usage -lt 90 ]; then
    test_result "Espaço em disco" "warning" "$disk_usage% usado (alto)"
else
    test_result "Espaço em disco" "fail" "$disk_usage% usado (crítico)"
fi

echo ""

# 2. TESTES DE SERVIÇOS
echo -e "${BLUE}⚙️  TESTES DE SERVIÇOS${NC}"
echo "════════════════════════════════════════════════════════════════"

# Nginx
if systemctl is-active --quiet nginx; then
    test_result "Nginx" "pass" "Rodando"
else
    test_result "Nginx" "fail" "Parado"
fi

# UFW
if systemctl is-active --quiet ufw; then
    test_result "Firewall (UFW)" "pass" "Ativo"
else
    test_result "Firewall (UFW)" "warning" "Inativo"
fi

# Teste de configuração do Nginx
if nginx -t &>/dev/null; then
    test_result "Config Nginx" "pass" "Válida"
else
    test_result "Config Nginx" "fail" "Inválida"
fi

echo ""

# 3. TESTES DE REDE
echo -e "${BLUE}🌐 TESTES DE CONECTIVIDADE${NC}"
echo "════════════════════════════════════════════════════════════════"

# Teste DNS
dns_result=$(dig +short $DOMAIN 2>/dev/null)
if [ "$dns_result" = "$IP" ]; then
    test_result "DNS" "pass" "$DOMAIN → $IP"
elif [ -n "$dns_result" ]; then
    test_result "DNS" "warning" "$DOMAIN → $dns_result (esperado: $IP)"
else
    test_result "DNS" "fail" "Não resolvido"
fi

# Teste HTTP
http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" 2>/dev/null || echo "000")
if [[ "$http_code" =~ ^[23] ]]; then
    test_result "HTTP" "pass" "Status $http_code"
elif [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    test_result "HTTP" "pass" "Redirecionamento ($http_code)"
else
    test_result "HTTP" "fail" "Status $http_code"
fi

# Teste HTTPS
https_code=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
if [[ "$https_code" =~ ^2 ]]; then
    test_result "HTTPS" "pass" "Status $https_code"
else
    test_result "HTTPS" "warning" "Status $https_code"
fi

# Teste de portas
if ss -tulpn | grep -q ":80 "; then
    test_result "Porta 80" "pass" "Aberta"
else
    test_result "Porta 80" "fail" "Fechada"
fi

if ss -tulpn | grep -q ":443 "; then
    test_result "Porta 443" "pass" "Aberta"
else
    test_result "Porta 443" "warning" "Fechada (SSL pode não estar configurado)"
fi

echo ""

# 4. TESTES DE APLICAÇÃO
echo -e "${BLUE}🚀 TESTES DA APLICAÇÃO${NC}"
echo "════════════════════════════════════════════════════════════════"

# Verificar se diretório existe
if [ -d "/var/www/hcc-med-pay-flow" ]; then
    test_result "Diretório da app" "pass" "Existe"
else
    test_result "Diretório da app" "fail" "Não existe"
fi

# Verificar arquivo principal
if [ -f "/var/www/hcc-med-pay-flow/index.html" ]; then
    test_result "Index.html" "pass" "Existe"
else
    test_result "Index.html" "fail" "Não encontrado"
fi

# Verificar permissões
app_owner=$(stat -c '%U' /var/www/hcc-med-pay-flow 2>/dev/null || echo "unknown")
if [ "$app_owner" = "www-data" ]; then
    test_result "Permissões" "pass" "Corretas (www-data)"
else
    test_result "Permissões" "warning" "Owner: $app_owner (esperado: www-data)"
fi

# Teste de endpoint status
status_response=$(curl -s "http://$DOMAIN/status" 2>/dev/null || echo "")
if echo "$status_response" | grep -q "HCC\|OK"; then
    test_result "Endpoint /status" "pass" "Respondendo"
else
    test_result "Endpoint /status" "fail" "Não responde corretamente"
fi

echo ""

# 5. TESTES DE SSL
echo -e "${BLUE}🔒 TESTES DE SSL${NC}"
echo "════════════════════════════════════════════════════════════════"

# Verificar se certificado existe
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    test_result "Certificado SSL" "pass" "Instalado"
    
    # Verificar validade
    exp_date=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    if [ ! -z "$exp_date" ]; then
        exp_timestamp=$(date -d "$exp_date" +%s 2>/dev/null)
        now_timestamp=$(date +%s)
        days_left=$(( (exp_timestamp - now_timestamp) / 86400 ))
        
        if [ $days_left -gt 30 ]; then
            test_result "Validade SSL" "pass" "$days_left dias restantes"
        elif [ $days_left -gt 7 ]; then
            test_result "Validade SSL" "warning" "$days_left dias restantes"
        else
            test_result "Validade SSL" "fail" "$days_left dias restantes"
        fi
    fi
else
    test_result "Certificado SSL" "warning" "Não encontrado"
fi

# Teste SSL online
ssl_test=$(echo | timeout 5 openssl s_client -connect $DOMAIN:443 2>/dev/null | grep "Verify return code" | grep "0 (ok)" || echo "failed")
if [ "$ssl_test" != "failed" ]; then
    test_result "Conexão SSL" "pass" "Válida"
else
    test_result "Conexão SSL" "warning" "Problema na verificação"
fi

echo ""

# 6. TESTES DE PERFORMANCE
echo -e "${BLUE}⚡ TESTES DE PERFORMANCE${NC}"
echo "════════════════════════════════════════════════════════════════"

# Teste de tempo de resposta HTTP
if command -v curl >/dev/null 2>&1; then
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "http://$DOMAIN" 2>/dev/null || echo "0")
    response_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d. -f1 || echo "0")
    
    if [ $response_ms -lt 500 ]; then
        test_result "Tempo resposta HTTP" "pass" "${response_ms}ms"
    elif [ $response_ms -lt 2000 ]; then
        test_result "Tempo resposta HTTP" "warning" "${response_ms}ms (lento)"
    else
        test_result "Tempo resposta HTTP" "fail" "${response_ms}ms (muito lento)"
    fi
fi

# Load average
load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
load_int=$(echo "$load_avg" | cut -d. -f1)
if [ $load_int -lt 2 ]; then
    test_result "Load Average" "pass" "$load_avg"
elif [ $load_int -lt 4 ]; then
    test_result "Load Average" "warning" "$load_avg (alto)"
else
    test_result "Load Average" "fail" "$load_avg (crítico)"
fi

echo ""

# 7. TESTES DE LOGS
echo -e "${BLUE}📋 TESTES DE LOGS${NC}"
echo "════════════════════════════════════════════════════════════════"

# Verificar se logs existem
if [ -f "/var/log/nginx/hcc-app.access.log" ]; then
    log_size=$(du -h /var/log/nginx/hcc-app.access.log | cut -f1)
    test_result "Log de acesso" "pass" "Existe ($log_size)"
else
    test_result "Log de acesso" "warning" "Não encontrado"
fi

if [ -f "/var/log/nginx/hcc-app.error.log" ]; then
    error_count=$(wc -l < /var/log/nginx/hcc-app.error.log 2>/dev/null || echo "0")
    if [ $error_count -eq 0 ]; then
        test_result "Log de erro" "pass" "Sem erros"
    elif [ $error_count -lt 10 ]; then
        test_result "Log de erro" "warning" "$error_count erros"
    else
        test_result "Log de erro" "fail" "$error_count erros"
    fi
else
    test_result "Log de erro" "warning" "Não encontrado"
fi

echo ""

# RESUMO FINAL
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    📊 RESUMO DOS TESTES                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

total_tests=$((TESTS_PASSED + TESTS_FAILED + TESTS_WARNING))
echo -e "🧪 Total de testes: $total_tests"
echo -e "${GREEN}✅ Passaram: $TESTS_PASSED${NC}"
echo -e "${YELLOW}⚠️  Avisos: $TESTS_WARNING${NC}"
echo -e "${RED}❌ Falharam: $TESTS_FAILED${NC}"
echo ""

# Status geral
if [ $TESTS_FAILED -eq 0 ]; then
    if [ $TESTS_WARNING -eq 0 ]; then
        echo -e "${GREEN}🎉 SISTEMA PERFEITO! Todos os testes passaram.${NC}"
        status_emoji="🟢"
    else
        echo -e "${YELLOW}✅ SISTEMA OK com alguns avisos menores.${NC}"
        status_emoji="🟡"
    fi
else
    echo -e "${RED}⚠️ SISTEMA COM PROBLEMAS que precisam ser corrigidos.${NC}"
    status_emoji="🔴"
fi

echo ""
echo -e "${BLUE}🔗 Links para teste:${NC}"
echo "• Site: https://$DOMAIN"
echo "• Status: https://$DOMAIN/status"
echo "• Health: https://$DOMAIN/health"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${YELLOW}🔧 Para resolver problemas:${NC}"
    echo "• Ver status: ./status.sh"
    echo "• Ver logs: ./logs.sh error"
    echo "• Reiniciar: ./restart.sh"
fi

echo ""
echo "$status_emoji Sistema testado em: $(date '+%d/%m/%Y às %H:%M:%S')"