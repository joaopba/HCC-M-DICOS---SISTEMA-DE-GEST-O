import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUp, Upload, Check, X, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMesCompetencia } from "@/lib/utils";

interface Pagamento {
  id: string;
  mes_competencia: string;
  valor: number;
  status: string;
  nota_anexada?: {
    id: string;
    status: string;
    nome_arquivo: string;
    observacoes: string;
    created_at: string;
    arquivo_url: string;
  };
}

export default function NotasMedicos() {
  const [cpf, setCpf] = useState("");
  const [medico, setMedico] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .substr(0, 14);
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
  };

  const buscarPagamentos = async () => {
    if (!cpf || cpf.length < 14) {
      toast({
        title: "Erro",
        description: "Digite um CPF válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar médico pelo documento (CPF ou CNPJ)
      const cpfNumeros = cpf.replace(/\D/g, '');
      const { data: medicoData, error: medicoError } = await supabase
        .from("medicos")
        .select("*")
        .eq("documento", cpfNumeros)
        .eq("ativo", true)
        .single();

      if (medicoError || !medicoData) {
        toast({
          title: "CPF não encontrado",
          description: "Não encontramos um médico ativo com este CPF",
          variant: "destructive",
        });
        return;
      }

      setMedico(medicoData);

      // Buscar pagamentos pendentes/solicitados
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from("pagamentos")
        .select(`
          *,
          notas_medicos!left (
            id,
            status,
            nome_arquivo,
            observacoes,
            created_at
          )
        `)
        .eq("medico_id", medicoData.id)
        .in("status", ["pendente", "solicitado", "nota_recebida"])
        .order("mes_competencia", { ascending: false });

      if (pagamentosError) throw pagamentosError;

      // Processar dados para incluir informações das notas
      const pagamentosProcessados = pagamentosData?.map(p => ({
        ...p,
        nota_anexada: p.notas_medicos?.[0] || null
      })) || [];

      setPagamentos(pagamentosProcessados);

      toast({
        title: "Sucesso",
        description: `Bem-vindo, ${medicoData.nome}! ${pagamentosProcessados.length} pagamento(s) encontrado(s).`,
      });

    } catch (error) {
      console.error("Erro ao buscar pagamentos:", error);
      toast({
        title: "Erro",
        description: "Falha ao buscar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (pagamentoId: string, file: File) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são aceitos",
        variant: "destructive",
      });
      return;
    }

    setUploading(pagamentoId);
    try {
      // Upload do arquivo
      const fileExt = 'pdf';
      const fileName = `${pagamentoId}_${Date.now()}.${fileExt}`;
      const filePath = `medicos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Registrar na tabela notas_medicos
      const { data: notaData, error: insertError } = await supabase
        .from("notas_medicos")
        .insert({
          medico_id: medico.id,
          pagamento_id: pagamentoId,
          arquivo_url: filePath,
          nome_arquivo: file.name,
          status: 'pendente'
        })
        .select()
        .single();

      if (insertError) {
        // Se der erro, remover o arquivo do storage
        await supabase.storage.from('notas').remove([filePath]);
        throw insertError;
      }

      // Atualizar estado local ao invés de recarregar tudo
      setPagamentos(prev => prev.map(p => 
        p.id === pagamentoId 
          ? { 
              ...p, 
              nota_anexada: {
                id: notaData.id,
                status: notaData.status,
                nome_arquivo: notaData.nome_arquivo,
                observacoes: notaData.observacoes || '',
                created_at: notaData.created_at,
                arquivo_url: notaData.arquivo_url
              }
            }
          : p
      ));

      toast({
        title: "Sucesso",
        description: "Nota fiscal enviada com sucesso! Aguarde a análise.",
      });

      // Enviar notificações automáticas aos gestores
      console.log('📧 Enviando notificações aos gestores para nota:', notaData.id);
      try {
        const { data: notifData, error: notifError } = await supabase.functions.invoke('resend-nota-gestores', {
          body: { nota_ids: [notaData.id] }
        });

        if (notifError) {
          console.error('⚠️ Erro ao enviar notificações aos gestores:', notifError);
        } else {
          console.log('✅ Notificações enviadas aos gestores:', notifData);
        }
      } catch (notifError) {
        console.error('⚠️ Falha ao notificar gestores:', notifError);
        // Não bloquear o fluxo - a nota já foi salva com sucesso
      }

    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha no upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const removerNota = async (pagamentoId: string, arquivoUrl: string) => {
    try {
      // Remover registro da tabela
      const { error: deleteError } = await supabase
        .from("notas_medicos")
        .delete()
        .eq("pagamento_id", pagamentoId);

      if (deleteError) throw deleteError;

      // Remover arquivo do storage
      await supabase.storage.from('notas').remove([arquivoUrl]);

      // Atualizar estado local ao invés de recarregar tudo
      setPagamentos(prev => prev.map(p => 
        p.id === pagamentoId ? { ...p, nota_anexada: undefined } : p
      ));

      toast({
        title: "Sucesso",
        description: "Nota fiscal removida com sucesso",
      });
    } catch (error) {
      console.error("Erro ao remover nota:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover nota fiscal",
        variant: "destructive",
      });
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileUp className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Portal do Médico
          </h1>
          <p className="text-muted-foreground">
            Envie suas notas fiscais de forma fácil e segura
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/dashboard-medicos'}
              className="text-sm"
            >
              📊 Ver Dashboard com Estatísticas
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Acesso por CPF</CardTitle>
            <p className="text-sm text-muted-foreground">
              Digite seu CPF para acessar seus pagamentos pendentes
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCPFChange}
                  maxLength={14}
                  className="text-lg text-center"
                />
              </div>
              <Button 
                onClick={buscarPagamentos} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Buscando..." : "Acessar Meus Pagamentos"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {medico && (
          <Card className="mb-6">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-primary">
                Olá, {medico.nome}!
              </CardTitle>
              <p className="text-muted-foreground">
                {pagamentos.length > 0 
                  ? `Você possui ${pagamentos.length} pagamento(s) pendente(s) de documentação`
                  : "Parabéns! Não há pagamentos pendentes de documentação"
                }
              </p>
            </CardHeader>
          </Card>
        )}

        {pagamentos.length > 0 && (
          <div className="space-y-4">
            {pagamentos.map((pagamento) => (
              <Card key={pagamento.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {formatMesCompetencia(pagamento.mes_competencia)}
                      </CardTitle>
                      <p className="text-2xl font-bold text-primary mt-1">
                        {formatCurrency(pagamento.valor)}
                      </p>
                    </div>
                    <Badge variant="outline">{pagamento.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Status da Nota Fiscal
                      </Label>
                      <div className="mt-2">
                        {pagamento.nota_anexada ? (
                          <div className="space-y-2">
                            {getStatusBadge(pagamento.nota_anexada.status)}
                            <p className="text-sm text-muted-foreground">
                              📄 {pagamento.nota_anexada.nome_arquivo}
                            </p>
                            {pagamento.nota_anexada.observacoes && (
                              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <p className="text-sm font-medium text-destructive mb-1">
                                  Observações:
                                </p>
                                <p className="text-sm text-destructive">
                                  {pagamento.nota_anexada.observacoes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <Badge variant="secondary" className="mb-3">
                              ⏳ Aguardando envio da nota fiscal
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      {!pagamento.nota_anexada ? (
                        <div className="space-y-3">
                          <Input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(pagamento.id, file);
                              }
                            }}
                            disabled={uploading === pagamento.id}
                            className="hidden"
                            id={`file-${pagamento.id}`}
                          />
                          <Label htmlFor={`file-${pagamento.id}`} className="cursor-pointer">
                            <Button 
                              asChild 
                              disabled={uploading === pagamento.id}
                              size="lg"
                              className="w-full"
                            >
                              <span>
                                <Upload className="h-5 w-5 mr-2" />
                                {uploading === pagamento.id ? "Enviando..." : "📄 Enviar Nota Fiscal (PDF)"}
                              </span>
                            </Button>
                          </Label>
                          <p className="text-xs text-muted-foreground text-center">
                            ⚠️ Apenas arquivos PDF são aceitos
                          </p>
                        </div>
                      ) : pagamento.nota_anexada.status === 'pendente' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removerNota(pagamento.id, pagamento.nota_anexada!.arquivo_url)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover e Enviar Nova Nota
                        </Button>
                      ) : pagamento.nota_anexada.status === 'rejeitado' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removerNota(pagamento.id, pagamento.nota_anexada!.arquivo_url)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Corrigir e Enviar Nova Nota
                        </Button>
                      ) : (
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            ✅ Nota aprovada! Aguarde o processamento do pagamento.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {medico && pagamentos.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Tudo em dia! 🎉
                  </h3>
                  <p className="text-muted-foreground">
                    Não há pagamentos pendentes de documentação no momento.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}