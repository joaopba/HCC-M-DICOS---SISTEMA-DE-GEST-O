#!/bin/bash

# 🔄 Script de atualização rápida via Git
# Use este script para atualizar a aplicação após mudanças no GitHub

set -e

APP_DIR="/var/www/hcc-med-pay-flow"
DOMAIN="hcc.chatconquista.com"

echo "🔄 Atualizando HCC Med Pay Flow..."

cd $APP_DIR

# Verificar se há alterações locais não commitadas
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Há alterações locais. Descartando..."
    git reset --hard HEAD
fi

# Buscar e aplicar atualizações
echo "⬇️ Baixando atualizações do GitHub..."
OLD_COMMIT=$(git rev-parse --short HEAD)
git pull origin main

NEW_COMMIT=$(git rev-parse --short HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo "✅ Já está atualizado! (commit: $OLD_COMMIT)"
    exit 0
fi

echo "📦 Instalando dependências para build (inclui dev)..."
if [ -f package-lock.json ]; then
  npm ci --include=dev || npm ci
else
  npm install --include=dev || npm install
fi

echo "🔨 Fazendo novo build..."
npm run build

echo "🧹 Removendo devDependencies para produção..."
npm prune --production || true

# Verificar build
if [ ! -d "dist" ]; then
    echo "❌ Erro no build!"
    exit 1
fi

# Atualizar permissões
sudo chown -R www-data:www-data $APP_DIR/dist
sudo chmod -R 755 $APP_DIR/dist

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Atualização concluída!"
echo "   📍 $OLD_COMMIT → $NEW_COMMIT"
echo "   🌐 https://$DOMAIN"
echo ""

# Mostrar últimas mudanças
echo "📝 Últimas alterações:"
git log --oneline --graph -5
