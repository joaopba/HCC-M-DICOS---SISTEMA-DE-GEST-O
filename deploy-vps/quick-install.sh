#!/bin/bash

# 🚀 Instalação Ultra-Rápida - HCC Med Pay Flow
# Execute este comando na sua VPS para instalação em uma única linha

set -e

DOMAIN="hcc.chatconquista.com"
IP="72.60.157.200"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           🚀 INSTALAÇÃO RÁPIDA - HCC MED PAY FLOW            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configurando automaticamente:${NC}"
echo "• Domínio: $DOMAIN"
echo "• IP: $IP"
echo "• SSL: Automático"
echo "• Firewall: Configurado"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Execute como root: sudo ./quick-install.sh"
    exit 1
fi

# Verificar conectividade
echo "🔍 Verificando conectividade..."
if ping -c 1 google.com &> /dev/null; then
    echo "✅ Internet OK"
else
    echo "❌ Sem conexão com internet"
    exit 1
fi

# Atualizar sistema rapidamente
echo "📦 Atualizando sistema (pode demorar alguns minutos)..."
export DEBIAN_FRONTEND=noninteractive
apt update -qq
apt upgrade -y -qq

# Instalar tudo de uma vez
echo "🔧 Instalando dependências..."
apt install -y -qq curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release nginx certbot python3-certbot-nginx

# Node.js 18
echo "📥 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y -qq nodejs

# PM2
echo "⚙️ Instalando PM2..."
npm install -g pm2 --silent

# Firewall
echo "🛡️ Configurando firewall..."
ufw --force reset > /dev/null 2>&1
ufw allow OpenSSH > /dev/null 2>&1
ufw allow 'Nginx Full' > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

# Nginx básico
echo "🌐 Configurando Nginx..."
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/hcc-app << 'EOF'
server {
    listen 80;
    server_name hcc.chatconquista.com;
    root /var/www/hcc-med-pay-flow;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /status {
        return 200 "HCC Med Pay Flow - Online\n";
        add_header Content-Type text/plain;
    }
}
EOF

ln -sf /etc/nginx/sites-available/hcc-app /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Criar estrutura básica da app
echo "📁 Criando estrutura da aplicação..."
mkdir -p /var/www/hcc-med-pay-flow
cat > /var/www/hcc-med-pay-flow/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>HCC Med Pay Flow - Instalação</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial; margin: 0; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }
        .container { max-width: 600px; margin: 0 auto; text-align: center; }
        .box { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
        h1 { font-size: 2.5em; margin: 0 0 20px 0; }
        .status { font-size: 1.5em; margin: 20px 0; }
        .info { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
        .next-steps { text-align: left; }
        .next-steps li { margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="box">
            <h1>🏥 HCC Med Pay Flow</h1>
            <div class="status">✅ Servidor Configurado com Sucesso!</div>
            
            <div class="info">
                <strong>🌐 Domínio:</strong> hcc.chatconquista.com<br>
                <strong>🚀 Status:</strong> Pronto para Deploy<br>
                <strong>🔒 SSL:</strong> Será configurado automaticamente<br>
                <strong>⚡ Servidor:</strong> Ubuntu + Nginx
            </div>
            
            <div class="info">
                <strong>📋 Próximos Passos:</strong>
                <ol class="next-steps">
                    <li>Fazer upload dos arquivos da aplicação</li>
                    <li>Executar o script de deploy completo</li>
                    <li>SSL será configurado automaticamente</li>
                </ol>
            </div>
            
            <div style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
                Instalação concluída em: <span id="timestamp"></span>
            </div>
        </div>
    </div>
    
    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString('pt-BR');
    </script>
</body>
</html>
EOF

chown -R www-data:www-data /var/www/hcc-med-pay-flow

# Teste rápido
echo "🧪 Testando instalação..."
sleep 2

if curl -s http://localhost/status | grep -q "Online"; then
    echo "✅ Nginx OK"
else
    echo "⚠️ Nginx pode precisar de ajustes"
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx rodando"
else
    echo "❌ Nginx não está rodando"
fi

# Informações finais
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                ✅ INSTALAÇÃO BÁSICA CONCLUÍDA                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Teste agora:${NC} http://$DOMAIN/status"
echo ""
echo -e "${YELLOW}📋 Para deploy completo da aplicação:${NC}"
echo "1. Faça upload da pasta 'deploy-vps' para /root/"
echo "2. Execute: cd /root/deploy-vps && ./install.sh"
echo ""
echo -e "${YELLOW}⚡ Ou execute tudo de uma vez:${NC}"
echo "scp -r deploy-vps/ root@$IP:/root/ && ssh root@$IP 'cd /root/deploy-vps && ./install.sh'"
echo ""
echo "🎉 Servidor básico configurado com sucesso!"