import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, MessageCircle, Calendar, User, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface Ticket {
  id: string;
  status: 'aberto' | 'em_atendimento' | 'finalizado';
  created_at: string;
  closed_at: string | null;
  rating: number | null;
  feedback_text: string | null;
  ticket_number: number;
  gestor: {
    name: string;
  } | null;
  message_count: number;
}

interface TicketHistoryProps {
  medicoId: string;
  medicoNome: string;
}

export default function TicketHistory({ medicoId, medicoNome }: TicketHistoryProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [medicoId]);

  const loadTickets = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from('chat_tickets')
        .select(`
          id,
          status,
          created_at,
          closed_at,
          rating,
          feedback_text,
          ticket_number,
          profiles!chat_tickets_gestor_id_fkey(name)
        `)
        .eq('medico_id', medicoId)
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Contar mensagens de cada ticket
      const ticketsWithCount = await Promise.all(
        (ticketsData || []).map(async (ticket) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('medico_id', medicoId)
            .gte('created_at', ticket.created_at)
            .lte('created_at', ticket.closed_at || new Date().toISOString());

          return {
            ...ticket,
            gestor: ticket.profiles,
            message_count: count || 0
          };
        })
      );

      setTickets(ticketsWithCount as any);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketMessages = async (ticket: Ticket) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('medico_id', medicoId)
        .gte('created_at', ticket.created_at)
        .lte('created_at', ticket.closed_at || new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTicketMessages(data || []);
      setSelectedTicket(ticket);
      setShowDialog(true);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      aberto: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      em_atendimento: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      finalizado: 'bg-green-500/10 text-green-500 border-green-500/20'
    };
    
    const labels = {
      aberto: 'Aberto',
      em_atendimento: 'Em Atendimento',
      finalizado: 'Finalizado'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum atendimento finalizado ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <motion.div
                    key={ticket.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="cursor-pointer hover:border-primary/50 transition-all"
                      onClick={() => loadTicketMessages(ticket)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(ticket.status)}
                            <Badge variant="secondary" className="text-xs">
                              Ticket #{ticket.ticket_number}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageCircle className="h-3 w-3" />
                            {ticket.message_count} mensagens
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Atendido por:</span>
                            <span className="font-medium">{ticket.gestor?.name || 'N/A'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Data:</span>
                            <span>
                              {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          
                          {ticket.closed_at && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Duração:</span>
                              <span>
                                {Math.round(
                                  (new Date(ticket.closed_at).getTime() - new Date(ticket.created_at).getTime()) / 1000 / 60
                                )} minutos
                              </span>
                            </div>
                          )}
                          
                          {ticket.rating && (
                            <div className="flex items-center gap-1 mt-2">
                              {'⭐'.repeat(ticket.rating)}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({ticket.rating}/5)
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog com mensagens do ticket */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">Ticket #{selectedTicket?.ticket_number}</Badge>
              Atendimento - {new Date(selectedTicket?.created_at || '').toLocaleDateString('pt-BR')}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 p-4">
              {ticketMessages.map((msg) => {
                const isOwn = msg.sender_type === 'medico';
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === 'sistema' ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.sender_type === 'sistema'
                          ? 'bg-muted/50 border border-border/50 text-center'
                          : isOwn
                          ? 'bg-gradient-primary text-primary-foreground'
                          : 'glass-effect border border-border/50'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      {msg.sender_type !== 'sistema' && (
                        <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
