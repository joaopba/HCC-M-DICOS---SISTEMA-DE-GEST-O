import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CreditCard, FileCheck, DollarSign, Bell, TrendingUp, Activity, ArrowUpRight, ArrowDownRight, Clock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalMedicos: number;
  pagamentosPendentes: number;
  notasRecebidas: number;
  valorTotal: number;
  notasParaPagamento: number; // Agora é valor monetário
}

interface MonthlyPayment {
  month: string;
  valor: number;
}

interface StatusDistribution {
  name: string;
  value: number;
  color: string;
}

interface DailyActivity {
  day: string;
  pagamentos: number;
}

export default function Dashboard() {
  // Calcular mês anterior como default (sem problemas de timezone)
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

  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultMonth());
  const [stats, setStats] = useState<DashboardStats>({
    totalMedicos: 0,
    pagamentosPendentes: 0,
    notasRecebidas: 0,
    valorTotal: 0,
    notasParaPagamento: 0,
  });
  const [loading, setLoading] = useState(true);
  const [monthlyPayments, setMonthlyPayments] = useState<MonthlyPayment[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth]);

  const loadDashboardData = async () => {
    try {
      // Total de médicos ativos
      const { data: medicos } = await supabase
        .from("medicos")
        .select("id")
        .eq("ativo", true);

      // Criar query base para pagamentos com filtro de mês
      const createFilteredQuery = () => {
        let query = supabase.from("pagamentos");
        
        // Aplicar filtro de mês se não for "all"
        if (selectedMonth !== 'all') {
          return query.select("*").eq("mes_competencia", selectedMonth);
        }
        return query.select("*");
      };

      // Pagamentos pendentes de solicitação (com filtro)
      let pendenteQuery = supabase.from("pagamentos").select("id, valor").eq("status", "pendente");
      if (selectedMonth !== 'all') pendenteQuery = pendenteQuery.eq("mes_competencia", selectedMonth);
      const { data: pendentes } = await pendenteQuery;

      // Notas fiscais validadas (aprovadas)
      const { data: notasValidadas } = await supabase
        .from("notas_medicos")
        .select("id")
        .eq("status", "aprovado");

      // Valor total pendente (validadas ou aprovadas mas não pagas) (com filtro)
      let pendentesQuery = supabase.from("pagamentos").select("valor").in("status", ["nota_recebida", "aprovado"]);
      if (selectedMonth !== 'all') pendentesQuery = pendentesQuery.eq("mes_competencia", selectedMonth);
      const { data: pagamentosPendentes } = await pendentesQuery;

      // Valor total do período selecionado
      let valorQuery = supabase.from("pagamentos").select("valor");
      if (selectedMonth !== 'all') {
        valorQuery = valorQuery.eq("mes_competencia", selectedMonth);
      } else {
        // Se "Ver Tudo", pega o mês atual como referência para o card
        const currentMonth = new Date().toISOString().slice(0, 7);
        valorQuery = valorQuery.eq("mes_competencia", currentMonth);
      }
      const { data: pagamentosAtual } = await valorQuery;

      const valorTotal = pagamentosAtual?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      const valorPendente = pagamentosPendentes?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      setStats({
        totalMedicos: medicos?.length || 0,
        pagamentosPendentes: pendentes?.length || 0,
        notasRecebidas: notasValidadas?.length || 0,
        valorTotal,
        notasParaPagamento: valorPendente,
      });

      // Buscar pagamentos dos últimos 6 meses agrupados por mês
      let paymentsQuery = supabase
        .from("pagamentos")
        .select("mes_competencia, valor, created_at")
        .order("mes_competencia", { ascending: true });
      
      // Aplicar filtro de mês se selecionado
      if (selectedMonth !== 'all') {
        paymentsQuery = paymentsQuery.eq("mes_competencia", selectedMonth);
      }
      
      const { data: allPayments } = await paymentsQuery;

      if (allPayments) {
        // Agrupar por mês
        const monthlyMap = allPayments.reduce((acc: Record<string, number>, payment) => {
          const month = payment.mes_competencia;
          if (!acc[month]) acc[month] = 0;
          acc[month] += Number(payment.valor);
          return acc;
        }, {});

        // Converter para array e pegar últimos 6 meses
        const monthlyArray = Object.entries(monthlyMap)
          .map(([month, valor]) => ({
            month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
            valor: valor as number,
            rawMonth: month
          }))
          .sort((a, b) => a.rawMonth.localeCompare(b.rawMonth))
          .slice(-6)
          .map(({ month, valor }) => ({ month, valor }));

        setMonthlyPayments(monthlyArray);
      }

      // Buscar distribuição por status de notas
      let allNotes;
      
      // Se houver filtro de mês, buscar apenas notas do mês selecionado
      if (selectedMonth !== 'all') {
        const { data: pagamentosDoMes } = await supabase
          .from("pagamentos")
          .select("id")
          .eq("mes_competencia", selectedMonth);
        
        const pagamentoIds = pagamentosDoMes?.map(p => p.id) || [];
        
        if (pagamentoIds.length > 0) {
          const { data: filteredNotes } = await supabase
            .from("notas_medicos")
            .select("status")
            .in("pagamento_id", pagamentoIds);
          allNotes = filteredNotes;
        } else {
          allNotes = [];
        }
      } else {
        const { data: allNotesData } = await supabase
          .from("notas_medicos")
          .select("status");
        allNotes = allNotesData;
      }

      if (allNotes) {
        const statusMap: Record<string, number> = {};
        allNotes.forEach(note => {
          statusMap[note.status] = (statusMap[note.status] || 0) + 1;
        });

        const statusColors: Record<string, string> = {
          'aprovado': 'hsl(142 70% 50%)',
          'pendente': 'hsl(43 90% 60%)',
          'rejeitado': 'hsl(0 85% 60%)',
        };

        const statusLabels: Record<string, string> = {
          'aprovado': 'Aprovadas',
          'pendente': 'Pendentes',
          'rejeitado': 'Rejeitadas',
        };

        const distribution = Object.entries(statusMap)
          .map(([status, value]) => ({
            name: statusLabels[status] || status,
            value,
            color: statusColors[status] || 'hsl(200 85% 55%)'
          }))
          .filter(item => item.value > 0);

        setStatusDistribution(distribution);
      }

      // Buscar atividade dos últimos 7 dias - PAGAMENTOS EFETIVADOS (data_pagamento)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let recentPaymentsQuery = supabase
        .from("pagamentos")
        .select("data_pagamento")
        .not("data_pagamento", "is", null)
        .gte("data_pagamento", sevenDaysAgo.toISOString());
      
      // Aplicar filtro de mês se selecionado
      if (selectedMonth !== 'all') {
        recentPaymentsQuery = recentPaymentsQuery.eq("mes_competencia", selectedMonth);
      }

      const { data: recentPayments } = await recentPaymentsQuery;

      if (recentPayments) {
        const dayMap: Record<string, number> = {
          'Dom': 0, 'Seg': 0, 'Ter': 0, 'Qua': 0, 'Qui': 0, 'Sex': 0, 'Sáb': 0
        };

        recentPayments.forEach(payment => {
          if (payment.data_pagamento) {
            const date = new Date(payment.data_pagamento);
            const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
            const dayShort = dayName.charAt(0).toUpperCase() + dayName.slice(1, 3);
            if (dayMap[dayShort] !== undefined) {
              dayMap[dayShort]++;
            }
          }
        });

        const activity = Object.entries(dayMap).map(([day, pagamentos]) => ({
          day,
          pagamentos
        }));

        setDailyActivity(activity);
      }

      // Mostrar notificação se houver notas para pagamento
      if (pagamentosPendentes && pagamentosPendentes.length > 0) {
        toast({
          title: "📋 Novas notas recebidas!",
          description: `Você tem ${pagamentosPendentes.length} nota(s) aguardando pagamento.`,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 border-border/50">
          <p className="text-foreground font-semibold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('alor') || entry.name.includes('eta') 
                ? formatCurrency(entry.value) 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Gerar lista de meses para o seletor (sem problemas de timezone)
  const generateMonthOptions = () => {
    const options = [{ value: 'all', label: 'Ver Tudo' }];
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-11
    
    // Últimos 12 meses
    for (let i = 0; i < 12; i++) {
      const monthFormatted = (month + 1).toString().padStart(2, '0');
      const yearMonth = `${year}-${monthFormatted}`;
      
      // Criar label formatado
      const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const label = `${mesesNomes[month]} de ${year}`;
      
      options.push({ value: yearMonth, label });
      
      // Decrementar mês
      month--;
      if (month < 0) {
        month = 11;
        year--;
      }
    }
    
    return options;
  };

  return (
    <AppLayout title="Dashboard Executivo" subtitle="Análise completa do sistema de pagamentos">
      {loading ? (
        <div className="p-6 space-y-6">
          {/* Loading Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 h-40 animate-pulse"
              >
                <div className="h-10 w-10 bg-muted rounded-xl mb-4" />
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 glass-card p-6 h-96 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-full bg-muted/50 rounded" />
            </div>
            <div className="glass-card p-6 h-96 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-full bg-muted/50 rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
        {/* Filtro de Competência */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <Calendar className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1">Filtrar por Competência</h3>
              <p className="text-sm text-muted-foreground">Selecione o período para análise</p>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Alert Banner */}
        {stats.notasParaPagamento > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card border-warning/50 bg-gradient-to-r from-warning/10 to-warning/5 cursor-pointer hover:scale-[1.01] transition-all"
            onClick={() => navigate('/pagamentos')}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="p-3 bg-warning/20 rounded-xl shrink-0"
              >
                <Bell className="h-5 w-5 text-warning" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">Atenção Necessária</h4>
                <p className="text-sm text-muted-foreground">
                  {stats.notasParaPagamento} nota(s) fiscal aguardando processamento e pagamento
                </p>
              </div>
              <Button className="btn-premium-primary w-full sm:w-auto">
                Ver Detalhes
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-premium group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigate('/medicos');
              toast({ description: "Navegando para Gerenciar Médicos..." });
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <motion.div 
                  className="p-3 bg-gradient-primary rounded-xl group-hover:scale-110 transition-transform"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Users className="h-6 w-6 text-primary-foreground" />
                </motion.div>
                <div className="flex items-center gap-1 text-success text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  +12%
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Médicos Ativos</h3>
              <p className="text-3xl font-bold gradient-text mb-1">{stats.totalMedicos}</p>
              <p className="text-xs text-muted-foreground">Total cadastrado no sistema</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-premium group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigate('/pagamentos');
              toast({ description: "Navegando para Pagamentos Pendentes..." });
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <motion.div 
                  className="p-3 bg-gradient-to-br from-warning to-warning/60 rounded-xl group-hover:scale-110 transition-transform"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Clock className="h-6 w-6 text-warning-foreground" />
                </motion.div>
                <div className="flex items-center gap-1 text-warning text-sm font-semibold">
                  <Activity className="h-4 w-4" />
                  Ativo
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Solicitações Pendentes</h3>
              <p className="text-3xl font-bold text-warning mb-1">{stats.pagamentosPendentes}</p>
              <p className="text-xs text-muted-foreground">Aguardando análise inicial</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-premium group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigate('/pagamentos');
              toast({ description: "Navegando para Notas Fiscais..." });
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <motion.div 
                  className="p-3 bg-gradient-to-br from-accent to-accent/60 rounded-xl group-hover:scale-110 transition-transform"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <FileCheck className="h-6 w-6 text-accent-foreground" />
                </motion.div>
                <div className="flex items-center gap-1 text-info text-sm font-semibold">
                  <ArrowUpRight className="h-4 w-4" />
                  +8
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Notas Fiscais</h3>
              <p className="text-3xl font-bold text-accent mb-1">{stats.notasRecebidas}</p>
              <p className="text-xs text-muted-foreground">Recebidas e validadas</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-premium group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigate('/relatorios');
              toast({ description: "Navegando para Relatórios..." });
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <motion.div 
                  className="p-3 bg-gradient-to-br from-success to-success/60 rounded-xl group-hover:scale-110 transition-transform"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <DollarSign className="h-6 w-6 text-success-foreground" />
                </motion.div>
                <div className="flex items-center gap-1 text-success text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  +23%
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Valor Total</h3>
              <p className="text-2xl font-bold text-success mb-1">{formatCurrency(stats.valorTotal)}</p>
              <p className="text-xs text-muted-foreground">Volume do mês atual</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="card-premium group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigate('/pagamentos');
              toast({ description: "Navegando para Pagamentos Pendentes..." });
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <motion.div 
                  className="p-3 bg-gradient-to-br from-warning to-warning/60 rounded-xl group-hover:scale-110 transition-transform"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Clock className="h-6 w-6 text-warning-foreground" />
                </motion.div>
                <div className="flex items-center gap-1 text-destructive text-sm font-semibold">
                  <Activity className="h-4 w-4" />
                  Pendente
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Valor Total Pendente</h3>
              <p className="text-2xl font-bold text-warning mb-1">{formatCurrency(stats.notasParaPagamento)}</p>
              <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Revenue Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="xl:col-span-2 card-premium"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Evolução de Pagamentos</h3>
                  <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
                </div>
                {monthlyPayments.length > 0 && (
                  <Badge className="badge-premium bg-success/10 text-success border-success/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Dados Reais
                  </Badge>
                )}
              </div>
              {monthlyPayments.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyPayments}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(220 90% 56%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(220 90% 56%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="valor" 
                      name="Valor Pagamentos"
                      stroke="hsl(220 90% 56%)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValor)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p>Nenhum dado de pagamento disponível</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Status Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="card-premium"
          >
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground">Distribuição por Status</h3>
                <p className="text-sm text-muted-foreground">Notas fiscais</p>
              </div>
              {statusDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {statusDistribution.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">{item.name}</p>
                          <p className="text-sm font-semibold text-foreground">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p>Nenhuma nota fiscal cadastrada</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Activity and Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Weekly Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="card-premium"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Atividade Semanal</h3>
                  <p className="text-sm text-muted-foreground">Pagamentos efetivados por dia</p>
                </div>
                <Activity className="h-5 w-5 text-primary" />
              </div>
              {dailyActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="day" 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="pagamentos" 
                      name="Pagamentos"
                      fill="hsl(220 90% 56%)" 
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  <p>Nenhuma atividade registrada</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="card-premium"
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-6">Ações Rápidas</h3>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    navigate('/medicos');
                    toast({ description: "✨ Abrindo gestão de médicos..." });
                  }}
                  className="w-full justify-between btn-premium-primary h-14 text-base group"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    <span className="font-semibold">Gerenciar Médicos</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
                <Button 
                  onClick={() => {
                    navigate('/pagamentos');
                    toast({ description: "💳 Abrindo processamento de pagamentos..." });
                  }}
                  className="w-full justify-between btn-premium-secondary h-14 text-base group"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5" />
                    <span className="font-semibold">Processar Pagamentos</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
                <Button 
                  onClick={() => {
                    navigate('/pagamentos');
                    toast({ description: "📋 Abrindo validação de notas fiscais..." });
                  }}
                  className="w-full justify-between btn-premium-secondary h-14 text-base group"
                >
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-5 w-5" />
                    <span className="font-semibold">Validar Notas Fiscais</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
                <Button 
                  onClick={() => {
                    navigate('/relatorios');
                    toast({ description: "📊 Abrindo relatórios analíticos..." });
                  }}
                  className="w-full justify-between btn-premium-secondary h-14 text-base group"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5" />
                    <span className="font-semibold">Relatórios Analíticos</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      )}
    </AppLayout>
  );
}