import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface SearchResult {
  id: string;
  type: "medico" | "pagamento";
  title: string;
  subtitle: string;
  icon: typeof User;
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const results: SearchResult[] = [];

      // Search médicos
      const { data: medicos } = await supabase
        .from("medicos")
        .select("id, nome, especialidade, numero_whatsapp")
        .or(`nome.ilike.%${searchQuery}%,numero_whatsapp.ilike.%${searchQuery}%`)
        .limit(5);

      if (medicos) {
        medicos.forEach((medico) => {
          results.push({
            id: medico.id,
            type: "medico",
            title: medico.nome,
            subtitle: `${medico.especialidade || 'Especialidade não informada'} • ${medico.numero_whatsapp}`,
            icon: User,
          });
        });
      }

      // Search pagamentos
      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select(`
          id,
          mes_competencia,
          valor,
          status,
          medicos!inner (
            nome
          )
        `)
        .or(`mes_competencia.ilike.%${searchQuery}%`)
        .limit(5);

      if (pagamentos) {
        pagamentos.forEach((pagamento: any) => {
          results.push({
            id: pagamento.id,
            type: "pagamento",
            title: `Pagamento - ${pagamento.medicos.nome}`,
            subtitle: `${pagamento.mes_competencia} • R$ ${pagamento.valor.toLocaleString('pt-BR')} • ${pagamento.status}`,
            icon: CreditCard,
          });
        });
      }

      setResults(results);
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === "medico") {
      navigate("/medicos");
    } else {
      navigate("/pagamentos");
    }
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-2xl p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-background p-5 border-b border-border/50">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
                <Search className="h-4 w-4 text-primary-foreground" />
              </div>
              <DialogTitle className="gradient-text text-xl">
                Busca Rápida
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Pesquise por médicos, pagamentos e mais...
            </p>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para buscar..."
              className="pl-10 pr-16 h-11 glass-effect border-border/50 focus:border-primary/50 rounded-lg text-sm"
              autoFocus
            />
            {query.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              </motion.div>
            )}
          </div>

          {query.length < 2 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center space-y-3"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-primary blur-xl opacity-20 rounded-full" />
                <div className="relative p-3 glass-effect rounded-xl border border-border/50">
                  <Search className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Digite para pesquisar</p>
                <p className="text-xs text-muted-foreground">
                  Mínimo de 2 caracteres
                </p>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center space-y-3"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <div className="p-3 glass-effect rounded-xl border border-border/50">
                  <Search className="h-6 w-6 text-primary" />
                </div>
              </motion.div>
              <p className="text-sm font-medium text-muted-foreground">Buscando...</p>
            </motion.div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center space-y-3"
            >
              <div className="relative inline-block">
                <div className="p-3 glass-effect rounded-xl border border-border/50">
                  <FileText className="h-6 w-6 text-muted-foreground opacity-50" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
                <p className="text-xs text-muted-foreground">
                  Tente outro termo
                </p>
              </div>
            </motion.div>
          )}

          {!loading && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {results.length} resultado{results.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {results.map((result, index) => (
                  <motion.div
                    key={`${result.type}-${result.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelect(result)}
                    className="relative p-3 glass-effect border border-border/50 rounded-lg cursor-pointer hover:border-primary/40 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 p-2 bg-gradient-primary rounded-lg group-hover:scale-105 transition-transform">
                        <result.icon className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate text-sm">
                          {result.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border/50 glass-effect">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <kbd className="inline-flex h-4 select-none items-center rounded border border-border/50 bg-muted px-1 font-mono text-[9px] font-medium">
                  ↑↓
                </kbd>
                <span>Navegar</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="inline-flex h-4 select-none items-center rounded border border-border/50 bg-muted px-1 font-mono text-[9px] font-medium">
                  ↵
                </kbd>
                <span>Abrir</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="inline-flex h-4 select-none items-center rounded border border-border/50 bg-muted px-1 font-mono text-[9px] font-medium">
                  ESC
                </kbd>
                <span>Fechar</span>
              </div>
            </div>
            <span className="font-semibold gradient-text text-xs">HCC Hospital</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
