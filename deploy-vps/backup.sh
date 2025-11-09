#!/bin/bash

# 💾 Sistema de Backup - HCC Med Pay Flow

set -e

BACKUP_DIR="/var/backups/hcc-system"
APP_DIR="/var/www/hcc-med-pay-flow"
DOMAIN="hcc.chatconquista.com"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo "💾 Sistema de Backup - HCC Med Pay Flow"
    echo ""
    echo "Uso: ./backup.sh [opção]"
    echo ""
    echo "Opções:"
    echo "  create     Criar backup completo"
    echo "  list       Listar backups disponíveis"
    echo "  restore    Restaurar backup (interativo)"
    echo "  clean      Limpar backups antigos (>30 dias)"
    echo "  auto       Configurar backup automático"
    echo "  help       Mostrar esta ajuda"
}

create_backup() {
    echo -e "${BLUE}💾 Criando backup completo...${NC}"
    
    # Criar diretório de backup
    mkdir -p $BACKUP_DIR
    
    # Timestamp para o backup
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="$BACKUP_DIR/hcc_backup_$timestamp.tar.gz"
    
    echo "📁 Preparando backup..."
    
    # Criar arquivo temporário com informações do sistema
    temp_info="/tmp/backup_info_$timestamp.json"
    cat > $temp_info << EOF
{
  "backup_date": "$(date -Iseconds)",
  "domain": "$DOMAIN",
  "server": "$(hostname)",
  "system": "$(lsb_release -d | cut -f2)",
  "nginx_version": "$(nginx -v 2>&1 | head -1)",
  "node_version": "$(node --version 2>/dev/null || echo 'N/A')",
  "backup_contents": [
    "application_files",
    "nginx_config",
    "ssl_certificates",
    "logs",
    "system_info"
  ]
}
EOF

    echo "📦 Compactando arquivos..."
    
    # Criar backup com exclusões inteligentes
    tar -czf "$backup_file" \
        -C / \
        --exclude='*.log.*.gz' \
        --exclude='*cache*' \
        --exclude='*.tmp' \
        --exclude='*.temp' \
        var/www/hcc-med-pay-flow \
        etc/nginx/sites-available/hcc-app \
        etc/nginx/sites-enabled/hcc-app \
        etc/letsencrypt/live/$DOMAIN \
        etc/letsencrypt/renewal/$DOMAIN.conf \
        var/log/nginx/hcc-app.access.log \
        var/log/nginx/hcc-app.error.log \
        2>/dev/null || true
    
    # Adicionar informações do sistema ao backup
    tar -rf "$backup_file" -C /tmp "backup_info_$timestamp.json" 2>/dev/null || true
    gzip "$backup_file" 2>/dev/null || true
    
    # Limpar arquivo temporário
    rm -f $temp_info
    
    # Verificar se backup foi criado
    if [ -f "$backup_file" ]; then
        backup_size=$(du -h "$backup_file" | cut -f1)
        echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
        echo "📁 Arquivo: $backup_file"
        echo "📊 Tamanho: $backup_size"
        
        # Criar link simbólico para o backup mais recente
        ln -sf "$backup_file" "$BACKUP_DIR/latest_backup.tar.gz"
        
        # Logs de backup
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup criado: $backup_file ($backup_size)" >> "$BACKUP_DIR/backup.log"
        
    else
        echo -e "${RED}❌ Falha ao criar backup${NC}"
        return 1
    fi
}

list_backups() {
    echo -e "${BLUE}📋 Backups Disponíveis${NC}"
    echo "════════════════════════════════════════════════════════════════"
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
        echo "Nenhum backup encontrado."
        return
    fi
    
    echo "📅 Data/Hora        📁 Arquivo                    📊 Tamanho"
    echo "────────────────────────────────────────────────────────────────"
    
    for backup in $(ls -t $BACKUP_DIR/hcc_backup_*.tar.gz 2>/dev/null); do
        if [ -f "$backup" ]; then
            # Extrair timestamp do nome do arquivo
            filename=$(basename "$backup")
            timestamp=${filename#hcc_backup_}
            timestamp=${timestamp%.tar.gz}
            
            # Converter timestamp para formato legível
            year=${timestamp:0:4}
            month=${timestamp:4:2}
            day=${timestamp:6:2}
            hour=${timestamp:9:2}
            minute=${timestamp:11:2}
            
            date_readable="$day/$month/$year $hour:$minute"
            size=$(du -h "$backup" | cut -f1)
            
            # Verificar se é o backup mais recente
            if [ "$backup" -ef "$BACKUP_DIR/latest_backup.tar.gz" ]; then
                echo -e "${GREEN}🟢 $date_readable     $filename     $size (mais recente)${NC}"
            else
                echo "   $date_readable     $filename     $size"
            fi
        fi
    done
    
    echo ""
    echo "📊 Total de backups: $(ls $BACKUP_DIR/hcc_backup_*.tar.gz 2>/dev/null | wc -l)"
    echo "💾 Espaço usado: $(du -sh $BACKUP_DIR 2>/dev/null | cut -f1 || echo 'N/A')"
}

restore_backup() {
    echo -e "${YELLOW}⚠️ RESTAURAÇÃO DE BACKUP${NC}"
    echo "════════════════════════════════════════════════════════════════"
    
    # Listar backups disponíveis
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/hcc_backup_*.tar.gz 2>/dev/null)" ]; then
        echo -e "${RED}❌ Nenhum backup encontrado para restaurar.${NC}"
        return 1
    fi
    
    echo "Backups disponíveis:"
    echo ""
    
    # Array para armazenar caminhos dos backups
    backups=()
    counter=1
    
    for backup in $(ls -t $BACKUP_DIR/hcc_backup_*.tar.gz 2>/dev/null); do
        if [ -f "$backup" ]; then
            filename=$(basename "$backup")
            timestamp=${filename#hcc_backup_}
            timestamp=${timestamp%.tar.gz}
            
            year=${timestamp:0:4}
            month=${timestamp:4:2}
            day=${timestamp:6:2}
            hour=${timestamp:9:2}
            minute=${timestamp:11:2}
            
            date_readable="$day/$month/$year às $hour:$minute"
            size=$(du -h "$backup" | cut -f1)
            
            echo "$counter) $date_readable ($size)"
            backups+=("$backup")
            ((counter++))
        fi
    done
    
    echo ""
    echo -n "Escolha o número do backup para restaurar (ou 'q' para cancelar): "
    read choice
    
    if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
        echo "Restauração cancelada."
        return 0
    fi
    
    # Validar escolha
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#backups[@]} ]; then
        echo -e "${RED}❌ Escolha inválida.${NC}"
        return 1
    fi
    
    selected_backup="${backups[$((choice-1))]}"
    
    echo ""
    echo -e "${YELLOW}⚠️ ATENÇÃO: Esta operação irá substituir os arquivos atuais!${NC}"
    echo "Backup selecionado: $(basename "$selected_backup")"
    echo ""
    echo -n "Tem certeza? Digite 'CONFIRMAR' para continuar: "
    read confirmation
    
    if [ "$confirmation" != "CONFIRMAR" ]; then
        echo "Restauração cancelada."
        return 0
    fi
    
    echo ""
    echo -e "${BLUE}🔄 Iniciando restauração...${NC}"
    
    # Criar backup de segurança antes da restauração
    echo "💾 Criando backup de segurança..."
    safety_backup="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$safety_backup" -C / var/www/hcc-med-pay-flow etc/nginx/sites-available/hcc-app 2>/dev/null || true
    
    # Parar serviços
    echo "⏸️ Parando serviços..."
    systemctl stop nginx
    
    # Restaurar arquivos
    echo "📁 Restaurando arquivos..."
    tar -xzf "$selected_backup" -C / 2>/dev/null
    
    # Ajustar permissões
    echo "🔧 Ajustando permissões..."
    chown -R www-data:www-data $APP_DIR 2>/dev/null || true
    chmod -R 755 $APP_DIR 2>/dev/null || true
    
    # Testar configuração do nginx
    echo "🧪 Testando configuração..."
    if nginx -t; then
        echo "✅ Configuração válida"
        systemctl start nginx
        
        if systemctl is-active --quiet nginx; then
            echo -e "${GREEN}✅ Restauração concluída com sucesso!${NC}"
            echo "📋 Backup de segurança salvo em: $safety_backup"
        else
            echo -e "${RED}❌ Nginx não iniciou após restauração${NC}"
        fi
    else
        echo -e "${RED}❌ Configuração inválida após restauração${NC}"
        echo "🔄 Tentando reverter..."
        
        # Tentar reverter usando backup de segurança
        tar -xzf "$safety_backup" -C / 2>/dev/null || true
        systemctl start nginx
    fi
}

clean_old_backups() {
    echo -e "${BLUE}🧹 Limpando backups antigos...${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "Diretório de backup não encontrado."
        return
    fi
    
    # Encontrar backups com mais de 30 dias
    old_backups=$(find $BACKUP_DIR -name "hcc_backup_*.tar.gz" -type f -mtime +30 2>/dev/null || true)
    
    if [ -z "$old_backups" ]; then
        echo "✅ Nenhum backup antigo encontrado."
        return
    fi
    
    echo "Backups que serão removidos (>30 dias):"
    echo "$old_backups"
    echo ""
    echo -n "Confirmar remoção? (y/N): "
    read confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        removed_count=0
        for backup in $old_backups; do
            rm -f "$backup"
            ((removed_count++))
            echo "🗑️ Removido: $(basename "$backup")"
        done
        
        echo -e "${GREEN}✅ $removed_count backups antigos removidos.${NC}"
        
        # Atualizar log
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Limpeza: $removed_count backups removidos" >> "$BACKUP_DIR/backup.log"
    else
        echo "Limpeza cancelada."
    fi
}

setup_auto_backup() {
    echo -e "${BLUE}🤖 Configurando backup automático...${NC}"
    
    # Criar script de backup automático
    cat > /usr/local/bin/hcc-auto-backup.sh << 'EOF'
#!/bin/bash
# Backup automático do HCC Med Pay Flow
cd /root/deploy-vps
./backup.sh create
# Limpar backups antigos automaticamente
./backup.sh clean-auto
EOF
    
    chmod +x /usr/local/bin/hcc-auto-backup.sh
    
    # Configurar cron job para backup diário às 2:00
    cat > /etc/cron.d/hcc-backup << 'EOF'
# Backup automático diário do HCC Med Pay Flow
0 2 * * * root /usr/local/bin/hcc-auto-backup.sh >> /var/log/hcc-backup.log 2>&1
EOF
    
    echo -e "${GREEN}✅ Backup automático configurado!${NC}"
    echo "⏰ Executará diariamente às 02:00"
    echo "📋 Logs em: /var/log/hcc-backup.log"
    echo ""
    echo "🔧 Para testar agora: /usr/local/bin/hcc-auto-backup.sh"
}

clean_auto() {
    # Limpeza automática (não interativa) para uso no cron
    find $BACKUP_DIR -name "hcc_backup_*.tar.gz" -type f -mtime +30 -delete 2>/dev/null || true
}

# Verificar se é root para algumas operações
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ Esta operação requer privilégios de root${NC}"
        echo "   Execute: sudo ./backup.sh $1"
        exit 1
    fi
}

# Processar argumentos
case "${1:-help}" in
    "create")
        check_root "create"
        create_backup
        ;;
    "list")
        list_backups
        ;;
    "restore")
        check_root "restore"
        restore_backup
        ;;
    "clean")
        check_root "clean"
        clean_old_backups
        ;;
    "clean-auto")
        # Para uso interno do cron
        clean_auto
        ;;
    "auto")
        check_root "auto"
        setup_auto_backup
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Opção inválida: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac