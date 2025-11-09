#!/bin/bash

# 🌐 Configuração do Nginx para HCC Med Pay Flow

set -e

DOMAIN="hcc.chatconquista.com"
APP_DIR="/var/www/hcc-med-pay-flow"

echo "🔧 Configurando Nginx para $DOMAIN..."

# Remover configuração padrão
rm -f /etc/nginx/sites-enabled/default

# Criar configuração para a aplicação
cat > /etc/nginx/sites-available/hcc-app << 'EOF'
server {
    listen 80;
    server_name hcc.chatconquista.com;
    
    # Logs
    access_log /var/log/nginx/hcc-app.access.log;
    error_log /var/log/nginx/hcc-app.error.log;
    
    # Diretório raiz da aplicação
    root /var/www/hcc-med-pay-flow/dist;
    index index.html;
    
    # Configurações de segurança
    server_tokens off;
    
    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Configuração para React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Status endpoint
    location /status {
        access_log off;
        return 200 "OK - HCC Med Pay Flow is running\n";
        add_header Content-Type text/plain;
    }
    
    # Proxy para API se necessário (futuro)
    location /api/ {
        return 404;
    }
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth any;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
        
    # Limite de upload
    client_max_body_size 10M;
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/hcc-app /etc/nginx/sites-enabled/

# Testar configuração
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração do Nginx válida"
    systemctl reload nginx
    echo "✅ Nginx recarregado"
else
    echo "❌ Erro na configuração do Nginx"
    exit 1
fi

echo "✅ Nginx configurado com sucesso!"