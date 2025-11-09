import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import ChatWithFinanceiro from "@/components/ChatWithFinanceiro";
import { motion } from "framer-motion";

interface MedicoWithUnread {
  id: string;
  nome: string;
  unreadCount: number;
  ticketStatus?: 'aberto' | 'em_atendimento' | 'finalizado';
  ticketGestorId?: string;
  ticketGestorNome?: string;
  ticketId?: string;
  ticketNumber?: number;
}

export default function ChatAdmin() {
  const [searchParams] = useSearchParams();
  const [medicos, setMedicos] = useState<MedicoWithUnread[]>([]);
  const [selectedMedico, setSelectedMedico] = useState<MedicoWithUnread | null>(null);
  const [loading, setLoading] = useState(true);
  const [gestorNome, setGestorNome] = useState("");
  const [gestorId, setGestorId] = useState("");

  useEffect(() => {
    loadMedicos();
    loadGestorInfo();
    
    // Realtime para atualizar contadores
    const channel = supabase
      .channel('chat-admin-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          loadMedicos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadGestorInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setGestorNome(profile.name);
          setGestorId(profile.id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar informações do gestor:', error);
    }
  };

  const loadMedicos = async () => {
    try {
      const { data: medicosData, error } = await supabase
        .from('medicos')
        .select('id, nome')
        .eq('ativo', true);

      if (error) throw error;

      // Buscar mensagens não lidas e tickets para cada médico
      const medicosComUnread = await Promise.all(
        (medicosData || []).map(async (medico) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medico.id)
            .eq('sender_type', 'medico')
            .eq('read', false);

          // Buscar ticket ativo ou mais recente
          const { data: ticket } = await supabase
            .from('chat_tickets')
            .select(`
              id,
              status,
              gestor_id,
              ticket_number,
              profiles!chat_tickets_gestor_id_fkey(name)
            `)
            .eq('medico_id', medico.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: medico.id,
            nome: medico.nome,
            unreadCount: count || 0,
            ticketStatus: ticket?.status as 'aberto' | 'em_atendimento' | 'finalizado' | undefined,
            ticketGestorId: ticket?.gestor_id,
            ticketGestorNome: ticket?.profiles?.name,
            ticketId: ticket?.id,
            ticketNumber: ticket?.ticket_number,
          };
        })
      );

      setMedicos(medicosComUnread.sort((a, b) => b.unreadCount - a.unreadCount));
      
      // Verificar se há parâmetro de médico na URL (vindo do WhatsApp)
      const medicoIdFromUrl = searchParams.get('medico');
      const shouldRespond = searchParams.get('responder');
      
      if (medicoIdFromUrl && shouldRespond === 'true') {
        const medicoToSelect = medicosComUnread.find(m => m.id === medicoIdFromUrl);
        if (medicoToSelect) {
          setSelectedMedico(medicoToSelect);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar médicos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Chat com Médicos" subtitle="Comunicação direta com os médicos">
      <div className="p-3 md:p-6 h-[calc(100vh-120px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 h-full">
          {/* Lista de Médicos - Esconder no mobile quando um médico está selecionado */}
          <Card className={`lg:col-span-1 glass-card ${selectedMedico && 'hidden lg:block'}`}>
            <CardHeader className="pb-3 px-3 md:px-6">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                Médicos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-200px)] md:h-[calc(100vh-240px)]">
                {loading ? (
                  <div className="p-2 md:p-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {medicos.map((medico) => {
                      return (
                        <motion.button
                          key={medico.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedMedico(medico)}
                          className={`w-full text-left p-2.5 md:p-3 rounded-lg transition-all ${
                            selectedMedico?.id === medico.id
                              ? 'bg-primary/10 border-primary/30'
                              : 'hover:bg-accent/50'
                          } border border-border/50`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs md:text-sm truncate flex items-center gap-2">
                                {medico.nome}
                                {medico.ticketNumber && (
                                  <Badge variant="outline" className="text-[10px] md:text-xs">
                                    #{medico.ticketNumber}
                                  </Badge>
                                )}
                              </p>
                              <p className="text-[10px] md:text-xs text-muted-foreground">
                                {medico.ticketGestorNome 
                                  ? `Atendido por ${medico.ticketGestorNome}`
                                  : medico.unreadCount > 0 
                                    ? `${medico.unreadCount} nova(s)` 
                                    : 'Sem mensagens novas'}
                              </p>
                            </div>
                            {medico.unreadCount > 0 && (
                              <Badge className="bg-destructive text-destructive-foreground border-0 text-xs">
                                {medico.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Área de Chat */}
          <div className={`lg:col-span-3 ${!selectedMedico && 'hidden lg:block'}`}>
            {selectedMedico ? (
              <div className="relative h-full">
                {/* Botão voltar para mobile */}
                <div className="lg:hidden mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMedico(null)}
                    className="gap-2"
                  >
                    ← Voltar para lista
                  </Button>
                </div>
                <ChatWithFinanceiro
                  medicoId={selectedMedico.id}
                  medicoNome={selectedMedico.nome}
                  isGestor={true}
                  fullscreen={true}
                  gestorNome={gestorNome}
                  gestorId={gestorId}
                  ticketId={selectedMedico.ticketId}
                  ticketNumber={selectedMedico.ticketNumber}
                  ticketStatus={selectedMedico.ticketStatus}
                  onTicketUpdate={loadMedicos}
                />
              </div>
            ) : (
              <Card className="glass-card h-full flex items-center justify-center">
                <CardContent className="text-center p-6">
                  <MessageCircle className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Selecione um médico
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha um médico da lista para iniciar a conversa
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}