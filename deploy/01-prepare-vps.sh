#!/bin/bash

echo "🚀 Preparando VPS Ubuntu para HCC Med Pay Flow..."

# Atualizar sistema
echo "📦 Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
echo "🔧 Instalando dependências básicas..."
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx ufw

# Instalar Node.js 18
echo "📦 Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versões
echo "✅ Verificando versões instaladas..."
node --version
npm --version
nginx -v

# Configurar firewall
echo "🔒 Configurando firewall..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Criar diretório da aplicação
echo "📁 Criando diretório da aplicação..."
sudo mkdir -p /var/www/hcc-med-pay-flow
sudo chown -R $USER:$USER /var/www/hcc-med-pay-flow

echo "✅ VPS preparado com sucesso!"
echo "📋 Próximo passo: Execute ./02-deploy-app.sh"