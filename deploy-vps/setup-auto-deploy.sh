#!/bin/bash

# 🤖 Configurar Deploy Automático via Webhook GitHub
# Este script configura um webhook que atualiza automaticamente quando você faz push

set -e

APP_DIR="/var/www/hcc-med-pay-flow"
WEBHOOK_SECRET=$(openssl rand -hex 32)
WEBHOOK_PORT=9000

echo "🤖 Configurando deploy automático..."

# Instalar webhook daemon
echo "📦 Instalando webhook..."
sudo apt-get update
sudo apt-get install -y webhook

# Criar diretório de configuração
sudo mkdir -p /etc/webhook

# Criar hook de deploy
sudo tee /etc/webhook/hooks.json > /dev/null << EOF
[
  {
    "id": "deploy-hcc",
    "execute-command": "$APP_DIR/deploy-vps/update.sh",
    "command-working-directory": "$APP_DIR",
    "response-message": "Deploy iniciado!",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "$WEBHOOK_SECRET",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/main",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
EOF

# Criar serviço systemd
sudo tee /etc/systemd/system/webhook.service > /dev/null << EOF
[Unit]
Description=GitHub Webhook Handler
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/webhook -hooks /etc/webhook/hooks.json -port $WEBHOOK_PORT -verbose
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Configurar firewall
echo "🔒 Configurando firewall..."
sudo ufw allow $WEBHOOK_PORT/tcp

# Iniciar serviço
echo "🚀 Iniciando serviço webhook..."
sudo systemctl daemon-reload
sudo systemctl enable webhook
sudo systemctl start webhook

# Obter IP do servidor
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "✅ Deploy automático configurado!"
echo ""
echo "📋 Configuração no GitHub:"
echo "   1. Acesse: https://github.com/joaopba/hcc-med-pay-flow/settings/hooks"
echo "   2. Clique em 'Add webhook'"
echo "   3. Configure:"
echo ""
echo "      Payload URL: http://$SERVER_IP:$WEBHOOK_PORT/hooks/deploy-hcc"
echo "      Content type: application/json"
echo "      Secret: $WEBHOOK_SECRET"
echo ""
echo "   4. Selecione 'Just the push event'"
echo "   5. Clique em 'Add webhook'"
echo ""
echo "💾 IMPORTANTE: Salve este secret em local seguro!"
echo "   Secret: $WEBHOOK_SECRET"
echo ""
echo "🔍 Testar webhook:"
echo "   curl -X POST http://$SERVER_IP:$WEBHOOK_PORT/hooks/deploy-hcc"
echo ""
echo "📊 Ver logs:"
echo "   sudo journalctl -u webhook -f"
