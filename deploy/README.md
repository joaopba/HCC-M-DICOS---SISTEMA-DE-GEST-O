# 🚀 Deploy HCC Med Pay Flow - VPS Ubuntu

Este guia fornece scripts automatizados para deploy da aplicação HCC Med Pay Flow em uma VPS Ubuntu.

## 📋 Pré-requisitos

- VPS Ubuntu 18.04+ com acesso root
- Domínio configurado apontando para o IP da VPS
- Acesso SSH à VPS

## 🔧 Passos do Deploy

### 1. Preparar os arquivos

1. Faça upload desta pasta `deploy` para sua VPS:
```bash
scp -r deploy/ root@72.60.157.200:/root/
```

2. Conecte-se à VPS:
```bash
ssh root@72.60.157.200
```

3. Navegue para a pasta:
```bash
cd /root/deploy
```

4. Torne os scripts executáveis:
```bash
chmod +x *.sh
```

### 2. Executar os scripts na ordem

#### Passo 1: Preparar a VPS
```bash
./01-prepare-vps.sh
```
**O que faz:**
- Atualiza o sistema
- Instala Node.js 18, Nginx, Certbot
- Configura firewall
- Cria diretórios necessários

#### Passo 2: Deploy da aplicação
```bash
./02-deploy-app.sh
```

**O que faz:**
- Copia e instala a aplicação
- Configura Nginx
- Faz build de produção
- Configura variáveis de ambiente

#### Passo 3: Configurar SSL
```bash
./03-setup-ssl.sh
```
**O que faz:**
- Instala certificado SSL gratuito
- Configura HTTPS
- Configura renovação automática

#### Passo 4: Configurar monitoramento (opcional)
```bash
./04-setup-monitoring.sh
```
**O que faz:**
- Configura logs e rotação
- Backup automático diário
- Monitoramento de saúde
- Proteção fail2ban

## 🌐 URLs e Portas

Após o deploy, sua aplicação estará disponível em:
- **HTTP:** http://hcc.chatconquista.com (redireciona para HTTPS)
- **HTTPS:** https://hcc.chatconquista.com

## 🔍 Verificação

### Testar a aplicação
```bash
curl -I https://hcc.chatconquista.com
```

### Ver status completo
```bash
sudo /opt/hcc-backup/status.sh
```

### Ver logs do Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🛠️ Comandos Úteis

### Reiniciar serviços
```bash
sudo systemctl restart nginx
```

### Atualizar aplicação
```bash
cd /var/www/hcc-med-pay-flow
git pull  # se usando git
npm run build
sudo systemctl reload nginx
```

### Backup manual
```bash
sudo /opt/hcc-backup/backup.sh
```

### Ver certificado SSL
```bash
sudo certbot certificates
```

## 🔒 Segurança

- Firewall configurado (portas 22, 80, 443)
- SSL/TLS com renovação automática
- Fail2ban para proteção contra ataques
- Headers de segurança configurados
- Logs rotacionados automaticamente

## 📊 Supabase

A aplicação está configurada para usar o Supabase com:
- **URL:** https://nnytrkgsjajsecotasqv.supabase.co
- **Project ID:** nnytrkgsjajsecotasqv
- **Anon Key:** Configurada automaticamente

## 🆘 Solução de Problemas

### Aplicação não carrega
1. Verificar se o Nginx está rodando: `sudo systemctl status nginx`
2. Verificar logs: `sudo tail -f /var/log/nginx/error.log`
3. Verificar DNS: `dig hcc.chatconquista.com`

### SSL não funciona
1. Verificar se o domínio aponta para o servidor
2. Tentar novamente: `sudo certbot --nginx -d hcc.chatconquista.com`
3. Verificar firewall: `sudo ufw status`

### Erro 502/503
1. Verificar se a aplicação foi compilada: `ls -la /var/www/hcc-med-pay-flow/dist/`
2. Recompilar: `cd /var/www/hcc-med-pay-flow && npm run build`
3. Reiniciar Nginx: `sudo systemctl restart nginx`

## 📞 Suporte

Em caso de problemas:
1. Execute: `sudo /opt/hcc-backup/status.sh`
2. Verifique os logs em `/var/log/nginx/`
3. Verifique o monitoramento em `/var/log/hcc-monitor.log`

---

**✅ Após executar todos os scripts, sua aplicação estará funcionando em produção com SSL, monitoramento e backup automático!**