#!/bin/bash

# 📋 Visualização de Logs - HCC Med Pay Flow

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo "📋 Visualizador de Logs - HCC Med Pay Flow"
    echo ""
    echo "Uso: ./logs.sh [opção]"
    echo ""
    echo "Opções:"
    echo "  access     Ver logs de acesso do Nginx"
    echo "  error      Ver logs de erro do Nginx"
    echo "  system     Ver logs do sistema"
    echo "  live       Acompanhar logs em tempo real"
    echo "  all        Ver todos os logs recentes"
    echo "  help       Mostrar esta ajuda"
    echo ""
    echo "Sem parâmetro mostra um resumo geral"
}

show_access_logs() {
    echo -e "${BLUE}📊 LOGS DE ACESSO (últimas 50 linhas)${NC}"
    echo "════════════════════════════════════════════════════════════════"
    if [ -f "/var/log/nginx/hcc-app.access.log" ]; then
        tail -50 /var/log/nginx/hcc-app.access.log
    else
        echo -e "${YELLOW}⚠️ Arquivo de log não encontrado${NC}"
    fi
    echo ""
}

show_error_logs() {
    echo -e "${RED}❌ LOGS DE ERRO (últimas 50 linhas)${NC}"
    echo "════════════════════════════════════════════════════════════════"
    if [ -f "/var/log/nginx/hcc-app.error.log" ]; then
        tail -50 /var/log/nginx/hcc-app.error.log
    else
        echo -e "${YELLOW}⚠️ Arquivo de log não encontrado${NC}"
    fi
    echo ""
}

show_system_logs() {
    echo -e "${BLUE}⚙️ LOGS DO SISTEMA${NC}"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    echo -e "${BLUE}🌐 Nginx:${NC}"
    journalctl -u nginx --no-pager -n 20 --since "1 hour ago"
    echo ""
    
    echo -e "${BLUE}🔒 Certbot:${NC}"
    journalctl -u certbot --no-pager -n 10 --since "1 day ago" || echo "Nenhum log do certbot"
    echo ""
    
    echo -e "${BLUE}🛡️ UFW:${NC}"
    grep UFW /var/log/syslog | tail -10 || echo "Nenhum log do UFW recente"
    echo ""
}

show_live_logs() {
    echo -e "${GREEN}📡 LOGS EM TEMPO REAL${NC}"
    echo "════════════════════════════════════════════════════════════════"
    echo "Pressione Ctrl+C para parar"
    echo ""
    
    # Monitorar múltiplos arquivos
    tail -f /var/log/nginx/hcc-app.access.log /var/log/nginx/hcc-app.error.log /var/log/syslog 2>/dev/null
}

show_summary() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                📋 RESUMO DOS LOGS                            ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Estatísticas de acesso
    echo -e "${BLUE}📊 ESTATÍSTICAS DE ACESSO (última hora)${NC}"
    if [ -f "/var/log/nginx/hcc-app.access.log" ]; then
        # Total de requests
        total_requests=$(grep "$(date '+%d/%b/%Y:%H')" /var/log/nginx/hcc-app.access.log | wc -l)
        echo "   • Total de requests: $total_requests"
        
        # Status codes
        echo "   • Status codes:"
        grep "$(date '+%d/%b/%Y:%H')" /var/log/nginx/hcc-app.access.log | awk '{print $9}' | sort | uniq -c | sort -nr | head -5 | while read count code; do
            case $code in
                200) echo -e "     ${GREEN}$code: $count requests${NC}" ;;
                301|302) echo -e "     ${YELLOW}$code: $count requests${NC}" ;;
                4*|5*) echo -e "     ${RED}$code: $count requests${NC}" ;;
                *) echo "     $code: $count requests" ;;
            esac
        done
        
        # IPs mais ativos
        echo "   • Top 5 IPs:"
        grep "$(date '+%d/%b/%Y:%H')" /var/log/nginx/hcc-app.access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -5 | while read count ip; do
            echo "     $ip: $count requests"
        done
        
        # User agents
        echo "   • Navegadores mais comuns:"
        grep "$(date '+%d/%b/%Y:%H')" /var/log/nginx/hcc-app.access.log | grep -o '"[^"]*"$' | sort | uniq -c | sort -nr | head -3 | while read count agent; do
            echo "     $count - $(echo $agent | cut -c2- | rev | cut -c2- | rev)"
        done
    else
        echo -e "${YELLOW}⚠️ Log de acesso não encontrado${NC}"
    fi
    echo ""
    
    # Erros recentes
    echo -e "${RED}❌ ERROS RECENTES (últimas 24h)${NC}"
    if [ -f "/var/log/nginx/hcc-app.error.log" ]; then
        error_count=$(grep "$(date '+%Y/%m/%d')" /var/log/nginx/hcc-app.error.log | wc -l)
        if [ $error_count -eq 0 ]; then
            echo -e "   ${GREEN}✅ Nenhum erro encontrado hoje${NC}"
        else
            echo "   • Total de erros hoje: $error_count"
            echo "   • Últimos 3 erros:"
            tail -3 /var/log/nginx/hcc-app.error.log | sed 's/^/     /'
        fi
    else
        echo -e "${YELLOW}⚠️ Log de erro não encontrado${NC}"
    fi
    echo ""
    
    # Status dos serviços
    echo -e "${BLUE}⚙️ STATUS DOS SERVIÇOS${NC}"
    services=("nginx" "ufw")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet $service; then
            echo -e "   • $service: ${GREEN}✅ Rodando${NC}"
        else
            echo -e "   • $service: ${RED}❌ Parado${NC}"
        fi
    done
    echo ""
    
    # Espaço em disco para logs
    echo -e "${BLUE}💾 ESPAÇO DOS LOGS${NC}"
    echo "   • /var/log/nginx/: $(du -sh /var/log/nginx/ 2>/dev/null | cut -f1 || echo 'N/A')"
    echo "   • Total /var/log/: $(du -sh /var/log/ 2>/dev/null | cut -f1 || echo 'N/A')"
    echo ""
    
    echo -e "${BLUE}🔧 COMANDOS ÚTEIS${NC}"
    echo "   • Ver logs de acesso: ./logs.sh access"
    echo "   • Ver logs de erro: ./logs.sh error"  
    echo "   • Acompanhar em tempo real: ./logs.sh live"
    echo "   • Limpar logs antigos: sudo logrotate -f /etc/logrotate.conf"
}

show_all() {
    show_summary
    echo ""
    show_access_logs
    show_error_logs
    show_system_logs
}

# Verificar parâmetro
case "${1:-summary}" in
    "access")
        show_access_logs
        ;;
    "error")
        show_error_logs
        ;;
    "system")
        show_system_logs
        ;;
    "live")
        show_live_logs
        ;;
    "all")
        show_all
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    "summary"|*)
        show_summary
        ;;
esac