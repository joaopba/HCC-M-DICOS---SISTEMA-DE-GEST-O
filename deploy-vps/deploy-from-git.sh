#!/bin/bash

# 🚀 Deploy via Git para VPS Ubuntu
# Este script faz deploy automático do repositório GitHub

set -e

REPO_URL="https://github.com/joaopba/hcc-med-pay-flow.git"
APP_DIR="/var/www/hcc-med-pay-flow"
DOMAIN="hcc.chatconquista.com"

echo "🚀 Iniciando deploy via Git..."

# Verificar se é primeira instalação ou atualização
if [ -d "$APP_DIR/.git" ]; then
    echo "📦 Atualizando aplicação existente..."
    cd $APP_DIR
    
    # Fazer backup antes de atualizar
    BACKUP_DIR="/var/backups/hcc-app-$(date +%Y%m%d-%H%M%S)"
    echo "💾 Criando backup em $BACKUP_DIR..."
    sudo cp -r $APP_DIR $BACKUP_DIR
    
    # Atualizar código
    echo "⬇️ Baixando últimas alterações do GitHub..."
    git fetch origin
    git reset --hard origin/main
    
else
    echo "📥 Primeira instalação - clonando repositório..."
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Instalar dependências (inclui dev para build)
echo "📦 Instalando dependências para build (inclui dev)..."
if [ -f package-lock.json ]; then
  npm ci --include=dev || npm ci
else
  npm install --include=dev || npm install
fi

# Build da aplicação
echo "🔨 Fazendo build da aplicação..."
npm run build

echo "🧹 Pruning dependências de produção..."
npm prune --production || true
# Verificar se build foi bem sucedido
if [ ! -d "dist" ]; then
    echo "❌ Erro: pasta dist não foi criada!"
    exit 1
fi

# Configurar permissões
echo "🔒 Configurando permissões..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Salvar informações do deploy
echo "📝 Salvando informações do deploy..."
cat > $APP_DIR/dist/deploy-info.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
  "deployed_by": "$USER",
  "deploy_method": "git"
}
EOF

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""
echo "📊 Informações:"
echo "   - Commit: $(git rev-parse --short HEAD)"
echo "   - Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "   - Tamanho: $(du -sh dist | cut -f1)"
echo ""
echo "🌐 Acesse: https://$DOMAIN"
echo ""
echo "💡 Próximas atualizações:"
echo "   ssh root@72.60.157.200 'cd $APP_DIR && ./deploy-vps/update.sh'"
