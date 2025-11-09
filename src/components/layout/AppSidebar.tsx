import { 
  Home, 
  Users, 
  CreditCard, 
  Settings, 
  LogOut, 
  FileText, 
  MessageCircle,
  Activity,
  Building2,
  User
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

const navigation = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: Home,
    description: "Visão geral do sistema"
  },
  { 
    name: "Médicos", 
    href: "/medicos", 
    icon: Users,
    description: "Gerenciar médicos"
  },
  { 
    name: "Chat", 
    href: "/chat", 
    icon: MessageCircle,
    description: "Chat com médicos"
  },
  { 
    name: "Pagamentos", 
    href: "/pagamentos", 
    icon: CreditCard,
    description: "Controle de pagamentos"
  },
  { 
    name: "Usuários", 
    href: "/usuarios", 
    icon: User,
    description: "Gerenciar usuários",
    adminOnly: true
  },
  { 
    name: "Relatórios", 
    href: "/relatorios", 
    icon: FileText,
    description: "Relatórios e analytics"
  },
];

const toolsNavigation = [
  { 
    name: "Teste WhatsApp", 
    href: "/teste-whatsapp", 
    icon: MessageCircle,
    description: "Testar envio de mensagens",
    adminOnly: true
  },
  { 
    name: "Configurações", 
    href: "/configuracoes", 
    icon: Settings,
    description: "Configurar sistema",
    adminOnly: true
  },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const [userRole, setUserRole] = useState<string>('usuario');

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setUserRole(profile.role);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar role do usuário:', error);
    }
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar 
        className="border-r border-sidebar-border glass-effect transition-all duration-300"
        collapsible="icon"
      >
        <SidebarHeader className="border-b border-sidebar-border/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative flex-shrink-0">
                  <div className="relative w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-sm">
                    <Building2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p className="font-semibold">HCC Hospital</p>
                </TooltipContent>
              )}
            </Tooltip>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="min-w-0 flex-1"
                >
                  <h2 className="font-bold text-sidebar-foreground text-base truncate">
                    HCC Hospital
                  </h2>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    Sistema de Gestão
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </SidebarHeader>
      
      <SidebarContent className="p-3 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-3"
              >
                Principal
              </motion.p>
            )}
          </AnimatePresence>
          <SidebarMenu className="space-y-1">
            {navigation
              .filter(item => !item.adminOnly || userRole === 'gestor')
              .map((item, index) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.href}
                        className={
                          isActive(item.href)
                            ? "sidebar-nav-premium-active"
                            : "sidebar-nav-premium-inactive"
                        }
                      >
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                        </motion.div>
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="flex-1 min-w-0"
                            >
                              <span className="font-semibold text-sm">{item.name}</span>
                              <p className="text-xs opacity-70 mt-0.5">
                                {item.description}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </NavLink>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        <Separator className="bg-sidebar-border/50" />

        {/* Tools Navigation */}
        <div className="space-y-1">
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-3"
              >
                Ferramentas
              </motion.p>
            )}
          </AnimatePresence>
          <SidebarMenu className="space-y-1">
            {toolsNavigation
              .filter(item => !item.adminOnly || userRole === 'gestor')
              .map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.href}
                        className={
                          isActive(item.href)
                            ? "sidebar-nav-premium-active"
                            : "sidebar-nav-premium-inactive"
                        }
                      >
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                        </motion.div>
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="flex-1 min-w-0"
                            >
                              <span className="font-semibold text-sm">{item.name}</span>
                              <p className="text-xs opacity-70 mt-0.5">
                                {item.description}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </NavLink>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50">
        <div className="space-y-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="px-3 py-2 glass-effect rounded-xl border border-success/20"
              >
                <div className="flex items-center gap-2 text-xs">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Activity className="h-3 w-3 text-success" />
                  </motion.div>
                  <span className="text-sidebar-foreground/80 font-medium">Sistema Online</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button
            variant="ghost"
            asChild
            className="w-full justify-start hover:bg-sidebar-accent/80 rounded-xl transition-all hover:scale-105"
            title={collapsed ? "Meu Perfil" : undefined}
          >
            <NavLink to="/perfil">
              <User className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="ml-2 font-medium">Meu Perfil</span>}
            </NavLink>
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all hover:scale-105"
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2 font-medium">Sair do Sistema</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
    </TooltipProvider>
  );
}