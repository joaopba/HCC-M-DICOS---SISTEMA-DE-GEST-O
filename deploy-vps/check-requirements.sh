#!/bin/bash

# 🔍 Verificação de Requisitos da VPS para HCC Med Pay Flow

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Verificando requisitos da VPS..."
echo ""

# Verificar Node.js
echo "Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js encontrado: $NODE_VERSION${NC}"
    
    # Verificar se é versão 18+
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${YELLOW}⚠️  Recomendado: Node.js 18 ou superior${NC}"
        echo "   Versão atual: $NODE_VERSION"
    fi
else
    echo -e "${RED}❌ Node.js não encontrado${NC}"
    echo "   Instale com: curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
fi

echo ""

# Verificar NPM
echo "Verificando NPM..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ NPM encontrado: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ NPM não encontrado${NC}"
fi

echo ""

# Verificar Nginx
echo "Verificando Nginx..."
if command -v nginx &> /dev/null; then
    NGINX_VERSION=$(nginx -v 2>&1 | cut -d'/' -f2)
    echo -e "${GREEN}✅ Nginx encontrado: $NGINX_VERSION${NC}"
else
    echo -e "${RED}❌ Nginx não encontrado${NC}"
    echo "   Instale com: apt install nginx"
fi

echo ""

# Verificar Certbot
echo "Verificando Certbot..."
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}✅ Certbot encontrado: $CERTBOT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Certbot não encontrado (necessário para SSL)${NC}"
    echo "   Instale com: apt install certbot python3-certbot-nginx"
fi

echo ""

# Verificar espaço em disco
echo "Verificando espaço em disco..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✅ Espaço em disco: $DISK_AVAIL disponível (${DISK_USAGE}% usado)${NC}"
else
    echo -e "${YELLOW}⚠️  Espaço em disco baixo: ${DISK_USAGE}% usado${NC}"
fi

echo ""

# Verificar memória RAM
echo "Verificando memória RAM..."
TOTAL_RAM=$(free -h | awk 'NR==2 {print $2}')
USED_RAM=$(free -h | awk 'NR==2 {print $3}')
AVAIL_RAM=$(free -h | awk 'NR==2 {print $7}')
echo -e "${GREEN}✅ RAM Total: $TOTAL_RAM | Usada: $USED_RAM | Disponível: $AVAIL_RAM${NC}"

echo ""

# Verificar portas necessárias
echo "Verificando portas..."
PORTS_TO_CHECK=(22 80 443)
for port in "${PORTS_TO_CHECK[@]}"; do
    if ss -tuln | grep -q ":$port "; then
        echo -e "${GREEN}✅ Porta $port: Aberta${NC}"
    else
        echo -e "${YELLOW}⚠️  Porta $port: Fechada${NC}"
    fi
done

echo ""

# Verificar DNS
echo "Verificando DNS..."
DOMAIN="hcc.chatconquista.com"
IP_ESPERADO="72.60.157.200"
DNS_IP=$(dig +short $DOMAIN | tail -n1)

if [ "$DNS_IP" = "$IP_ESPERADO" ]; then
    echo -e "${GREEN}✅ DNS configurado corretamente${NC}"
    echo "   $DOMAIN → $DNS_IP"
else
    echo -e "${YELLOW}⚠️  DNS precisa de ajuste${NC}"
    echo "   Esperado: $IP_ESPERADO"
    echo "   Atual: $DNS_IP"
    echo "   Aguarde propagação do DNS (pode levar até 24h)"
fi

echo ""

# Verificar Git
echo "Verificando Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✅ Git encontrado: $GIT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Git não encontrado${NC}"
fi

echo ""

# Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DA VERIFICAÇÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_COUNT=0
OPTIONAL_COUNT=0

if command -v node &> /dev/null; then ((REQUIRED_COUNT++)); fi
if command -v npm &> /dev/null; then ((REQUIRED_COUNT++)); fi
if command -v nginx &> /dev/null; then ((REQUIRED_COUNT++)); fi

if command -v certbot &> /dev/null; then ((OPTIONAL_COUNT++)); fi
if command -v git &> /dev/null; then ((OPTIONAL_COUNT++)); fi

echo "✅ Requisitos essenciais: $REQUIRED_COUNT/3"
echo "⚡ Opcionais: $OPTIONAL_COUNT/2"
echo ""

if [ "$REQUIRED_COUNT" -eq 3 ]; then
    echo -e "${GREEN}🎉 VPS está pronta para deploy!${NC}"
    echo ""
    echo "Execute: ./install.sh"
else
    echo -e "${YELLOW}⚠️  Instale os requisitos faltantes antes do deploy${NC}"
    echo ""
    echo "Execute: ./install.sh (irá instalar automaticamente)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
