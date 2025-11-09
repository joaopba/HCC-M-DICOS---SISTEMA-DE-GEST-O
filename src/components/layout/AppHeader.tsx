import { Bell, Search, User, Menu, Moon, Sun, LogOut, UserCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "framer-motion";
import { SearchModal } from "@/components/SearchModal";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

interface NotasPendentes {
  id: string;
  medicos: {
    nome: string;
  };
  valor: number;
  mes_competencia: string;
}

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
  const [userName, setUserName] = useState("Usuário");
  const [userEmail, setUserEmail] = useState("");
  const [notasPendentes, setNotasPendentes] = useState<NotasPendentes[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    loadUserData();
    loadNotasPendentes();
    
    // Keyboard shortcut for search (Cmd/Ctrl + K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setUserName(profile.name);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  const loadNotasPendentes = async () => {
    try {
      const { data } = await supabase
        .from('pagamentos')
        .select(`
          id,
          valor,
          mes_competencia,
          medicos!inner (
            nome
          )
        `)
        .in('status', ['nota_recebida'])
        .limit(5);

      if (data) {
        setNotasPendentes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar notas pendentes:', error);
    }
  };

  const handleNotificationClick = () => {
    navigate('/pagamentos');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  return (
    <>
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <TooltipProvider>
        <header className="h-16 border-b border-border glass-effect sticky top-0 z-40">
        <div className="flex items-center justify-between h-full px-6">
          {/* Left Side */}
          <div className="flex items-center gap-4">
            <SidebarTrigger className="p-2 hover:bg-muted/80 rounded-xl transition-all hover:scale-105" />
            
            {title && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden md:block"
              >
                <h1 className="text-xl font-bold gradient-text">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground -mt-1">
                    {subtitle}
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {/* Center - Search */}
          <motion.div 
            className="hidden lg:flex flex-1 max-w-2xl mx-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={() => setSearchOpen(true)}
              className="relative w-full glass-effect border border-border/50 rounded-xl px-5 py-2.5 text-left hover:border-primary/50 transition-all group hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-primary rounded-lg group-hover:scale-110 transition-transform">
                  <Search className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Buscar médicos, pagamentos...
                </span>
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-lg border border-border/50 bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </button>
          </motion.div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Mobile Search */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="lg:hidden hover:bg-muted/80 rounded-xl"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Busca Rápida (⌘K)</p>
              </TooltipContent>
            </Tooltip>

            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="hover:bg-muted/80 rounded-xl hover:scale-105 transition-all"
                >
                  <motion.div
                    initial={false}
                    animate={{ rotate: theme === "dark" ? 0 : 180 }}
                    transition={{ duration: 0.3 }}
                  >
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4 text-primary" />
                    ) : (
                      <Sun className="h-4 w-4 text-warning" />
                    )}
                  </motion.div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Alternar Tema {theme === "dark" ? "(Claro)" : "(Escuro)"}</p>
              </TooltipContent>
            </Tooltip>

            {/* Notifications */}
            <Tooltip>
              <Popover>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative hover:bg-muted/80 rounded-xl"
                    >
                      <Bell className="h-4 w-4" />
                      {notasPendentes.length > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1"
                        >
                          <Badge
                            variant="destructive"
                            className="h-5 w-5 p-0 text-xs flex items-center justify-center animate-pulse"
                          >
                            {notasPendentes.length}
                          </Badge>
                        </motion.div>
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notificações {notasPendentes.length > 0 && `(${notasPendentes.length})`}</p>
                </TooltipContent>
                <PopoverContent className="w-80 glass-card border-border/50" align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Notas Pendentes</h4>
                  {notasPendentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma nota pendente</p>
                  ) : (
                    <div className="space-y-2">
                      {notasPendentes.map((nota) => (
                        <motion.div
                          key={nota.id}
                          whileHover={{ scale: 1.02 }}
                          className="p-3 rounded-xl glass-effect border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
                          onClick={handleNotificationClick}
                        >
                          <p className="text-sm font-semibold text-foreground">{nota.medicos.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            R$ {nota.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • {nota.mes_competencia}
                          </p>
                        </motion.div>
                      ))}
                      <Button 
                        size="sm" 
                        className="w-full btn-premium-primary mt-2"
                        onClick={handleNotificationClick}
                      >
                        Ver todas
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            </Tooltip>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 hover:bg-muted/80 rounded-xl px-2 hover:scale-105 transition-all"
                >
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold text-sm">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail.split('@')[0]}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass-card border-border/50" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem 
                  onClick={() => navigate('/perfil')}
                  className="cursor-pointer hover:bg-muted/80 rounded-lg"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate('/configuracoes')}
                  className="cursor-pointer hover:bg-muted/80 rounded-lg"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      </TooltipProvider>
    </>
  );
}