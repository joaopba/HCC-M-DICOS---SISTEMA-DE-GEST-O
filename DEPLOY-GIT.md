# 🚀 Deploy VPS via Git - HCC Med Pay Flow

## 📋 Fluxo Completo

```mermaid
graph LR
    A[Lovable] -->|auto| B[GitHub]
    B -->|manual/auto| C[VPS]
    C -->|serve| D[https://hcc.chatconquista.com]
```

## 🎯 Opção 1: Deploy Manual (Recomendado para começar)

### Primeira vez na VPS:

```bash
# 1. Conectar na VPS
ssh root@72.60.157.200

# 2. Deploy inicial
cd /root
git clone https://github.com/joaopba/hcc-med-pay-flow.git temp-deploy
cd temp-deploy/deploy-vps
chmod +x *.sh
./deploy-from-git.sh
```

### Atualizações futuras (após editar no Lovable):

```bash
# Opção rápida em 1 linha:
ssh root@72.60.157.200 "cd /var/www/hcc-med-pay-flow && ./deploy-vps/update.sh"

# Ou conectando na VPS:
ssh root@72.60.157.200
cd /var/www/hcc-med-pay-flow
./deploy-vps/update.sh
```

**Fluxo:**
1. ✏️ Você edita no Lovable
2. ✅ Lovable → GitHub (automático)
3. 🔄 Você roda `update.sh` na VPS (manual)
4. 🎉 Site atualizado!

---

## 🤖 Opção 2: Deploy Automático (Avançado)

Para que **TODA** alteração no GitHub atualize automaticamente a VPS:

```bash
ssh root@72.60.157.200
cd /var/www/hcc-med-pay-flow
./deploy-vps/setup-auto-deploy.sh
```

Este script vai:
- Instalar webhook daemon
- Gerar URL e secret do webhook
- Mostrar instruções para configurar no GitHub

**Depois de configurar:**
1. ✏️ Edita no Lovable
2. ✅ Lovable → GitHub (auto)
3. 🚀 GitHub → VPS (auto via webhook)
4. 🎉 Site atualizado automaticamente!

---

## 📊 Comandos Úteis

### Ver status do deploy:
```bash
ssh root@72.60.157.200
cd /var/www/hcc-med-pay-flow

# Ver último commit deployado
git log -1 --oneline

# Ver status dos serviços
sudo systemctl status nginx
```

### Reverter para versão anterior:
```bash
cd /var/www/hcc-med-pay-flow

# Ver últimos commits
git log --oneline -10

# Reverter para commit específico
git reset --hard COMMIT_HASH
npm run build
sudo systemctl reload nginx
```

### Ver logs de erro:
```bash
# Logs do Nginx
sudo tail -f /var/log/nginx/error.log

# Logs do webhook (se instalado)
sudo journalctl -u webhook -f
```

---

## 🔧 Estrutura de Diretórios na VPS

```
/var/www/hcc-med-pay-flow/
├── .git/                  # Repositório Git
├── dist/                  # Build (servido pelo Nginx)
├── src/                   # Código fonte
├── deploy-vps/            # Scripts de deploy
│   ├── deploy-from-git.sh # Deploy inicial
│   ├── update.sh          # Atualização rápida
│   └── setup-auto-deploy.sh # Config webhook
├── package.json
└── node_modules/
```

---

## ⚡ Comparação

| Método | Velocidade | Complexidade | Controle |
|--------|-----------|--------------|----------|
| **Manual** | ~2 min | Baixa ⭐ | Total ✅ |
| **Automático** | ~30 seg | Média ⭐⭐ | Menor ⚠️ |

---

## 🆘 Troubleshooting

### Deploy falhou:
```bash
cd /var/www/hcc-med-pay-flow
git status
git log -3
npm run build
```

### Site não atualizou:
```bash
# Forçar atualização
cd /var/www/hcc-med-pay-flow
git fetch --all
git reset --hard origin/main
npm run build
sudo systemctl restart nginx
```

### Ver backups:
```bash
ls -lh /var/backups/hcc-app-*
```

---

## 📞 Suporte

Qualquer problema, verifique:
1. GitHub: https://github.com/joaopba/hcc-med-pay-flow
2. VPS: `ssh root@72.60.157.200`
3. Site: https://hcc.chatconquista.com
