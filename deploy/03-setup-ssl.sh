#!/bin/bash

echo "🔒 Configurando SSL com Let's Encrypt..."

DOMAIN="hcc.chatconquista.com"

# Verificar se o domínio está apontando para o servidor
echo "🔍 Verificando DNS do domínio $DOMAIN..."
IP_SERVIDOR=$(curl -s ifconfig.me)
IP_DOMINIO=$(dig +short $DOMAIN)

if [ "$IP_SERVIDOR" != "$IP_DOMINIO" ]; then
    echo "⚠️  Aviso: O domínio $DOMAIN não está apontando para este servidor"
    echo "📋 IP do servidor: $IP_SERVIDOR"
    echo "📋 IP do domínio: $IP_DOMINIO"
    echo "🔧 Configure o DNS antes de continuar ou prossiga por sua conta e risco"
    read -p "Deseja continuar mesmo assim? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelado pelo usuário"
        exit 1
    fi
fi

# Obter certificado SSL
echo "🔐 Obtendo certificado SSL..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

# Verificar se o certificado foi instalado
if [ $? -eq 0 ]; then
    echo "✅ SSL configurado com sucesso!"
    
    # Configurar renovação automática
    echo "🔄 Configurando renovação automática..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    # Testar renovação
    sudo certbot renew --dry-run
    
    if [ $? -eq 0 ]; then
        echo "✅ Renovação automática configurada!"
    else
        echo "⚠️ Aviso: Problema na configuração da renovação automática"
    fi
else
    echo "❌ Erro ao configurar SSL"
    echo "🔧 Verifique se:"
    echo "   - O domínio está apontando para este servidor"
    echo "   - As portas 80 e 443 estão abertas"
    echo "   - O Nginx está funcionando"
    exit 1
fi

# Testar HTTPS
echo "🌐 Testando HTTPS..."
curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN

echo "🎉 Configuração SSL concluída!"
echo "📊 Acesse: https://$DOMAIN"