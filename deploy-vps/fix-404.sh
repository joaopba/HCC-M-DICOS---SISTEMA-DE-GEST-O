#!/bin/bash

# 🔧 Script para corrigir erro 404 no Nginx

set -e

APP_DIR="/var/www/hcc-med-pay-flow"
DOMAIN="hcc.chatconquista.com"

echo "🔍 Diagnosticando erro 404..."
echo ""

# 1. Verificar se diretório existe
echo "📁 Verificando diretório da aplicação..."
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Diretório $APP_DIR não existe!"
    echo "Execute primeiro: ./deploy-from-git.sh"
    exit 1
fi

cd $APP_DIR

# 2. Verificar se build existe
echo "📦 Verificando build..."
if [ ! -d "dist" ]; then
    echo "⚠️  Build não existe. Criando..."
    
    # Verificar Node.js
    if ! command -v npm &> /dev/null; then
        echo "❌ Node.js não instalado! Execute: ../deploy/01-prepare-vps.sh"
        exit 1
    fi
    
    echo "📦 Instalando dependências..."
    npm install
    
    echo "🔨 Fazendo build..."
    npm run build
    
    if [ ! -d "dist" ]; then
        echo "❌ Build falhou!"
        exit 1
    fi
else
    echo "✅ Build existe"
fi

# 3. Verificar arquivos no dist
echo ""
echo "📋 Arquivos no dist:"
ls -lh dist/ | head -10

if [ ! -f "dist/index.html" ]; then
    echo "❌ index.html não encontrado no build!"
    echo "Fazendo rebuild..."
    npm run build
fi

# 4. Verificar e corrigir configuração do Nginx
echo ""
echo "🌐 Verificando configuração do Nginx..."

sudo tee /etc/nginx/sites-available/hcc-med-pay-flow > /dev/null << 'EOF'
server {
    listen 80;
    server_name hcc.chatconquista.com www.hcc.chatconquista.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hcc.chatconquista.com www.hcc.chatconquista.com;
    
    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/hcc.chatconquista.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hcc.chatconquista.com/privkey.pem;
    
    root /var/www/hcc-med-pay-flow/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Main location - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security - deny access to sensitive files
    location ~ /\. {
        deny all;
    }
}
EOF

# 5. Ativar site e remover default
echo "🔗 Ativando site..."
sudo ln -sf /etc/nginx/sites-available/hcc-med-pay-flow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 6. Corrigir permissões
echo "🔒 Corrigindo permissões..."
sudo chown -R www-data:www-data $APP_DIR/dist
sudo chmod -R 755 $APP_DIR/dist

# 7. Testar configuração Nginx
echo ""
echo "🧪 Testando configuração do Nginx..."
sudo nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Erro na configuração do Nginx!"
    exit 1
fi

# 8. Recarregar Nginx
echo "🔄 Recarregando Nginx..."
sudo systemctl reload nginx

# 9. Verificar status
echo ""
echo "📊 Status dos serviços:"
sudo systemctl status nginx --no-pager -l | head -5

echo ""
echo "✅ Correções aplicadas!"
echo ""
echo "🔍 Verificações finais:"
echo "   - Diretório: $APP_DIR/dist"
echo "   - Arquivos: $(ls -1 dist | wc -l) arquivos"
echo "   - Tamanho: $(du -sh dist | cut -f1)"
echo ""
echo "🌐 Teste agora: https://$DOMAIN"
echo ""
echo "📋 Se ainda não funcionar, veja os logs:"
echo "   sudo tail -f /var/log/nginx/error.log"
