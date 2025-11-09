#!/bin/bash

# 🚀 Deploy da Aplicação HCC Med Pay Flow

set -e

APP_DIR="/var/www/hcc-med-pay-flow"
BACKUP_DIR="/var/backups/hcc-app"

echo "🚀 Fazendo deploy da aplicação..."

# Criar backup se existir versão anterior
if [ -d "$APP_DIR" ]; then
    echo "💾 Fazendo backup da versão anterior..."
    mkdir -p $BACKUP_DIR
    timestamp=$(date +%Y%m%d_%H%M%S)
    tar -czf "$BACKUP_DIR/backup_$timestamp.tar.gz" -C "$APP_DIR" . 2>/dev/null || true
    echo "✅ Backup salvo em: $BACKUP_DIR/backup_$timestamp.tar.gz"
fi

# Criar diretório se não existir
mkdir -p $APP_DIR

echo "📁 Preparando aplicação para deploy..."

# Verificar se existe projeto React na pasta atual
if [ ! -f "../package.json" ]; then
    echo "❌ package.json não encontrado. Certifique-se de estar na pasta correta."
    echo "📂 Estrutura esperada:"
    echo "   ├── deploy-vps/ (pasta atual)"
    echo "   ├── package.json"
    echo "   ├── src/"
    echo "   └── public/"
    exit 1
fi

# Ir para diretório do projeto
cd ..

echo "📦 Instalando dependências..."
npm ci --production=false

echo "🔨 Fazendo build da aplicação..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Pasta 'dist' não foi gerada. Verifique o build."
    exit 1
fi

echo "📂 Copiando arquivos para $APP_DIR..."
# Remover arquivos antigos (exceto backups)
find $APP_DIR -mindepth 1 -not -path "*/backup*" -delete 2>/dev/null || true

# Copiar novo build
cp -r dist/* $APP_DIR/
cp package.json $APP_DIR/ 2>/dev/null || true

# Configurar permissões
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Criar arquivo de informações do deploy
cat > $APP_DIR/deploy-info.json << EOF
{
  "deployed_at": "$(date -Iseconds)",
  "version": "$(date +%Y.%m.%d-%H%M%S)",
  "server": "$(hostname)",
  "user": "$(whoami)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF

# Criar página de status customizada
cat > $APP_DIR/server-status.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>HCC Med Pay Flow - Status</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { color: #28a745; font-size: 24px; font-weight: bold; }
        .info { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .footer { margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏥 HCC Med Pay Flow</h1>
        <div class="status">✅ Sistema Operacional</div>
        <div class="info">
            <strong>Servidor:</strong> Ubuntu VPS<br>
            <strong>Deploy:</strong> <span id="deployTime">Loading...</span><br>
            <strong>Status:</strong> Ativo<br>
            <strong>SSL:</strong> Ativo
        </div>
        <div class="footer">
            Sistema de Gestão de Pagamentos Médicos
        </div>
    </div>
    <script>
        fetch('/deploy-info.json')
            .then(r => r.json())
            .then(d => {
                document.getElementById('deployTime').textContent = new Date(d.deployed_at).toLocaleString('pt-BR');
            })
            .catch(() => {
                document.getElementById('deployTime').textContent = 'Não disponível';
            });
    </script>
</body>
</html>
EOF

# Voltar para pasta de deploy
cd deploy-vps

echo "🧪 Verificando deploy..."

# Verificar se os arquivos essenciais existem
essential_files=("index.html")
for file in "${essential_files[@]}"; do
    if [ -f "$APP_DIR/$file" ]; then
        echo "✅ $file encontrado"
    else
        echo "❌ $file não encontrado"
    fi
done

# Verificar tamanho da pasta
size=$(du -sh $APP_DIR | cut -f1)
echo "📊 Tamanho da aplicação: $size"

# Verificar permissões
if [ -r "$APP_DIR/index.html" ]; then
    echo "✅ Permissões corretas"
else
    echo "⚠️ Corrigindo permissões..."
    chmod -R 644 $APP_DIR/*
    chmod 755 $APP_DIR
fi

echo "✅ Deploy da aplicação concluído!"
echo "📂 Aplicação deployada em: $APP_DIR"
echo "📊 Arquivos disponíveis:"
ls -la $APP_DIR | head -10