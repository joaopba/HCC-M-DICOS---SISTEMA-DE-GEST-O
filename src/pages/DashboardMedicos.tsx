import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  FileCheck, 
  Clock, 
  DollarSign, 
  Calendar,
  BarChart3,
  Upload,
  AlertTriangle,
  X,
  Building2,
  Moon,
  Sun,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMesCompetencia } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logo from "@/assets/logo.png";
import ChatWithFinanceiro from "@/components/ChatWithFinanceiro";
import TicketHistory from "@/components/TicketHistory";
import RatingDialog from "@/components/RatingDialog";
import conquistaLogo from "@/assets/conquista-inovacao.png";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface MedicoStats {
  totalNotas: number;
  notasAprovadas: number;
  notasPendentes: number;
  notasRejeitadas: number;
  valorTotal: number;
  valorAprovado: number;
  valorPendente: number;
}

interface NotaData {
  id: string;
  status: string;
  nome_arquivo: string;
  created_at: string;
  observacoes: string;
  pagamento: {
    valor: number;
    mes_competencia: string;
    data_pagamento?: string;
  };
}

interface ChartData {
  mes: string;
  valor: number;
  status: string;
}

interface PagamentoPendente {
  id: string;
  mes_competencia: string;
  valor: number;
  status: string;
  temNotaRejeitada?: boolean;
  temNotaPendente?: boolean;
}

export default function DashboardMedicos() {
  const [cpf, setCpf] = useState("");
  const [medico, setMedico] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MedicoStats>({
    totalNotas: 0,
    notasAprovadas: 0,
    notasPendentes: 0,
    notasRejeitadas: 0,
    valorTotal: 0,
    valorAprovado: 0,
    valorPendente: 0
  });
  const [notas, setNotas] = useState<NotaData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [pagamentosPendentes, setPagamentosPendentes] = useState<PagamentoPendente[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPagamento, setSelectedPagamento] = useState<PagamentoPendente | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showRejectedAlert, setShowRejectedAlert] = useState(false);
  const [rejectedNotes, setRejectedNotes] = useState<any[]>([]);
  const [showConfirmUpload, setShowConfirmUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<any>(null);
  const [valorLiquido, setValorLiquido] = useState("");
  const [ocrHabilitado, setOcrHabilitado] = useState(false);
  const [manutencao, setManutencao] = useState(false);
  const [mensagemManutencao, setMensagemManutencao] = useState("");
  const [previsaoRetorno, setPrevisaoRetorno] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showInitialAnimation, setShowInitialAnimation] = useState(true);
  const [showVerificationStep, setShowVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ numero: string; tipo: string }>>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const formatCPF = (value: string) => {
    const numeros = value.replace(/\D/g, '');
    if (numeros.length === 11) {
      // CPF
      return numeros
        .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        .substr(0, 14);
    } else if (numeros.length === 14) {
      // CNPJ
      return numeros
        .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        .substr(0, 18);
    }
    return value;
  };

  // Carregar configurações de manutenção ANTES de tudo
  useEffect(() => {
    const fetchConfig = async () => {
      setLoadingConfig(true);
      try {
        const { data } = await supabase
          .from('configuracoes')
          .select('dashboard_medicos_manutencao, dashboard_medicos_mensagem_manutencao, dashboard_medicos_previsao_retorno')
          .single();
        
        if (data) {
          setManutencao(data.dashboard_medicos_manutencao || false);
          setMensagemManutencao(data.dashboard_medicos_mensagem_manutencao || "");
          setPrevisaoRetorno(data.dashboard_medicos_previsao_retorno || null);
        }
      } catch (error) {
        console.error('Erro ao buscar configurações:', error);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchConfig();
  }, []);

  // Desativar animação inicial após 2 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInitialAnimation(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Verificar se há sessão ativa ao carregar e buscar dados automaticamente
  useEffect(() => {
    const savedToken = localStorage.getItem('medico_session_token');
    const savedCpf = localStorage.getItem('medico_validated_cpf');
    if (savedToken && savedCpf) {
      validateAndLoadSession(savedToken, savedCpf);
    }
  }, []);

  const validateAndLoadSession = async (token: string, cpfValidado: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-medico-session', {
        body: { token }
      });

      if (error || !data?.valid) {
        localStorage.removeItem('medico_session_token');
        localStorage.removeItem('medico_validated_cpf');
        setSessionToken(null);
        return false;
      }

      // Se há sessão válida, carregar dados do médico automaticamente usando CPF validado
      setSessionToken(token);
      setCpf(formatCPF(cpfValidado));
      await loadMedicoData(cpfValidado);
      return true;
    } catch (error) {
      console.error('Erro ao validar sessão:', error);
      localStorage.removeItem('medico_session_token');
      localStorage.removeItem('medico_validated_cpf');
      return false;
    }
  };

  const validateSession = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-medico-session', {
        body: { token }
      });

      if (error || !data?.valid) {
        localStorage.removeItem('medico_session_token');
        localStorage.removeItem('medico_validated_cpf');
        setSessionToken(null);
        return false;
      }

      setSessionToken(token);
      return true;
    } catch (error) {
      console.error('Erro ao validar sessão:', error);
      localStorage.removeItem('medico_session_token');
      localStorage.removeItem('medico_validated_cpf');
      return false;
    }
  };

  useEffect(() => {
    if (medico && pagamentosPendentes.length > 0) {
      // Mostrar popup automaticamente após 1.5 segundos apenas para pagamentos que realmente precisam de nota
      const pagamentosQueNecessitamNota = pagamentosPendentes.filter(p => 
        !p.temNotaRejeitada && !p.temNotaPendente
      );
      if (pagamentosQueNecessitamNota.length > 0) {
        const timer = setTimeout(() => {
          setSelectedPagamento(pagamentosQueNecessitamNota[0]);
          setShowUploadModal(true);
        }, 1500);

        return () => clearTimeout(timer);
      }
    }
  }, [medico, pagamentosPendentes]);

  // Configurar realtime para atualizações automáticas
  useEffect(() => {
    if (!medico) return;

    const channel = supabase
      .channel('dashboard-medicos-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notas_medicos',
          filter: `medico_id=eq.${medico.id}`
        },
        () => {
          console.log('Nota atualizada, recarregando dados...');
          buscarDados();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagamentos',
          filter: `medico_id=eq.${medico.id}`
        },
        () => {
          console.log('Pagamento atualizado, recarregando dados...');
          buscarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [medico]);

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
  };

  const checkPendingRating = async (medicoId: string) => {
    try {
      const { data: ticket } = await supabase
        .from('chat_tickets')
        .select(`
          id,
          rating,
          gestor_id,
          profiles!chat_tickets_gestor_id_fkey(name)
        `)
        .eq('medico_id', medicoId)
        .eq('status', 'finalizado')
        .is('rating', null)
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ticket) {
        setPendingTicket(ticket);
        setRatingDialogOpen(true);
      }
    } catch (error) {
      console.error('Erro ao verificar avaliação pendente:', error);
    }
  };

  const handleSubmitRating = async (rating: number, feedback: string) => {
    if (!pendingTicket) return;

    try {
      const { error } = await supabase
        .from('chat_tickets')
        .update({
          rating,
          feedback_text: feedback
        })
        .eq('id', pendingTicket.id);

      if (error) throw error;

      toast({
        title: "Avaliação Enviada",
        description: "Obrigado pelo seu feedback!",
      });

      setPendingTicket(null);
    } catch (error: any) {
      console.error('Erro ao enviar avaliação:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar avaliação",
        variant: "destructive",
      });
      throw error;
    }
  };

  const buscarDados = async () => {
    if (manutencao) {
      toast({
        title: "Sistema em manutenção",
        description: "O dashboard está temporariamente indisponível.",
        variant: "destructive",
      });
      return;
    }

    if (!cpf || cpf.length < 14) {
      toast({
        title: "Erro",
        description: "Digite um CPF/CNPJ válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const cpfNumeros = cpf.replace(/\D/g, '');

      // Verificar se há sessão ativa E CPF validado
      const savedToken = localStorage.getItem('medico_session_token');
      const savedCpf = localStorage.getItem('medico_validated_cpf');
      
      // Se tem token mas o CPF é diferente do salvo, limpar sessão e iniciar nova validação
      if (savedToken && savedCpf && savedCpf !== cpfNumeros) {
        localStorage.removeItem('medico_session_token');
        localStorage.removeItem('medico_validated_cpf');
        setSessionToken(null);
      } else if (savedToken && savedCpf === cpfNumeros) {
        const isValid = await validateSession(savedToken);
        if (isValid) {
          // Sessão válida, buscar dados direto com o CPF validado
          await loadMedicoData(cpfNumeros);
          return;
        }
      }

      // Buscar configurações OCR, manutenção e verificação
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('ocr_nfse_habilitado, dashboard_medicos_manutencao, dashboard_medicos_mensagem_manutencao, dashboard_medicos_previsao_retorno, verificacao_medico_habilitada')
        .single();
      
      if (configData) {
        setOcrHabilitado(configData.ocr_nfse_habilitado || false);
        setManutencao(configData.dashboard_medicos_manutencao || false);
        setMensagemManutencao(configData.dashboard_medicos_mensagem_manutencao || "Dashboard em manutenção. Por favor, tente novamente mais tarde.");
        setPrevisaoRetorno(configData.dashboard_medicos_previsao_retorno);
        
        // Se está em manutenção, não buscar dados do médico
        if (configData.dashboard_medicos_manutencao) {
          setLoading(false);
          return;
        }

        // AUTENTICAÇÃO OBRIGATÓRIA: Sempre enviar código quando verificação está habilitada
        if (configData.verificacao_medico_habilitada) {
          const { data: verificationData, error: verificationError } = await supabase.functions.invoke(
            'send-verification-code',
            { body: { cpf: cpfNumeros } }
          );

          if (verificationError || !verificationData?.success) {
            toast({
              title: "Erro",
              description: "Erro ao enviar código de verificação",
              variant: "destructive",
            });
            return;
          }

          if (verificationData.verificacaoNecessaria) {
            setPhoneNumbers(verificationData.telefones || []);
            setShowVerificationStep(true);
            toast({
              title: "✅ Código enviado",
              description: `Código enviado para ${verificationData.totalEnvios || 0} número(s)`,
              duration: 5000,
            });
            return;
          }
        } else {
          // Se verificação não está habilitada, bloquear acesso
          toast({
            title: "Sistema desabilitado",
            description: "O sistema de validação está desabilitado no momento",
            variant: "destructive",
          });
          return;
        }
      }

    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Erro",
        description: "Digite o código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setVerificationLoading(true);
    try {
      const cpfNumeros = cpf.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('verify-medico-code', {
        body: { cpf: cpfNumeros, codigo: verificationCode }
      });

      if (error || !data?.success) {
        toast({
          title: "Código inválido",
          description: data?.error || "Código inválido ou expirado",
          variant: "destructive",
        });
        return;
      }

      // Salvar token E CPF validado da sessão
      localStorage.setItem('medico_session_token', data.token);
      localStorage.setItem('medico_validated_cpf', cpfNumeros);
      setSessionToken(data.token);
      setShowVerificationStep(false);
      setVerificationCode("");

      toast({
        title: "Verificado!",
        description: "Código verificado com sucesso",
      });

      // Carregar dados do médico
      await loadMedicoData(cpfNumeros);

    } catch (error: any) {
      console.error("Erro ao verificar código:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao verificar código",
        variant: "destructive",
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const processarDadosMedico = (result: any) => {
    // Consolidar notas por pagamento para decidir corretamente se ainda precisa enviar
    const notasRaw = result.notas || [];
    const notasPorPagamento = (notasRaw as any[]).reduce((acc: Record<string, { temPendente: boolean; temAprovado: boolean; temRejeitado: boolean }>, nota: any) => {
      const pid = nota.pagamento_id || nota.pagamentos?.id;
      if (!pid) return acc;
      if (!acc[pid]) acc[pid] = { temPendente: false, temAprovado: false, temRejeitado: false };
      if (nota.status === 'pendente') acc[pid].temPendente = true;
      if (nota.status === 'aprovado') acc[pid].temAprovado = true;
      if (nota.status === 'rejeitado') acc[pid].temRejeitado = true;
      return acc;
    }, {} as Record<string, { temPendente: boolean; temAprovado: boolean; temRejeitado: boolean }>)

    const pagamentosPendentesData = result.pagamentos || [];

    const pagamentosPendentesProcessados = pagamentosPendentesData?.filter((p: any) => {
      const s = notasPorPagamento[p.id];
      // Mostrar como pendente quando: não há nota enviada ainda OU houve rejeição
      if (!s) return ['pendente','solicitado'].includes(p.status || 'pendente');
      if (s.temAprovado || s.temPendente) return false; // já enviado/aprovado → não mostrar
      if (s.temRejeitado && !s.temPendente && !s.temAprovado) return true; // precisa reenviar
      return false;
    }).map((p: any) => ({
      id: p.id,
      mes_competencia: p.mes_competencia,
      valor: p.valor,
      status: p.status,
      temNotaRejeitada: !!notasPorPagamento[p.id]?.temRejeitado,
      temNotaPendente: !!notasPorPagamento[p.id]?.temPendente
    })) || [];

    setPagamentosPendentes(pagamentosPendentesProcessados);

    const notasData = result.notas || [];
    const notasProcessadas = notasData.map((nota: any) => ({
      id: nota.id,
      status: nota.status,
      nome_arquivo: nota.nome_arquivo,
      created_at: nota.created_at,
      observacoes: nota.observacoes,
      pagamento: {
        valor: nota.pagamentos.valor,
        mes_competencia: nota.pagamentos.mes_competencia,
        data_pagamento: nota.pagamentos.data_pagamento
      }
    }));

    setNotas(notasProcessadas);

    const notasRejeitadas = notasProcessadas.filter((n: any) => n.status === 'rejeitado');
    if (notasRejeitadas.length > 0) {
      setRejectedNotes(notasRejeitadas);
      setShowRejectedAlert(true);
    }

    const totalNotas = notasProcessadas.length;
    const notasAprovadas = notasProcessadas.filter((n: any) => n.status === 'aprovado').length;
    const notasPendentes = notasProcessadas.filter((n: any) => n.status === 'pendente').length;
    const rejeitadasCount = notasProcessadas.filter((n: any) => n.status === 'rejeitado').length;

    const valorTotal = notasProcessadas.reduce((sum: number, nota: any) => sum + nota.pagamento.valor, 0);
    const valorAprovado = notasProcessadas
      .filter((n: any) => n.status === 'aprovado')
      .reduce((sum: number, nota: any) => sum + nota.pagamento.valor, 0);
    const valorPendente = notasProcessadas
      .filter((n: any) => n.status === 'pendente')
      .reduce((sum: number, nota: any) => sum + nota.pagamento.valor, 0);

    setStats({
      totalNotas,
      notasAprovadas,
      notasPendentes,
      notasRejeitadas: rejeitadasCount,
      valorTotal,
      valorAprovado,
      valorPendente
    });

    const monthlyData = notasProcessadas.reduce((acc: Record<string, any>, nota: any) => {
      const mes = nota.pagamento.mes_competencia;
      if (!acc[mes]) {
        acc[mes] = { mes, valor: 0, status: nota.status };
      }
      acc[mes].valor += nota.pagamento.valor;
      return acc;
    }, {} as Record<string, any>);

    setChartData((Object.values(monthlyData) as ChartData[]).sort((a, b) => a.mes.localeCompare(b.mes)));
  };

  const loadMedicoDataById = async (medicoId: string) => {
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('get-medico-dados', {
        body: { medicoId, token: sessionToken || localStorage.getItem('medico_session_token') }
      });

      if (fnError || !result?.medico) {
        // Se falhar, limpar sessão e CPF validado
        localStorage.removeItem('medico_session_token');
        localStorage.removeItem('medico_validated_cpf');
        setSessionToken(null);
        return;
      }

      const medicoData = result.medico;
      setMedico(medicoData);
      setCpf(formatCPF(medicoData.documento || ''));

      // Animação de entrada do dashboard
      setTimeout(() => setShowDashboard(true), 100);

      // Verificar se há ticket pendente de avaliação
      checkPendingRating(medicoData.id);

      processarDadosMedico(result);
    } catch (error: any) {
      console.error("Erro ao buscar dados do médico:", error);
      localStorage.removeItem('medico_session_token');
      localStorage.removeItem('medico_validated_cpf');
      setSessionToken(null);
    }
  };

  const loadMedicoData = async (cpfNumeros: string) => {
    try {
      // SEMPRE exigir token para buscar dados
      const savedToken = sessionToken || localStorage.getItem('medico_session_token');
      const savedCpf = localStorage.getItem('medico_validated_cpf');
      
      // Verificar se há token válido
      if (!savedToken || savedCpf !== cpfNumeros) {
        localStorage.removeItem('medico_session_token');
        localStorage.removeItem('medico_validated_cpf');
        setSessionToken(null);
        setMedico(null);
        setShowDashboard(false);
        
        toast({
          title: "Autenticação necessária",
          description: "Por favor, faça login para acessar seus dados",
          variant: "destructive",
        });
        return;
      }
      
      const { data: result, error: fnError } = await supabase.functions.invoke('get-medico-dados', {
        body: { 
          cpf: cpfNumeros, 
          token: savedToken
        }
      });

      // Tratar erros de validação de sessão
      if (fnError || result?.error) {
        const errorCode = result?.code;
        
        if (errorCode === 'VALIDATION_REQUIRED' || errorCode === 'SESSION_REQUIRED' || errorCode === 'INVALID_SESSION') {
          // Limpar sessão e exigir nova validação
          localStorage.removeItem('medico_session_token');
          localStorage.removeItem('medico_validated_cpf');
          setSessionToken(null);
          setMedico(null);
          setShowDashboard(false);
          
          toast({
            title: "Sessão expirada",
            description: "Por favor, faça login novamente",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "CPF/CNPJ não encontrado",
          description: "Não encontramos um médico ativo com este CPF/CNPJ",
          variant: "destructive",
        });
        return;
      }

      if (!result?.medico) {
        toast({
          title: "CPF/CNPJ não encontrado",
          description: "Não encontramos um médico ativo com este CPF/CNPJ",
          variant: "destructive",
        });
        return;
      }

      const medicoData = result.medico;
      setMedico(medicoData);

      // Animação de entrada do dashboard
      setTimeout(() => setShowDashboard(true), 100);

      // Verificar se há ticket pendente de avaliação
      checkPendingRating(medicoData.id);

      processarDadosMedico(result);

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar dados",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente Análise</Badge>;
      case 'aprovado':
        return <Badge variant="default"><FileCheck className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive">❌ Rejeitado</Badge>;
      case 'enviado':
        return <Badge variant="outline"><Upload className="h-3 w-3 mr-1" />Enviado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statusColors = {
    aprovado: '#22c55e',
    pendente: '#f59e0b',
    rejeitado: '#ef4444'
  };

  const handleFileSelection = (file: File) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são aceitos",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setShowConfirmUpload(true);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !selectedPagamento) return;

    // Se OCR estiver desativado, validar valor líquido
    if (!ocrHabilitado) {
      if (!valorLiquido || parseFloat(valorLiquido) <= 0) {
        toast({
          title: "Erro",
          description: "Por favor, informe o valor líquido da nota",
          variant: "destructive",
        });
        return;
      }

      const valorLiquidoNum = parseFloat(valorLiquido);
      const valorBrutoNum = selectedPagamento.valor;

      if (valorLiquidoNum > valorBrutoNum) {
        toast({
          title: "Erro",
          description: "O valor líquido não pode ser maior que o valor bruto",
          variant: "destructive",
        });
        return;
      }
    }

    setUploading(true);
    setShowConfirmUpload(false);

    // Mostrar toast informativo de que o envio está em andamento
    toast({
      title: "Enviando...",
      description: ocrHabilitado 
        ? "Aguarde, processando nota fiscal automaticamente..." 
        : "Aguarde, sua nota está sendo enviada. Não feche esta página.",
      duration: 5000,
    });
    
    try {
      // Upload do arquivo
      const fileExt = 'pdf';
      const fileName = `${selectedPagamento.id}_${Date.now()}.${fileExt}`;
      const filePath = `medicos/${fileName}`;

      // Upload mais otimizado
      const { error: uploadError } = await supabase.storage
        .from('notas')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      let numeroNota = null;
      let valorBrutoOCR = null;
      let valorLiquidoOCR = null;
      let ocrProcessado = false;
      let ocrResultado = null;

      // Se OCR estiver habilitado, processar a nota
      if (ocrHabilitado) {
        try {
          // Ler o arquivo como ArrayBuffer
          const arrayBuffer = await selectedFile.arrayBuffer();
          
          // Converter para base64
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64Data = btoa(binary);

          // Chamar função OCR
          const { data: ocrData, error: ocrError } = await supabase.functions.invoke('process-ocr-nfse', {
            body: { pdfData: base64Data }
          });

          if (ocrError) {
            console.error('Erro OCR:', ocrError);
            throw new Error('Falha ao processar OCR da nota');
          }

          if (ocrData?.success) {
            numeroNota = ocrData.numeroNota;
            valorBrutoOCR = ocrData.valorBruto;
            valorLiquidoOCR = ocrData.valorLiquido;
            ocrProcessado = true;
            ocrResultado = ocrData;

            // Validar valor bruto
            const valorEsperado = selectedPagamento.valor;
            const diferenca = Math.abs(valorEsperado - (valorBrutoOCR || 0));

            if (diferenca > 0.01) {
              // Remover arquivo do storage
              await supabase.storage.from('notas').remove([filePath]);

              toast({
                title: "❌ Nota Rejeitada",
                description: `O valor bruto da nota (R$ ${valorBrutoOCR?.toFixed(2)}) não corresponde ao valor esperado (R$ ${valorEsperado.toFixed(2)}). Por favor, verifique e envie a nota correta.`,
                variant: "destructive",
                duration: 10000,
              });

              setUploading(false);
              return;
            }

            console.log('✅ OCR processado:', { numeroNota, valorBrutoOCR, valorLiquidoOCR });
          }
        } catch (ocrError) {
          console.error('Erro ao processar OCR:', ocrError);
          // Continuar mesmo com erro de OCR (fallback para fluxo manual)
        }
      }

      // Preparar dados da nota
      const notaInsertData: any = {
        medico_id: medico.id,
        pagamento_id: selectedPagamento.id,
        arquivo_url: filePath,
        nome_arquivo: selectedFile.name,
        status: 'pendente'
      };

      if (ocrProcessado) {
        notaInsertData.numero_nota = numeroNota;
        notaInsertData.valor_bruto = valorBrutoOCR;
        notaInsertData.ocr_processado = true;
        notaInsertData.ocr_resultado = ocrResultado;
      }

      // Preparar dados do pagamento
      const pagamentoUpdate: any = {
        status: "nota_recebida",
        nota_pdf_url: filePath,
        data_resposta: new Date().toISOString()
      };

      // Adicionar valor líquido conforme OCR ou input manual
      if (valorLiquidoOCR) {
        pagamentoUpdate.valor_liquido = valorLiquidoOCR;
      } else if (!ocrHabilitado && valorLiquido) {
        pagamentoUpdate.valor_liquido = parseFloat(valorLiquido);
      }

      // Fazer inserções e atualizações em paralelo
      const [pagamentoUpdateResult, notaInsertResult, pagamentoDataResult] = await Promise.allSettled([
        // Atualizar o pagamento
        supabase
          .from("pagamentos")
          .update(pagamentoUpdate)
          .eq("id", selectedPagamento.id)
          .eq("medico_id", medico.id),
        
        // Registrar na tabela notas_medicos
        supabase
          .from("notas_medicos")
          .insert(notaInsertData)
          .select('id')
          .single(),
        
        // Buscar competência
        supabase
          .from('pagamentos')
          .select('mes_competencia')
          .eq('id', selectedPagamento.id)
          .single()
      ]);

      // Verificar se houve erro no insert da nota
      if (notaInsertResult.status === 'rejected') {
        await supabase.storage.from('notas').remove([filePath]);
        throw new Error('Erro ao registrar nota');
      }

      const notaData = (notaInsertResult as PromiseFulfilledResult<any>).value.data;
      const competencia = (pagamentoDataResult as PromiseFulfilledResult<any>).value?.data?.mes_competencia || selectedPagamento.mes_competencia;

      const valorParaNotificacao = valorLiquidoOCR || (valorLiquido ? parseFloat(valorLiquido) : null);

      // Disparar notificações em background (não bloquear UI)
      Promise.all([
        // WhatsApp para médico
        supabase.functions.invoke('send-whatsapp-template', {
          body: {
            type: 'nota_recebida',
            medico: {
              nome: medico.nome,
              numero_whatsapp: medico.numero_whatsapp
            },
            competencia: competencia,
            pagamentoId: selectedPagamento.id,
            valorBruto: selectedPagamento.valor,
            valorLiquido: valorParaNotificacao
          }
        }).then(res => console.log('WhatsApp médico enviado:', res)).catch(err => console.error('Erro WhatsApp médico:', err)),
        
        // Email para gestores
        supabase.functions.invoke('send-email-notification', {
          body: {
            type: 'nova_nota',
            pagamentoId: selectedPagamento.id,
            notaId: notaData.id,
            fileName: selectedFile.name,
            valorLiquido: valorParaNotificacao,
            pdfPath: filePath
          }
        }).then(res => console.log('Email gestores enviado:', res)).catch(err => console.error('Erro email gestores:', err)),
        
        // WhatsApp para gestores com PDF
        (async () => {
          try {
            // Buscar dados do médico incluindo especialidade
            const { data: medicoData } = await supabase
              .from('medicos')
              .select('nome, especialidade, documento')
              .eq('id', medico.id)
              .single();
            
            // Buscar gestores
            const { data: gestores } = await supabase
              .from('profiles')
              .select('numero_whatsapp')
              .eq('role', 'gestor')
              .not('numero_whatsapp', 'is', null);
            
            if (!gestores?.length) {
              console.warn('Nenhum gestor com WhatsApp cadastrado');
              return;
            }
            
            // Baixar PDF do storage
            const { data: pdfData, error: downloadError } = await supabase.storage
              .from('notas')
              .download(filePath);
            
            if (downloadError || !pdfData) {
              throw new Error('Erro ao baixar PDF');
            }
            
            // Converter para base64
            const arrayBuffer = await pdfData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const pdfBase64 = btoa(binary);
            
            // Gerar token baseado no created_at da nota (formato aceito pela edge function)
            const tokenAprovar = btoa(`${notaData.id}-${notaData.created_at}-approve`).substring(0, 20);
            const tokenRejeitar = btoa(`${notaData.id}-${notaData.created_at}-reject`).substring(0, 20);
            
            // Links de aprovação e rejeição
            const aprovarLink = `https://hcc.chatconquista.com/aprovar?i=${notaData.id}&t=${tokenAprovar}`;
            const rejeitarLink = `https://hcc.chatconquista.com/rejeitar?i=${notaData.id}&t=${tokenRejeitar}`;
            
            // Enviar para cada gestor
            const promises = gestores.map(async (gestor) => {
              const message = `🔔 *Nova Nota Fiscal Recebida*\n\n` +
                `👨‍⚕️ *Médico:* ${medicoData?.nome || medico.nome}\n` +
                `📋 *Especialidade:* ${medicoData?.especialidade || 'Não informada'}\n` +
                `📄 *Documento:* ${medicoData?.documento || 'Não informado'}\n` +
                `📅 *Competência:* ${competencia}\n` +
                `💰 *Valor Bruto:* R$ ${selectedPagamento.valor.toFixed(2)}\n` +
                `💵 *Valor Líquido:* R$ ${valorParaNotificacao ? valorParaNotificacao.toFixed(2) : 'A definir'}\n\n` +
                `📎 *Anexo:* Nota fiscal em PDF\n\n` +
                `⚠️ *Ações necessárias:*\n` +
                `✅ Aprovar: ${aprovarLink}\n` +
                `❌ Rejeitar: ${rejeitarLink}\n\n` +
                `Por favor, analise a nota fiscal anexada e clique em um dos links acima.`;
              
              return supabase.functions.invoke('send-notification-gestores', {
                body: {
                  phoneNumber: gestor.numero_whatsapp,
                  message: message,
                  pdf_base64: pdfBase64,
                  pdf_filename: selectedFile.name
                }
              });
            });
            
            await Promise.all(promises);
            console.log('WhatsApp gestores enviado com PDF');
          } catch (err) {
            console.error('Erro WhatsApp gestores:', err);
          }
        })()
      ]).catch(err => console.warn('Erro nas notificações:', err));

      // UI Update imediato
      setShowUploadModal(false);
      setSelectedPagamento(null);
      setSelectedFile(null);
      setValorLiquido("");
      
      // Recarregar dados
      buscarDados();

      // Mensagem de sucesso
      const isReenvio = selectedPagamento?.temNotaRejeitada;
      const successMessage = ocrProcessado 
        ? `Nota fiscal ${isReenvio ? 'reenviada' : 'enviada'} e validada automaticamente! Número: ${numeroNota || 'N/A'}. O gestor será notificado para análise.`
        : isReenvio 
          ? "Nota fiscal reenviada. O gestor será notificado para análise." 
          : "Nota fiscal enviada. O gestor será notificado para análise.";
      
      toast({
        title: "✅ Nota Enviada!",
        description: successMessage,
        duration: 8000,
      });

    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "❌ Erro no Envio",
        description: error.message || "Falha no upload. Tente novamente.",
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setUploading(false);
    }
  };

  const pieData = [
    { name: 'Aprovadas', value: stats.notasAprovadas, color: statusColors.aprovado },
    { name: 'Pendentes', value: stats.notasPendentes, color: statusColors.pendente },
    { name: 'Rejeitadas', value: stats.notasRejeitadas, color: statusColors.rejeitado }
  ].filter(item => item.value > 0);

  // Renderização inicial - Loading Config
  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
        <LoadingSpinner size="lg" text="Carregando configurações..." />
      </div>
    );
  }

  // Loading inicial das configurações
  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Renderização - Manutenção
  if (manutencao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 via-destructive/5 to-background p-4">
        <div className="w-full max-w-4xl text-center space-y-8 animate-fade-in">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <AlertTriangle className="w-32 h-32 mx-auto text-destructive mb-6 drop-shadow-2xl" />
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 drop-shadow-lg">
              Sistema em Manutenção
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-2xl mx-auto">
              {mensagemManutencao}
            </p>
            {previsaoRetorno && (
              <div className="inline-flex items-center gap-2 bg-primary/10 px-6 py-3 rounded-full">
                <Clock className="w-5 h-5 text-primary" />
                <p className="text-lg font-semibold text-primary">
                  Previsão de retorno: {format(new Date(previsaoRetorno), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  if (!medico) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="glass-effect border-border/50 hover:bg-accent/50 transition-all"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-xl">
          {/* Animação do gráfico girando - aparece por 2 segundos */}
          <AnimatePresence>
            {showInitialAnimation && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="flex justify-center mb-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="relative"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shadow-glow">
                    <BarChart3 className="h-12 w-12 text-primary" />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tela de Verificação de Código - Design Profissional */}
          {showVerificationStep ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <Card className="glass-effect border-primary/30 shadow-2xl overflow-hidden">
                {/* Header com gradiente */}
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border-b border-border/30">
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center space-y-4"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shadow-glow"
                      >
                        <MessageSquare className="h-10 w-10 text-primary" />
                      </motion.div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h2 className="text-3xl font-bold gradient-text">Verificação de Segurança</h2>
                      <p className="text-muted-foreground text-sm max-w-md">
                        Por segurança, enviamos um código de verificação para seus telefones cadastrados
                      </p>
                    </div>
                  </motion.div>
                </div>

                <CardContent className="p-8 space-y-6">
                  {/* Card informativo sobre o código */}
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Código de Verificação via WhatsApp</AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      Enviamos um código de 6 dígitos para seu(s) WhatsApp cadastrado(s). Digite o código recebido para acessar o dashboard de forma segura.
                    </AlertDescription>
                  </Alert>

                  {/* Lista de telefones com design moderno */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-xl p-5 border border-success/20 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-5 w-5 text-success" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">Código enviado para:</h3>
                          <p className="text-xs text-muted-foreground">Verifique suas mensagens no WhatsApp</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 ml-13">
                        {phoneNumbers.length > 0 ? phoneNumbers.map((phone, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 + idx * 0.1 }}
                            className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/50"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {phone?.tipo?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="font-mono text-sm font-semibold text-foreground">{phone?.numero || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">{phone?.tipo || 'Telefone'}</p>
                            </div>
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              Enviado
                            </Badge>
                          </motion.div>
                        )) : (
                          <p className="text-sm text-muted-foreground text-center py-2">Nenhum telefone cadastrado</p>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Input do código com design profissional */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                  >
                    <Label htmlFor="verification_code" className="text-base font-semibold">
                      Digite o Código de Verificação
                    </Label>
                    <div className="relative">
                      <Input
                        id="verification_code"
                        placeholder="• • • • • •"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="text-3xl text-center font-bold tracking-[1em] h-16 bg-gradient-to-br from-background to-secondary/5 border-2 border-primary/20 focus:border-primary/50 shadow-sm"
                        autoFocus
                      />
                      {verificationCode.length === 6 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                            <FileCheck className="h-5 w-5 text-success" />
                          </div>
                        </motion.div>
                      )}
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Código de 6 dígitos • Válido por 10 minutos
                    </p>
                  </motion.div>

                  {/* Botões de ação */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-3 pt-2"
                  >
                    <Button 
                      onClick={() => {
                        setShowVerificationStep(false);
                        setVerificationCode("");
                        setPhoneNumbers([]);
                      }}
                      variant="outline"
                      className="flex-1 h-12"
                      disabled={verificationLoading}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleVerifyCode}
                      disabled={verificationLoading || verificationCode.length !== 6}
                      className="flex-1 h-12 shadow-elegant hover:shadow-glow transition-all bg-gradient-to-r from-primary to-primary/80"
                    >
                      {verificationLoading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="mr-2"
                          >
                            <BarChart3 className="h-5 w-5" />
                          </motion.div>
                          Verificando...
                        </>
                      ) : (
                        <>
                          <FileCheck className="mr-2 h-5 w-5" />
                          Verificar Código
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {/* Link para reenviar */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-center pt-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-primary"
                      onClick={buscarDados}
                      disabled={verificationLoading}
                    >
                      Não recebeu o código? <span className="ml-1 underline">Reenviar</span>
                    </Button>
                  </motion.div>
                </CardContent>

                {/* Footer */}
                <div className="px-8 pb-6 pt-4 border-t border-border/30 bg-gradient-to-br from-transparent to-secondary/5">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xs text-muted-foreground">Desenvolvido por</span>
                    <img 
                      src={conquistaLogo} 
                      alt="Conquista Inovação" 
                      className="h-5 opacity-60 hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="glass-effect border-primary/20 shadow-elegant">
                <CardHeader className="text-center pb-6 space-y-6">
                  {/* Logo dentro do card */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="flex justify-center"
                  >
                    <img src={logo} alt="HCC Hospital" className="h-20 w-auto" />
                  </motion.div>

                  <div>
                    <CardTitle className="text-2xl gradient-text mb-2">Dashboard Médicos</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Digite seu CPF ou CNPJ para visualizar suas informações
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpf" className="text-sm font-medium">CPF ou CNPJ</Label>
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        value={cpf}
                        onChange={handleCPFChange}
                        maxLength={18}
                        className="text-lg text-center font-semibold"
                      />
                    </div>
                    <Button 
                      onClick={buscarDados} 
                      disabled={loading}
                      className="w-full shadow-elegant hover:shadow-glow transition-all"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="mr-2"
                          >
                            <BarChart3 className="h-5 w-5" />
                          </motion.div>
                          Carregando...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="h-5 w-5 mr-2" />
                          Acessar Dashboard
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
                <div className="px-6 pb-6 pt-4 border-t border-border/30">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xs text-muted-foreground">Desenvolvido por</span>
                    <img 
                      src={conquistaLogo} 
                      alt="Conquista Inovação" 
                      className="h-5 opacity-60 hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Seção especial para médicos com notas pendentes */}
        {pagamentosPendentes.length > 0 && (
          <Card className="mb-8 border-warning/30 bg-warning/5">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center">
                  <Upload className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <h3 className="text-base md:text-lg font-semibold text-foreground mb-2 flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                    <span className="break-words">Notas Fiscais Pendentes</span>
                  </h3>
                  <p className="text-sm md:text-base text-muted-foreground mb-4">
                    Você tem <strong className="text-warning">{pagamentosPendentes.length}</strong> pagamento(s) aguardando envio de nota fiscal.
                  </p>
                  <div className="grid gap-3">
                    {pagamentosPendentes.map((pagamento) => (
                      <div
                        key={pagamento.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 bg-card rounded-lg border border-border/50 hover:border-border transition-all gap-3"
                      >
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-semibold text-foreground text-sm md:text-base break-words">
                              {formatMesCompetencia(pagamento.mes_competencia)}
                            </span>
                            <span className="text-base md:text-lg font-bold text-success">
                              {formatCurrency(pagamento.valor)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {pagamento.temNotaRejeitada && (
                              <Badge variant="destructive" className="text-xs">
                                <X className="h-3 w-3 mr-1" />
                                Rejeitada - Reenviar
                              </Badge>
                            )}
                            {pagamento.temNotaPendente && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Aguardando Análise
                              </Badge>
                            )}
                          </div>
                        </div>
                         <Button
                          onClick={() => {
                            setSelectedPagamento(pagamento);
                            setSelectedFile(null);
                            setValorLiquido("");
                            setShowUploadModal(true);
                          }}
                          size="sm"
                          variant={pagamento.temNotaRejeitada ? "destructive" : pagamento.temNotaPendente ? "secondary" : "default"}
                          disabled={pagamento.temNotaPendente && !pagamento.temNotaRejeitada}
                          className="w-full sm:w-auto flex-shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          <span className="text-xs md:text-sm">
                            {pagamento.temNotaRejeitada ? "Reenviar" : 
                             pagamento.temNotaPendente ? "Enviada" : "Enviar Nota"}
                          </span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <Card className="mb-8 glass-effect border-primary/20">
          <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-primary opacity-10 blur-xl rounded-lg" />
                    <img 
                      src={logo} 
                      alt="HCC Hospital" 
                      className="h-12 w-12 md:h-16 md:w-16 object-contain relative z-10 drop-shadow-lg"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-2xl font-bold gradient-text mb-0.5 md:mb-1 truncate">
                      {medico.nome}
                    </h2>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Portal do Médico • Notas e pagamentos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="glass-effect border-primary/20 flex-shrink-0"
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setMedico(null)}
                    className="glass-effect border-primary/20 flex-shrink-0"
                    size="sm"
                  >
                    Sair
                  </Button>
                </div>
              </div>
          </CardContent>
        </Card>

        {/* Dialog para notas rejeitadas */}
        <Dialog open={showRejectedAlert} onOpenChange={setShowRejectedAlert}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Notas Fiscais Rejeitadas
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {rejectedNotes.map((nota, index) => (
                <Alert key={index} variant="destructive" className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="mt-2">
                    <div className="space-y-2">
                      <p className="font-semibold">
                        Nota Rejeitada - {nota.pagamento?.mes_competencia}
                      </p>
                      <p><strong>Valor:</strong> {formatCurrency(nota.pagamento?.valor || 0)}</p>
                      <p><strong>Motivo da rejeição:</strong></p>
                      <p className="bg-destructive/10 p-2 rounded text-sm">
                        {nota.observacoes || "Não especificado"}
                      </p>
                      <p className="text-sm font-medium">
                        ⚠️ Por favor, corrija os problemas apontados e envie uma nova nota fiscal.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRejectedAlert(false)}
                >
                  Fechar
                </Button>
                <Button 
                  onClick={() => {
                    setShowRejectedAlert(false);
                    const pagamentoRejeitado = pagamentosPendentes.find(p => p.temNotaRejeitada);
                    if (pagamentoRejeitado) {
                      setSelectedPagamento(pagamentoRejeitado);
                      setShowUploadModal(true);
                    }
                  }}
                >
                  Corrigir Agora
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Alerta para notas pendentes */}
        {pagamentosPendentes.length > 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <strong>Atenção!</strong> Você possui {pagamentosPendentes.length} pagamento(s) que precisam de nota fiscal para liberação.
                  {pagamentosPendentes.some(p => p.temNotaRejeitada) && (
                    <div className="mt-1 text-sm">
                      ⚠️ Algumas notas foram rejeitadas e precisam ser reenviadas.
                    </div>
                  )}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 w-full sm:w-auto flex-shrink-0"
                  onClick={() => {
                    setSelectedPagamento(pagamentosPendentes[0]);
                    setShowUploadModal(true);
                  }}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {pagamentosPendentes.some(p => p.temNotaRejeitada) ? 'Reenviar Nota' : 'Enviar Nota'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Notas</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNotas}</div>
              <p className="text-xs text-muted-foreground">
                Notas enviadas no total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</div>
              <p className="text-xs text-muted-foreground">
                Valor total dos pagamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Aprovado</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.valorAprovado)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.notasAprovadas} notas aprovadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(stats.valorPendente)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.notasPendentes} notas pendentes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Valores por mês */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Valores por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(Number(value)), "Valor"]}
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Bar dataKey="valor" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Status das Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de Tickets do Chat */}
        <div className="mb-8">
          <TicketHistory medicoId={medico.id} medicoNome={medico.nome} />
        </div>

        {/* Histórico de notas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Histórico de Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notas.map((nota) => (
                <div key={nota.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{nota.nome_arquivo}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(nota.created_at).toLocaleDateString('pt-BR')} • 
                        {formatMesCompetencia(nota.pagamento.mes_competencia)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(nota.status)}
                      </div>
                      {nota.observacoes && (
                        <p className="text-destructive">
                          <strong>Observações:</strong> {nota.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                   <div className="text-right">
                     <p className="text-lg font-bold text-primary">
                       {formatCurrency(nota.pagamento.valor)}
                     </p>
                     {nota.pagamento.data_pagamento && (
                       <p className="text-sm text-green-600 font-medium">
                         💰 Pago em {new Date(nota.pagamento.data_pagamento).toLocaleDateString('pt-BR')}
                       </p>
                     )}
                   </div>
                </div>
              ))}
              
              {notas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma nota fiscal encontrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal para upload de notas */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Upload className="h-5 w-5 text-primary" />
                {selectedPagamento?.temNotaRejeitada ? 'Reenviar Nota Fiscal' : 'Enviar Nota Fiscal'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedPagamento && (
                <div className="p-3 md:p-4 bg-muted/50 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm md:text-base">Detalhes do Pagamento</h4>
                    {selectedPagamento.temNotaRejeitada && (
                      <Badge variant="destructive" className="text-xs w-fit">
                        Nota Rejeitada - Reenvio Necessário
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Competência:</span>
                      <p className="font-medium">
                        {formatMesCompetencia(selectedPagamento.mes_competencia)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor:</span>
                      <p className="font-medium text-primary">
                        {formatCurrency(selectedPagamento.valor)}
                      </p>
                    </div>
                  </div>
                  {selectedPagamento.temNotaRejeitada && (
                    <Alert className="mt-3 border-red-200 bg-red-50">
                      <X className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-sm">
                        A nota anterior foi rejeitada. Envie uma nova nota fiscal corrigida.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm md:text-base">Arquivo PDF da Nota Fiscal</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileSelection(file);
                    }
                  }}
                  disabled={uploading}
                  className="text-sm"
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Importante:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Apenas arquivos PDF são aceitos</li>
                    <li>Certifique-se de que todos os dados estão corretos</li>
                    <li>A nota deve corresponder ao valor e período informado</li>
                    {selectedPagamento?.temNotaRejeitada && (
                      <li className="text-red-600 font-medium">Corrija os problemas da nota anterior antes de reenviar</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>

              {uploading && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Enviando arquivo...</span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmação de upload */}
        <Dialog open={showConfirmUpload} onOpenChange={setShowConfirmUpload}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Confirmar Envio
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedFile && (
                <Alert>
                  <AlertDescription>
                    <strong>Arquivo selecionado:</strong><br/>
                    {selectedFile.name}
                  </AlertDescription>
                </Alert>
              )}

              {!ocrHabilitado && (
                <div className="space-y-2">
                  <Label htmlFor="valor-liquido">
                    Valor Líquido da Nota Fiscal *
                  </Label>
                  <Input
                    id="valor-liquido"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1000.50"
                    value={valorLiquido}
                    onChange={(e) => setValorLiquido(e.target.value)}
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o valor líquido que consta na nota fiscal
                  </p>
                </div>
              )}

              {ocrHabilitado && (
                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>OCR Habilitado:</strong> O sistema irá extrair automaticamente os dados da nota fiscal.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmUpload(false);
                    setSelectedFile(null);
                    setValorLiquido("");
                  }}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={uploading || (!ocrHabilitado && !valorLiquido)}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Confirmar e Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Histórico - já existe componente TicketHistory, sem precisar wrapper */}
        
        {/* Fim do dashboard */}
      </div>
      
      {/* Chat Component */}
      {medico && showDashboard && (
        <ChatWithFinanceiro
          medicoId={medico.id} 
          medicoNome={medico.nome}
          isGestor={false}
        />
      )}
    </div>
  );
}