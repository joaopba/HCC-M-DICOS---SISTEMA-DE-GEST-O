#!/bin/bash

# 🔒 Configuração SSL com Let's Encrypt

set -e

DOMAIN="hcc.chatconquista.com"

echo "🔒 Configurando SSL para $DOMAIN..."

# Verificar se o domínio está respondendo
echo "🔍 Verificando se o domínio está acessível..."
if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "200\|301\|302"; then
    echo "✅ Domínio acessível via HTTP"
else
    echo "⚠️  Domínio pode não estar acessível ainda, continuando..."
fi

# Parar nginx temporariamente para certificação standalone
systemctl stop nginx

echo "🔐 Obtendo certificado SSL..."

# Tentar obter certificado SSL
if certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email admin@$DOMAIN \
    --domains $DOMAIN \
    --force-renewal; then
    
    echo "✅ Certificado SSL obtido com sucesso!"
    
    # Reconfigurar Nginx com SSL
    cat > /etc/nginx/sites-available/hcc-app << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name hcc.chatconquista.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name hcc.chatconquista.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/hcc.chatconquista.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hcc.chatconquista.com/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
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
    add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;
    
    # Configuração para React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Cache para HTML
        location ~* \.(html)$ {
            expires 5m;
            add_header Cache-Control "public, must-revalidate";
        }
    }
    
    # Status endpoint
    location /status {
        access_log off;
        return 200 "OK - HCC Med Pay Flow is running securely\n";
        add_header Content-Type text/plain;
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 '{"status":"healthy","timestamp":"$time_iso8601","server":"$server_name"}';
        add_header Content-Type application/json;
    }
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        application/xml
        application/rss+xml
        application/atom+xml
        image/svg+xml;
        
    # Limite de upload
    client_max_body_size 10M;
}
EOF

    # Testar e recarregar nginx
    nginx -t && systemctl start nginx
    
    # Configurar renovação automática
    echo "🔄 Configurando renovação automática..."
    
    # Criar script de renovação
    cat > /etc/cron.d/certbot << 'EOF'
# Renovar certificados SSL automaticamente
0 12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
    
    echo "✅ SSL configurado com sucesso!"
    echo "🔄 Renovação automática configurada"
    
else
    echo "❌ Falha ao obter certificado SSL"
    echo "🔧 Iniciando nginx sem SSL..."
    systemctl start nginx
    echo "⚠️  Execute manualmente: certbot --nginx -d $DOMAIN"
fi

# Teste final
sleep 5
echo "🧪 Testando HTTPS..."
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
    echo "✅ HTTPS funcionando corretamente!"
else
    echo "⚠️  HTTPS pode levar alguns minutos para funcionar"
fi