import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Eye, Clock, FileText, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMesCompetencia } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface NotaMedico {
  id: string;
  medico_id: string;
  pagamento_id: string;
  arquivo_url: string;
  nome_arquivo: string;
  status: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
  valor_ajustado?: number;
  motivo_ajuste?: string;
  numero_nota?: string;
  valor_bruto?: number;
  medicos: {
    nome: string;
    documento: string;
  };
  pagamentos: {
    mes_competencia: string;
    valor: number;
    valor_liquido?: number;
  };
}

export default function NotasAprovacao() {
  // Definir mês anterior como filtro padrão (sem problemas de timezone)
  const getDefaultMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    
    // Se janeiro, volta para dezembro do ano anterior
    if (month === 0) {
      return `${year - 1}-12`;
    }
    
    // Formatar mês anterior com zero à esquerda
    const lastMonth = month.toString().padStart(2, '0');
    return `${year}-${lastMonth}`;
  };

  const [notas, setNotas] = useState<NotaMedico[]>([]);
  const [notasFiltradas, setNotasFiltradas] = useState<NotaMedico[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [selectedNota, setSelectedNota] = useState<NotaMedico | null>(null);
  const [filtroMes, setFiltroMes] = useState<string>(getDefaultMonth());
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [editingValor, setEditingValor] = useState(false);
  const [novoValorLiquido, setNovoValorLiquido] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadNotas();

    // Configurar realtime para atualizações automáticas
    const channel = supabase
      .channel('notas-aprovacao-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notas_medicos'
        },
        (payload) => {
          console.log('Nova atualização em notas_medicos:', payload);
          loadNotas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filtroMes]); // Recarregar quando o filtro de mês mudar

  useEffect(() => {
    let filtered = notas;

    if (filtroMes !== "todos") {
      filtered = filtered.filter(nota => nota.pagamentos.mes_competencia === filtroMes);
    }

    if (filtroStatus !== "todos") {
      filtered = filtered.filter(nota => nota.status === filtroStatus);
    }

    setNotasFiltradas(filtered);
  }, [notas, filtroMes, filtroStatus]);

  const getMesesDisponiveis = () => {
    const meses = Array.from(new Set(notas.map(nota => nota.pagamentos.mes_competencia)));
    return meses.sort().reverse();
  };

  const loadNotas = async () => {
    try {
      // 1) Buscar pagamentos primeiro (com filtro de mês se aplicável) para otimizar
      let pagamentosQuery = supabase
        .from("pagamentos")
        .select("id, mes_competencia, valor, valor_liquido");
      
      // Aplicar filtro de mês se não for "todos"
      if (filtroMes !== "todos") {
        pagamentosQuery = pagamentosQuery.eq("mes_competencia", filtroMes);
      }
      
      const { data: pagamentosData, error: pagamentosError } = await pagamentosQuery;
      if (pagamentosError) throw pagamentosError;
      
      const pagamentoIds = (pagamentosData || []).map(p => p.id);
      
      // Se não houver pagamentos no período, retornar vazio
      if (pagamentoIds.length === 0) {
        setNotas([]);
        setNotasFiltradas([]);
        setLoading(false);
        return;
      }
      
      // 2) Buscar apenas notas dos pagamentos filtrados
      const { data: notasBase, error: notasError } = await supabase
        .from("notas_medicos")
        .select("*")
        .in("pagamento_id", pagamentoIds)
        .order("created_at", { ascending: false });

      if (notasError) throw notasError;

      const medicoIds = Array.from(new Set((notasBase || []).map(n => n.medico_id)));

      // 3) Buscar médicos necessários
      const { data: medicosData, error: medicosError } = await supabase
        .from("medicos")
        .select("id, nome, documento")
        .in("id", medicoIds);

      if (medicosError) throw medicosError;

      const medicosMap: Map<string, any> = new Map((medicosData || []).map((m: any) => [m.id, m]));
      const pagamentosMap: Map<string, any> = new Map((pagamentosData || []).map((p: any) => [p.id, p]));

      // 4) Enriquecer estrutura esperada pelo componente
      const enriquecidas = (notasBase || []).map((n: any) => ({
        ...n,
        medicos: {
          nome: medicosMap.get(n.medico_id)?.nome || '—',
          documento: medicosMap.get(n.medico_id)?.documento || ''
        },
        pagamentos: {
          mes_competencia: pagamentosMap.get(n.pagamento_id)?.mes_competencia || '',
          valor: pagamentosMap.get(n.pagamento_id)?.valor || 0,
          valor_liquido: pagamentosMap.get(n.pagamento_id)?.valor_liquido
        }
      }));

      setNotas(enriquecidas as any);
      setNotasFiltradas(enriquecidas as any);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar notas para aprovação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAjustarValor = async (notaId: string) => {
    if (!novoValorLiquido || !motivoAjuste.trim()) {
      toast({
        title: "Erro",
        description: "Informe o novo valor líquido e o motivo do ajuste",
        variant: "destructive",
      });
      return;
    }

    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      const valorAjustadoNum = parseFloat(novoValorLiquido);

      if (isNaN(valorAjustadoNum) || valorAjustadoNum <= 0) {
        toast({
          title: "Erro",
          description: "Informe um valor válido",
          variant: "destructive",
        });
        return;
      }

      if (valorAjustadoNum > nota.pagamentos.valor) {
        toast({
          title: "Erro",
          description: "O valor líquido não pode ser maior que o valor bruto",
          variant: "destructive",
        });
        return;
      }

      // Buscar o profile do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      // Atualizar nota com ajuste
      const { error: notaError } = await supabase
        .from("notas_medicos")
        .update({ 
          valor_ajustado: valorAjustadoNum,
          motivo_ajuste: motivoAjuste,
          ajustado_por: profile?.id,
          ajustado_em: new Date().toISOString()
        })
        .eq("id", notaId);

      if (notaError) throw notaError;

      // Atualizar pagamento com novo valor líquido
      const { error: pagamentoError } = await supabase
        .from("pagamentos")
        .update({ valor_liquido: valorAjustadoNum })
        .eq("id", nota.pagamento_id);

      if (pagamentoError) throw pagamentoError;

      // Buscar dados do médico
      const { data: medicoData } = await supabase
        .from("medicos")
        .select("*")
        .eq("id", nota.medico_id)
        .maybeSingle();

      // Notificar médico sobre ajuste de valor
      await supabase.functions.invoke('send-whatsapp-template', {
        body: {
          type: 'valor_ajustado',
          medico: {
            nome: nota.medicos.nome,
            numero_whatsapp: medicoData?.numero_whatsapp
          },
          medico_id: nota.medico_id,
          competencia: nota.pagamentos.mes_competencia,
          valorOriginal: nota.pagamentos.valor_liquido 
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nota.pagamentos.valor_liquido) 
            : 'N/A',
          valorNovo: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorAjustadoNum),
          motivo: motivoAjuste,
          pagamentoId: nota.pagamento_id
        }
      });

      toast({
        title: "Sucesso",
        description: "Valor ajustado e médico notificado!",
      });

      setEditingValor(false);
      setNovoValorLiquido("");
      setMotivoAjuste("");
      loadNotas();
    } catch (error) {
      console.error("Erro ao ajustar valor:", error);
      toast({
        title: "Erro",
        description: "Falha ao ajustar valor",
        variant: "destructive",
      });
    }
  };

  const handleAprovar = async (notaId: string) => {
    if (processingId) return; // Prevenir duplo clique
    setProcessingId(notaId);
    
    // Dobrar proteção contra duplo clique
    const buttonKey = `aprovar_${notaId}`;
    if (localStorage.getItem(buttonKey)) return;
    localStorage.setItem(buttonKey, 'processing');
    
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      // Atualizar status da nota
      const { error: updateError } = await supabase
        .from("notas_medicos")
        .update({ 
          status: 'aprovado',
          observacoes: observacoes || null
        })
        .eq("id", notaId);

      if (updateError) throw updateError;

      // Atualizar status do pagamento
      const { error: pagamentoError } = await supabase
        .from("pagamentos")
        .update({ 
          status: 'aprovado',
          data_resposta: new Date().toISOString(),
          nota_pdf_url: nota.arquivo_url
        })
        .eq("id", nota.pagamento_id);

      if (pagamentoError) throw pagamentoError;

      // Buscar dados completos do médico
      const { data: medicoData } = await supabase
        .from("medicos")
        .select("*")
        .eq("id", nota.medico_id)
        .maybeSingle();

      // Enviar notificação via WhatsApp
      await supabase.functions.invoke('send-whatsapp-template', {
        body: {
          type: 'nota_aprovada',
          medico: {
            nome: nota.medicos.nome,
            numero_whatsapp: medicoData?.numero_whatsapp
          },
          competencia: nota.pagamentos.mes_competencia,
          valor: nota.pagamentos.valor,
          pagamentoId: nota.pagamento_id
        }
      });

      toast({
        title: "Sucesso",
        description: "Nota aprovada e médico notificado!",
      });

      setObservacoes("");
      loadNotas();
    } catch (error) {
      console.error("Erro ao aprovar nota:", error);
      toast({
        title: "Erro",
        description: "Falha ao aprovar nota",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setTimeout(() => {
        localStorage.removeItem(buttonKey);
      }, 2000);
    }
  };

  const handleRejeitar = async (notaId: string) => {
    if (!observacoes.trim()) {
      toast({
        title: "Erro",
        description: "É necessário informar o motivo da rejeição",
        variant: "destructive",
      });
      return;
    }

    if (processingId) return; // Prevenir duplo clique
    setProcessingId(notaId);
    
    // Dobrar proteção contra duplo clique
    const buttonKey = `rejeitar_${notaId}`;
    if (localStorage.getItem(buttonKey)) return;
    localStorage.setItem(buttonKey, 'processing');
    
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      // Atualizar status da nota
      const { error: updateError } = await supabase
        .from("notas_medicos")
        .update({ 
          status: 'rejeitado',
          observacoes: observacoes
        })
        .eq("id", notaId);

      if (updateError) throw updateError;

      // Buscar dados completos do médico
      const { data: medicoData } = await supabase
        .from("medicos")
        .select("*")
        .eq("id", nota.medico_id)
        .maybeSingle();

      // Enviar notificação via WhatsApp
      await supabase.functions.invoke('send-whatsapp-template', {
        body: {
          type: 'nota_rejeitada',
          medico: {
            nome: nota.medicos.nome,
            numero_whatsapp: medicoData?.numero_whatsapp
          },
          competencia: nota.pagamentos.mes_competencia,
          motivo: observacoes,
          linkPortal: 'https://hcc.chatconquista.com/dashboard-medicos',
          pagamentoId: nota.pagamento_id
        }
      });

      toast({
        title: "Sucesso",
        description: "Nota rejeitada e médico notificado!",
      });

      setObservacoes("");
      loadNotas();
    } catch (error) {
      console.error("Erro ao rejeitar nota:", error);
      toast({
        title: "Erro",
        description: "Falha ao rejeitar nota",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setTimeout(() => {
        localStorage.removeItem(buttonKey);
      }, 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'aprovado':
        return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const downloadFile = async (arquivoUrl: string, nomeArquivo: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('notas')
        .download(arquivoUrl);

      if (error) throw error;

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      toast({
        title: "Erro",
        description: "Falha ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Carregando notas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Aprovação de Notas Fiscais ({notasFiltradas.filter(n => n.status === 'pendente').length} pendentes)
        </CardTitle>
        
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <Label htmlFor="filtro-mes">Filtrar por Mês</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {getMesesDisponiveis().map(mes => (
                  <SelectItem key={mes} value={mes}>
                    {formatMesCompetencia(mes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Label htmlFor="filtro-status">Filtrar por Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Médico</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Nº Nota</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Valor Bruto</TableHead>
              <TableHead>Valor Líquido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Envio</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notasFiltradas.map((nota) => (
              <TableRow key={nota.id}>
                <TableCell className="font-medium">{nota.medicos.nome}</TableCell>
                <TableCell>
                  {nota.medicos.documento ? 
                    nota.medicos.documento.length === 11
                      ? nota.medicos.documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                      : nota.medicos.documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                    : 'N/A'
                  }
                </TableCell>
                <TableCell className="text-center">
                  {nota.numero_nota || '-'}
                </TableCell>
                <TableCell>
                  {formatMesCompetencia(nota.pagamentos.mes_competencia)}
                </TableCell>
                <TableCell>{formatCurrency(nota.pagamentos.valor)}</TableCell>
                <TableCell>
                  {nota.valor_ajustado 
                    ? <span className="text-warning">{formatCurrency(nota.valor_ajustado)} *</span>
                    : nota.pagamentos.valor_liquido 
                      ? formatCurrency(nota.pagamentos.valor_liquido)
                      : 'Não informado'
                  }
                </TableCell>
                <TableCell>{getStatusBadge(nota.status)}</TableCell>
                <TableCell>
                  {new Date(nota.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(nota.arquivo_url, nota.nome_arquivo)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {nota.status === 'pendente' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedNota(nota)}
                          >
                            Avaliar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Avaliar Nota Fiscal</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <p><strong>Médico:</strong> {nota.medicos.nome}</p>
                              <p><strong>Nº Nota:</strong> {nota.numero_nota || '-'}</p>
                              <p><strong>Competência:</strong> {formatMesCompetencia(nota.pagamentos.mes_competencia)}</p>
                              <p><strong>Valor Bruto:</strong> {formatCurrency(nota.pagamentos.valor)}</p>
                              <p><strong>Valor Líquido:</strong> {nota.valor_ajustado ? formatCurrency(nota.valor_ajustado) + ' (Ajustado)' : nota.pagamentos.valor_liquido ? formatCurrency(nota.pagamentos.valor_liquido) : 'Não informado'}</p>
                              <p><strong>Arquivo:</strong> {nota.nome_arquivo}</p>
                              {nota.valor_ajustado && nota.motivo_ajuste && (
                                <div className="mt-2 p-2 bg-warning/10 rounded">
                                  <p><strong>Motivo do Ajuste:</strong> {nota.motivo_ajuste}</p>
                                </div>
                              )}
                            </div>

                            {editingValor && (
                              <div className="space-y-2 p-3 border rounded">
                                <Label htmlFor="novoValorLiquido">Novo Valor Líquido</Label>
                                <Input
                                  id="novoValorLiquido"
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={novoValorLiquido}
                                  onChange={(e) => setNovoValorLiquido(e.target.value)}
                                />
                                <Label htmlFor="motivoAjuste">Motivo do Ajuste</Label>
                                <Textarea
                                  id="motivoAjuste"
                                  placeholder="Descreva o motivo do ajuste..."
                                  value={motivoAjuste}
                                  onChange={(e) => setMotivoAjuste(e.target.value)}
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAjustarValor(nota.id)}
                                  >
                                    Confirmar Ajuste
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingValor(false);
                                      setNovoValorLiquido("");
                                      setMotivoAjuste("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            )}

                            {!editingValor && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingValor(true)}
                              >
                                Ajustar Valor Líquido
                              </Button>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor="observacoes">Observações</Label>
                              <Textarea
                                id="observacoes"
                                placeholder="Digite observações sobre a aprovação/rejeição..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                rows={3}
                              />
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => handleRejeitar(nota.id)}
                                disabled={processingId === nota.id}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                              <Button
                                variant="default"
                                onClick={() => handleAprovar(nota.id)}
                                disabled={processingId === nota.id}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {nota.observacoes && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Badge variant="outline" className="cursor-pointer">
                            Ver obs.
                          </Badge>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Observações</DialogTitle>
                          </DialogHeader>
                          <p>{nota.observacoes}</p>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {notasFiltradas.length === 0 && notas.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma nota encontrada com os filtros aplicados
          </div>
        )}

        {notas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma nota fiscal encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}