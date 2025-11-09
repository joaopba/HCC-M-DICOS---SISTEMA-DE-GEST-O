# 📋 INSTRUÇÕES DE INSTALAÇÃO - HCC Med Pay Flow

## 🎯 Método Recomendado (Mais Simples)

### Passo 1: Upload dos arquivos
```bash
# Na sua máquina local, onde está o projeto
scp -r deploy-vps/ root@72.60.157.200:/root/
```

### Passo 2: Executar na VPS
```bash
# Conectar na VPS
ssh root@72.60.157.200

# Ir para a pasta e executar
cd /root/deploy-vps
chmod +x install.sh
./install.sh
```

## ⚡ Método Ultra-Rápido (Uma linha)

Execute este comando na sua máquina local:
```bash
scp -r deploy-vps/ root@72.60.157.200:/root/ && ssh root@72.60.157.200 'cd /root/deploy-vps && chmod +x install.sh && ./install.sh'
```

## 🔧 O que será instalado automaticamente

- ✅ **Node.js 18** - Para buildar a aplicação
- ✅ **Nginx** - Servidor web otimizado  
- ✅ **SSL/HTTPS** - Certificado gratuito Let's Encrypt
- ✅ **Firewall** - UFW configurado e ativo
- ✅ **PM2** - Gerenciador de processos
- ✅ **Aplicação React** - Build e configuração automática

## 🌐 URLs que funcionarão após instalação

- **Site principal:** https://hcc.chatconquista.com
- **Status:** https://hcc.chatconquista.com/status  
- **Health check:** https://hcc.chatconquista.com/health
- **HTTP (redireciona):** http://hcc.chatconquista.com

## 📊 Comandos úteis após instalação

```bash
# Ver status completo
./status.sh

# Ver logs
./logs.sh

# Reiniciar serviços  
./restart.sh

# Acompanhar logs em tempo real
./logs.sh live

# Fazer novo deploy da aplicação
./restart.sh deploy
```

## 🆘 Resolução de Problemas

### ❌ Erro de permissão
```bash
chmod +x *.sh
```

### ❌ Nginx não inicia
```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

### ❌ SSL não funciona
```bash
# Verificar se domínio está apontando correto
dig hcc.chatconquista.com

# Tentar renovar SSL
sudo certbot --nginx -d hcc.chatconquista.com --force-renewal
```

### ❌ Site não carrega
```bash
# Verificar status dos serviços
./status.sh

# Ver logs de erro
./logs.sh error

# Verificar firewall
sudo ufw status
```

### ❌ Erro "No such file or directory"
```bash
# Verificar se está na pasta correta
pwd
ls -la

# Ir para pasta correta
cd /root/deploy-vps
```

## 📱 Configurar Webhook no Supabase

Após a instalação, configure o webhook:

1. Acesse: https://supabase.com/dashboard/project/nnytrkgsjajsecotasqv/settings/functions

2. Configure os secrets:
   ```
   SUPABASE_URL=https://nnytrkgsjajsecotasqv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyMTc4NSwiZXhwIjoyMDc0NTk3Nzg1fQ.7k5dgbLpH56EIUNiJpER7-BFksUR7R11iOrNwiBDN24
   ```

3. Configure as URLs de redirect:
   ```
   https://hcc.chatconquista.com/**
   https://hcc.chatconquista.com/auth/callback
   ```

## 📋 Checklist de Verificação

Após instalação, execute o validador automático:
```bash
chmod +x validate-deployment.sh
./validate-deployment.sh
```

O script testa automaticamente:
- [ ] Site carrega: https://hcc.chatconquista.com
- [ ] Portal médicos: https://hcc.chatconquista.com/dashboard-medicos
- [ ] SSL ativo (cadeado verde no navegador)
- [ ] HTTP redireciona para HTTPS
- [ ] Todas as 4 edge functions
- [ ] REST API Supabase
- [ ] Nginx, disco, RAM
- [ ] Webhook configurado no Supabase

## 🔄 Atualizações Futuras

Para atualizar a aplicação:
```bash
# Conectar na VPS
ssh root@72.60.157.200

# Ir para pasta de deploy
cd /root/deploy-vps

# Fazer novo deploy
./restart.sh deploy
```

## 📞 Suporte

Se algo não funcionar:
1. Execute `./status.sh` e anote os erros
2. Execute `./logs.sh error` para ver logs detalhados
3. Verifique se o domínio está apontando correto: `dig hcc.chatconquista.com`

---

**🎉 Boa sorte com o deploy! O sistema foi projetado para funcionar automaticamente.**