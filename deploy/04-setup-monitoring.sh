#!/bin/bash

echo "📊 Configurando monitoramento e logs..."

DOMAIN="hcc.chatconquista.com"

# Configurar logrotate para nginx
echo "📝 Configurando rotação de logs..."
sudo tee /etc/logrotate.d/hcc-med-pay-flow > /dev/null << 'EOF'
/var/log/nginx/access.log /var/log/nginx/error.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi
    endscript
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1
    endscript
}
EOF

# Criar script de backup
echo "💾 Criando script de backup..."
sudo mkdir -p /opt/hcc-backup

sudo tee /opt/hcc-backup/backup.sh > /dev/null << EOF
#!/bin/bash

# Configurações
BACKUP_DIR="/opt/hcc-backup"
APP_DIR="/var/www/hcc-med-pay-flow"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="hcc_backup_\$DATE.tar.gz"

# Criar backup
echo "📦 Criando backup: \$BACKUP_NAME"
tar -czf \$BACKUP_DIR/\$BACKUP_NAME \$APP_DIR

# Manter apenas os últimos 7 backups
find \$BACKUP_DIR -name "hcc_backup_*.tar.gz" -mtime +7 -delete

echo "✅ Backup criado: \$BACKUP_DIR/\$BACKUP_NAME"
EOF

sudo chmod +x /opt/hcc-backup/backup.sh

# Configurar backup automático
echo "⏰ Configurando backup automático (diário às 2h)..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/hcc-backup/backup.sh") | crontab -

# Criar script de monitoramento
echo "📊 Configurando monitoramento..."
sudo tee /opt/hcc-backup/monitor.sh > /dev/null << EOF
#!/bin/bash

DOMAIN="$DOMAIN"
LOG_FILE="/var/log/hcc-monitor.log"

# Verificar se a aplicação está respondendo
HTTP_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" https://\$DOMAIN)

if [ "\$HTTP_STATUS" != "200" ]; then
    echo "\$(date): ❌ Aplicação não está respondendo (HTTP \$HTTP_STATUS)" >> \$LOG_FILE
    # Reiniciar nginx
    sudo systemctl restart nginx
    echo "\$(date): 🔄 Nginx reiniciado" >> \$LOG_FILE
else
    echo "\$(date): ✅ Aplicação funcionando (HTTP \$HTTP_STATUS)" >> \$LOG_FILE
fi

# Verificar uso de disco
DISK_USAGE=\$(df / | awk 'NR==2{print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -gt 80 ]; then
    echo "\$(date): ⚠️ Uso de disco alto: \$DISK_USAGE%" >> \$LOG_FILE
fi

# Verificar memória
MEM_USAGE=\$(free | awk 'NR==2{printf "%.0f", \$3*100/\$2}')
if [ \$MEM_USAGE -gt 80 ]; then
    echo "\$(date): ⚠️ Uso de memória alto: \$MEM_USAGE%" >> \$LOG_FILE
fi
EOF

sudo chmod +x /opt/hcc-backup/monitor.sh

# Configurar monitoramento (a cada 5 minutos)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/hcc-backup/monitor.sh") | crontab -

# Criar script de status
echo "📈 Criando script de status..."
sudo tee /opt/hcc-backup/status.sh > /dev/null << EOF
#!/bin/bash

echo "📊 Status do HCC Med Pay Flow"
echo "================================"

# Status dos serviços
echo "🔧 Serviços:"
systemctl is-active --quiet nginx && echo "  ✅ Nginx: Ativo" || echo "  ❌ Nginx: Inativo"

# Status da aplicação
HTTP_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN)
if [ "\$HTTP_STATUS" == "200" ]; then
    echo "  ✅ Aplicação: Funcionando"
else
    echo "  ❌ Aplicação: Não respondendo (HTTP \$HTTP_STATUS)"
fi

# Certificado SSL
SSL_EXPIRES=\$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
echo "  🔒 SSL expira em: \$SSL_EXPIRES"

# Uso de recursos
echo ""
echo "💾 Recursos:"
echo "  📊 Disco: \$(df -h / | awk 'NR==2{print \$5}') usado"
echo "  🧠 Memória: \$(free -h | awk 'NR==2{printf \"%.0f%%\", \$3*100/\$2}')"
echo "  ⚡ Load: \$(uptime | awk -F'load average:' '{print \$2}')"

# Logs recentes
echo ""
echo "📝 Logs recentes:"
tail -5 /var/log/hcc-monitor.log 2>/dev/null || echo "  Nenhum log encontrado"
EOF

sudo chmod +x /opt/hcc-backup/status.sh

# Configurar fail2ban para proteção
echo "🛡️ Instalando fail2ban..."
sudo apt install -y fail2ban

sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 600
bantime = 7200
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban

echo "✅ Monitoramento configurado!"
echo ""
echo "📋 Comandos úteis:"
echo "  📊 Status: sudo /opt/hcc-backup/status.sh"
echo "  💾 Backup manual: sudo /opt/hcc-backup/backup.sh"
echo "  📝 Ver logs: tail -f /var/log/hcc-monitor.log"
echo "  🛡️ Status fail2ban: sudo fail2ban-client status"