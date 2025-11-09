#!/bin/bash

# 📊 Verificação de Status Completo - HCC Med Pay Flow

DOMAIN="hcc.chatconquista.com"
APP_DIR="/var/www/hcc-med-pay-flow"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                📊 STATUS DO SISTEMA HCC                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Informações do Sistema
echo -e "${BLUE}🖥️  SISTEMA${NC}"
echo "   • Servidor: $(hostname)"
echo "   • Uptime: $(uptime -p)"
echo "   • Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "   • Memória: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "   • Disco: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " usado)"}')"
echo ""

# 2. Status dos Serviços
echo -e "${BLUE}⚙️  SERVIÇOS${NC}"
services=("nginx" "ufw")
for service in "${services[@]}"; do
    if systemctl is-active --quiet $service; then
        echo -e "   • $service: ${GREEN}✅ Ativo${NC}"
    else
        echo -e "   • $service: ${RED}❌ Inativo${NC}"
    fi
done
echo ""

# 3. Status da Aplicação
echo -e "${BLUE}🚀 APLICAÇÃO${NC}"
if [ -d "$APP_DIR" ]; then
    echo -e "   • Diretório: ${GREEN}✅ Existe${NC}"
    if [ -f "$APP_DIR/index.html" ]; then
        echo -e "   • Index.html: ${GREEN}✅ Existe${NC}"
    else
        echo -e "   • Index.html: ${RED}❌ Não encontrado${NC}"
    fi
    
    # Info do deploy
    if [ -f "$APP_DIR/deploy-info.json" ]; then
        deploy_time=$(cat $APP_DIR/deploy-info.json | grep deployed_at | cut -d'"' -f4)
        echo "   • Último deploy: $(date -d "$deploy_time" '+%d/%m/%Y às %H:%M' 2>/dev/null || echo 'N/A')"
    fi
    
    # Tamanho
    size=$(du -sh $APP_DIR 2>/dev/null | cut -f1)
    echo "   • Tamanho: $size"
else
    echo -e "   • Diretório: ${RED}❌ Não existe${NC}"
fi
echo ""

# 4. Status da Rede
echo -e "${BLUE}🌐 CONECTIVIDADE${NC}"

# Verificar portas
if ss -tulpn | grep -q ":80 "; then
    echo -e "   • Porta 80 (HTTP): ${GREEN}✅ Aberta${NC}"
else
    echo -e "   • Porta 80 (HTTP): ${RED}❌ Fechada${NC}"
fi

if ss -tulpn | grep -q ":443 "; then
    echo -e "   • Porta 443 (HTTPS): ${GREEN}✅ Aberta${NC}"
else
    echo -e "   • Porta 443 (HTTPS): ${YELLOW}⚠️ Fechada${NC}"
fi

# Teste HTTP
echo -n "   • Teste HTTP: "
http_code=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN 2>/dev/null || echo "000")
if [[ "$http_code" =~ ^[23] ]]; then
    echo -e "${GREEN}✅ OK ($http_code)${NC}"
else
    echo -e "${RED}❌ Falha ($http_code)${NC}"
fi

# Teste HTTPS  
echo -n "   • Teste HTTPS: "
https_code=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN 2>/dev/null || echo "000")
if [[ "$https_code" =~ ^[23] ]]; then
    echo -e "${GREEN}✅ OK ($https_code)${NC}"
else
    echo -e "${YELLOW}⚠️ Falha ($https_code)${NC}"
fi
echo ""

# 5. SSL Certificate
echo -e "${BLUE}🔒 CERTIFICADO SSL${NC}"
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "   • Certificado: ${GREEN}✅ Instalado${NC}"
    
    # Verificar validade
    exp_date=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    if [ ! -z "$exp_date" ]; then
        exp_timestamp=$(date -d "$exp_date" +%s 2>/dev/null)
        now_timestamp=$(date +%s)
        days_left=$(( (exp_timestamp - now_timestamp) / 86400 ))
        
        if [ $days_left -gt 30 ]; then
            echo -e "   • Validade: ${GREEN}✅ $days_left dias restantes${NC}"
        elif [ $days_left -gt 0 ]; then
            echo -e "   • Validade: ${YELLOW}⚠️ $days_left dias restantes${NC}"
        else
            echo -e "   • Validade: ${RED}❌ Expirado${NC}"
        fi
    fi
else
    echo -e "   • Certificado: ${RED}❌ Não encontrado${NC}"
fi
echo ""

# 6. Logs Recentes
echo -e "${BLUE}📋 LOGS RECENTES${NC}"
echo "   • Nginx Access (últimas 3 linhas):"
tail -3 /var/log/nginx/hcc-app.access.log 2>/dev/null | sed 's/^/     /' || echo "     Nenhum log encontrado"

echo "   • Nginx Error (últimas 3 linhas):"
tail -3 /var/log/nginx/hcc-app.error.log 2>/dev/null | sed 's/^/     /' || echo "     Nenhum erro recente"
echo ""

# 7. Recursos do Sistema
echo -e "${BLUE}📊 RECURSOS${NC}"
echo "   • CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')% em uso"
echo "   • RAM: $(free | grep '^Mem:' | awk '{printf "%.1f%%", $3/$2 * 100.0}') em uso"
echo "   • Swap: $(free | grep '^Swap:' | awk '{if($2>0) printf "%.1f%%", $3/$2 * 100.0; else print "0%"}') em uso"
echo ""

# 8. Firewall
echo -e "${BLUE}🛡️  FIREWALL${NC}"
ufw_status=$(ufw status | head -1)
if echo "$ufw_status" | grep -q "active"; then
    echo -e "   • Status: ${GREEN}✅ Ativo${NC}"
else
    echo -e "   • Status: ${RED}❌ Inativo${NC}"
fi
echo ""

# 9. Sumário Final
echo -e "${BLUE}📋 SUMÁRIO${NC}"
overall_status="OK"

# Verificar serviços críticos
if ! systemctl is-active --quiet nginx; then
    overall_status="PROBLEMA"
fi

if [ ! -f "$APP_DIR/index.html" ]; then
    overall_status="PROBLEMA"
fi

if [[ ! "$https_code" =~ ^[23] ]] && [[ ! "$http_code" =~ ^[23] ]]; then
    overall_status="PROBLEMA"
fi

if [ "$overall_status" = "OK" ]; then
    echo -e "   • Status Geral: ${GREEN}✅ SISTEMA OPERACIONAL${NC}"
else
    echo -e "   • Status Geral: ${RED}❌ REQUER ATENÇÃO${NC}"
fi

echo ""
echo -e "${BLUE}🔗 LINKS ÚTEIS${NC}"
echo "   • Site: https://$DOMAIN"
echo "   • Status: https://$DOMAIN/status"
echo "   • Health: https://$DOMAIN/health"
echo ""