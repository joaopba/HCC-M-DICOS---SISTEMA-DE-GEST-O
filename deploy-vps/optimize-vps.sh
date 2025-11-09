#!/bin/bash

# 🚀 Otimizações de Performance para VPS Ubuntu

set -e

echo "🚀 Aplicando otimizações de performance para VPS..."

# Otimizar configurações do sistema
echo "⚙️  Configurando parâmetros do kernel..."

# Aumentar limites de arquivos abertos
cat >> /etc/sysctl.conf << EOF

# Otimizações HCC Med Pay Flow
fs.file-max = 65535
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
EOF

sysctl -p

# Aumentar limites de processos
cat >> /etc/security/limits.conf << EOF

# Limites HCC Med Pay Flow
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
EOF

# Otimizar Nginx
echo "🌐 Otimizando Nginx..."

cat > /etc/nginx/conf.d/performance.conf << 'EOF'
# Performance Optimizations
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Cache de arquivos estáticos
    open_file_cache max=10000 inactive=30s;
    open_file_cache_valid 60s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # Timeouts otimizados
    keepalive_timeout 30s;
    keepalive_requests 100;
    reset_timedout_connection on;
    client_body_timeout 10s;
    send_timeout 10s;
    
    # Buffers
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    output_buffers 1 32k;
    postpone_output 1460;
}
EOF

# Configurar compressão Gzip avançada
cat > /etc/nginx/conf.d/gzip.conf << 'EOF'
# Gzip Compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/rss+xml
    application/atom+xml
    image/svg+xml
    text/x-component
    text/x-cross-domain-policy;
gzip_disable "msie6";
gzip_min_length 256;
gzip_buffers 16 8k;
gzip_http_version 1.1;
EOF

# Otimizar PM2 se estiver instalado
if command -v pm2 &> /dev/null; then
    echo "⚙️  Otimizando PM2..."
    pm2 set pm2:autodump true
    pm2 set pm2:watch-restart true
fi

# Configurar swap se necessário (para VPS com pouca RAM)
TOTAL_RAM=$(free -m | awk 'NR==2 {print $2}')
if [ "$TOTAL_RAM" -lt 2048 ] && [ ! -f /swapfile ]; then
    echo "💾 Configurando swap (RAM < 2GB)..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Otimizar uso de swap
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# Limpar cache e otimizar
echo "🧹 Limpando caches..."
apt clean
apt autoremove -y

# Configurar cron para limpeza automática
(crontab -l 2>/dev/null; echo "0 3 * * 0 apt clean && apt autoremove -y") | crontab -

# Testar configuração do Nginx
nginx -t

if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx otimizado e recarregado"
else
    echo "❌ Erro na configuração do Nginx"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ OTIMIZAÇÕES APLICADAS COM SUCESSO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Configurações aplicadas:"
echo "  • Limites de arquivos: 65535"
echo "  • Conexões Nginx: 4096"
echo "  • Compressão Gzip: Ativada"
echo "  • Cache de arquivos: Otimizado"
echo "  • Timeouts: Ajustados"
if [ "$TOTAL_RAM" -lt 2048 ]; then
    echo "  • Swap: 2GB configurado"
fi
echo ""
echo "🚀 VPS otimizada para produção!"
