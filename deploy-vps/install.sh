#!/bin/bash

# 🚀 Script de Instalação Completa - HCC Med Pay Flow
# Autor: Sistema Automatizado
# Data: $(date)

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
DOMAIN="hcc.chatconquista.com"
APP_DIR="/var/www/hcc-med-pay-flow"
IP="72.60.157.200"

# Função para log
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo ./install.sh"
fi

clear
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              🏥 HCC Med Pay Flow - Deploy VPS                ║"  
echo "║                  Instalação Automatizada                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Iniciando instalação completa..."
log "Domínio: $DOMAIN"
log "Diretório: $APP_DIR"
log "IP: $IP"

# 1. Atualizar sistema
log "📦 Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependências base
log "🔧 Instalando dependências..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# 3. Instalar Node.js 18
log "📥 Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar versões
node_version=$(node --version)
npm_version=$(npm --version)
log "Node.js instalado: $node_version"
log "NPM instalado: $npm_version"

# 4. Instalar Nginx
log "🌐 Instalando Nginx..."
apt install -y nginx

# 5. Instalar Certbot para SSL
log "🔒 Instalando Certbot..."
apt install -y certbot python3-certbot-nginx

# 6. Instalar PM2 globalmente
log "⚙️ Instalando PM2..."
npm install -g pm2

# 7. Configurar Firewall
log "🛡️ Configurando firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 8. Criar diretório da aplicação
log "📁 Criando estrutura de diretórios..."
mkdir -p $APP_DIR
mkdir -p /var/log/hcc-app
chown -R www-data:www-data $APP_DIR
chown -R www-data:www-data /var/log/hcc-app

# 9. Configurar Nginx
log "🔧 Configurando Nginx..."
chmod +x ./setup-nginx.sh
./setup-nginx.sh

# 10. Fazer deploy da aplicação
log "🚀 Fazendo deploy da aplicação..."
chmod +x ./deploy-app.sh
./deploy-app.sh

# 11. Configurar SSL
log "🔒 Configurando SSL..."
chmod +x ./setup-ssl.sh
./setup-ssl.sh

# 12. Configurar PM2
log "⚙️ Configurando PM2..."
pm2 startup systemd -u root --hp /root
pm2 save

# 13. Validação completa automatizada
log "🧪 Executando validação completa do deploy..."
chmod +x ./validate-deployment.sh

echo ""
log "⏳ Aguardando 5 segundos para serviços estabilizarem..."
sleep 5

./validate-deployment.sh

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ INSTALAÇÃO CONCLUÍDA                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo "🌐 URLs disponíveis:"
echo "   • Frontend: https://$DOMAIN"
echo "   • HTTP (redireciona): http://$DOMAIN"
echo ""
echo "📊 Comandos úteis:"
echo "   • Status completo: ./status.sh"
echo "   • Ver logs: ./logs.sh"
echo "   • Reiniciar: ./restart.sh"
echo ""
echo "📱 Configurar Webhook no Supabase:"
echo "   • URL: https://$DOMAIN/api/webhook"
echo "   • Métodos: POST"
echo ""
echo "🔧 Próximos passos:"
echo "   1. Aguardar propagação do SSL (até 10min)"
echo "   2. Configurar webhook no Supabase"
echo "   3. Testar funcionalidades"
echo ""

success "Deploy concluído com sucesso! 🎉"