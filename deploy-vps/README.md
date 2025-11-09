# 🚀 Deploy Automático - HCC Med Pay Flow

## 📋 Pré-requisitos

- VPS Ubuntu 20.04+ 
- Acesso root via SSH
- Domínio apontado para IP: `hcc.chatconquista.com` → `72.60.157.200`

## 📦 Instalação Rápida

### 1. Enviar arquivos para VPS
```bash
scp -r deploy-vps/ root@72.60.157.200:/root/
```

### 2. Conectar na VPS
```bash
ssh root@72.60.157.200
```

### 3. Executar instalação
```bash
cd /root/deploy-vps
chmod +x *.sh
./install.sh
```

## 🔧 O que será instalado

- ✅ Node.js 18+ e npm
- ✅ Nginx com configuração otimizada  
- ✅ SSL/HTTPS automático (Let's Encrypt)
- ✅ PM2 para gerenciamento de processos
- ✅ Firewall configurado (UFW)
- ✅ Aplicação React buildada e servida
- ✅ Logs e monitoramento

## 🌐 URLs Finais

Após instalação:
- **Frontend:** https://hcc.chatconquista.com
- **Status:** https://hcc.chatconquista.com/status

## 🔍 Verificar Status

```bash
# Status geral
./status.sh

# Logs da aplicação
./logs.sh

# Reiniciar serviços
./restart.sh
```

## 🧪 Validação e Testes

```bash
# Validação completa pós-deploy (19 testes automatizados)
./validate-deployment.sh

# Verificar requisitos antes do deploy
./check-requirements.sh

# Testar sistema completo
./test-system.sh
```

O `validate-deployment.sh` testa:
- ✅ DNS e SSL
- ✅ Frontend (rotas, assets)
- ✅ Backend (4 edge functions)
- ✅ Supabase REST API
- ✅ Servidor (Nginx, disco, RAM)

## 🆘 Resolução de Problemas

### Erro de permissão
```bash
chmod +x *.sh
```

### Nginx não inicia
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### SSL não funciona
```bash
sudo certbot --nginx -d hcc.chatconquista.com --force-renewal
```

### Verificar firewall
```bash
sudo ufw status
```

## 📊 Estrutura dos Arquivos

```
deploy-vps/
├── install.sh          # Script principal de instalação
├── setup-nginx.sh      # Configuração do Nginx
├── setup-ssl.sh        # Configuração SSL
├── deploy-app.sh       # Deploy da aplicação
├── status.sh           # Verificar status
├── logs.sh             # Ver logs
├── restart.sh          # Reiniciar serviços
├── configs/            # Arquivos de configuração
│   ├── nginx.conf      # Config do Nginx
│   └── app.conf        # Config da aplicação
└── README.md           # Este arquivo
```