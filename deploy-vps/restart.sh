#!/bin/bash

# 🔄 Script de Reinicialização - HCC Med Pay Flow

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo "🔄 Reinicialização de Serviços - HCC Med Pay Flow"
    echo ""
    echo "Uso: ./restart.sh [opção]"
    echo ""
    echo "Opções:"
    echo "  nginx      Reiniciar apenas Nginx"
    echo "  ssl        Renovar SSL e reiniciar Nginx"
    echo "  all        Reiniciar todos os serviços (padrão)"
    echo "  deploy     Fazer novo deploy da aplicação"
    echo "  help       Mostrar esta ajuda"
}

restart_nginx() {
    echo -e "${BLUE}🌐 Reiniciando Nginx...${NC}"
    
    # Testar configuração primeiro
    echo "🔧 Testando configuração do Nginx..."
    if nginx -t; then
        echo -e "${GREEN}✅ Configuração válida${NC}"
        
        echo "🔄 Reiniciando serviço..."
        if systemctl restart nginx; then
            echo -e "${GREEN}✅ Nginx reiniciado com sucesso${NC}"
            
            # Verificar status
            if systemctl is-active --quiet nginx; then
                echo -e "${GREEN}✅ Nginx está rodando${NC}"
            else
                echo -e "${RED}❌ Nginx não está rodando após reinicialização${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Falha ao reiniciar Nginx${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Configuração inválida do Nginx${NC}"
        echo "🔧 Para ver detalhes: nginx -t"
        return 1
    fi
}

renew_ssl() {
    echo -e "${BLUE}🔒 Renovando certificado SSL...${NC}"
    
    # Verificar se certbot está instalado
    if ! command -v certbot &> /dev/null; then
        echo -e "${RED}❌ Certbot não está instalado${NC}"
        return 1
    fi
    
    # Renovar certificados
    echo "🔄 Executando renovação..."
    if certbot renew --quiet; then
        echo -e "${GREEN}✅ Certificados verificados/renovados${NC}"
        
        # Recarregar nginx para usar novos certificados
        echo "🔄 Recarregando Nginx..."
        if systemctl reload nginx; then
            echo -e "${GREEN}✅ Nginx recarregado${NC}"
        else
            echo -e "${YELLOW}⚠️ Falha ao recarregar Nginx${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Renovação não necessária ou falhou${NC}"
    fi
}

restart_firewall() {
    echo -e "${BLUE}🛡️ Reiniciando Firewall...${NC}"
    
    if systemctl restart ufw; then
        echo -e "${GREEN}✅ UFW reiniciado${NC}"
        
        # Reativar se necessário
        ufw --force enable > /dev/null 2>&1
        
        if systemctl is-active --quiet ufw; then
            echo -e "${GREEN}✅ UFW está ativo${NC}"
        fi
    else
        echo -e "${RED}❌ Falha ao reiniciar UFW${NC}"
    fi
}

restart_all() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║             🔄 REINICIALIZAÇÃO COMPLETA                      ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # 1. Nginx
    restart_nginx
    nginx_status=$?
    echo ""
    
    # 2. Firewall
    restart_firewall
    echo ""
    
    # 3. SSL (se nginx OK)
    if [ $nginx_status -eq 0 ]; then
        renew_ssl
        echo ""
    fi
    
    # 4. Verificação final
    echo -e "${BLUE}🧪 Verificação pós-reinicialização...${NC}"
    
    # Aguardar estabilização
    sleep 3
    
    # Testar conectividade
    DOMAIN="hcc.chatconquista.com"
    
    echo "🌐 Testando HTTP..."
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" 2>/dev/null || echo "000")
    if [[ "$http_code" =~ ^[23] ]]; then
        echo -e "${GREEN}✅ HTTP OK ($http_code)${NC}"
    else
        echo -e "${RED}❌ HTTP falhou ($http_code)${NC}"
    fi
    
    echo "🔒 Testando HTTPS..."
    https_code=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
    if [[ "$https_code" =~ ^[23] ]]; then
        echo -e "${GREEN}✅ HTTPS OK ($https_code)${NC}"
    else
        echo -e "${YELLOW}⚠️ HTTPS falhou ($https_code)${NC}"
    fi
    
    # Status dos serviços
    echo ""
    echo -e "${BLUE}📊 Status final dos serviços:${NC}"
    services=("nginx" "ufw")
    all_ok=true
    
    for service in "${services[@]}"; do
        if systemctl is-active --quiet $service; then
            echo -e "   • $service: ${GREEN}✅ Ativo${NC}"
        else
            echo -e "   • $service: ${RED}❌ Inativo${NC}"
            all_ok=false
        fi
    done
    
    echo ""
    if [ "$all_ok" = true ] && [[ "$http_code" =~ ^[23] ]]; then
        echo -e "${GREEN}🎉 REINICIALIZAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
    else
        echo -e "${YELLOW}⚠️ REINICIALIZAÇÃO CONCLUÍDA COM AVISOS${NC}"
        echo "   Execute ./status.sh para mais detalhes"
    fi
}

deploy_app() {
    echo -e "${BLUE}🚀 Fazendo novo deploy da aplicação...${NC}"
    
    if [ -f "./deploy-app.sh" ]; then
        chmod +x ./deploy-app.sh
        if ./deploy-app.sh; then
            echo -e "${GREEN}✅ Deploy concluído${NC}"
            
            # Reiniciar nginx após deploy
            echo "🔄 Reiniciando Nginx..."
            restart_nginx
        else
            echo -e "${RED}❌ Falha no deploy${NC}"
        fi
    else
        echo -e "${RED}❌ Script deploy-app.sh não encontrado${NC}"
    fi
}

# Verificar se é root para operações críticas
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ Este comando requer privilégios de root${NC}"
        echo "   Execute: sudo ./restart.sh $1"
        exit 1
    fi
}

# Processar argumentos
case "${1:-all}" in
    "nginx")
        check_root "nginx"
        restart_nginx
        ;;
    "ssl")
        check_root "ssl"
        renew_ssl
        ;;
    "all")
        check_root "all"
        restart_all
        ;;
    "deploy")
        check_root "deploy"
        deploy_app
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