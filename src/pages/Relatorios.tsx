import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { formatMesCompetencia } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoHcc from "@/assets/logo.png";
import logoConquista from "@/assets/conquista-inovacao.png";

interface RelatorioItem {
  medico_nome: string;
  numero_whatsapp: string;
  mes_competencia: string;
  valor: number;
  valor_liquido: number;
  status: string;
  data_solicitacao: string;
  data_resposta: string;
  data_pagamento: string;
  numero_nota: string;
}

export default function Relatorios() {
  // Calcular mês anterior como padrão (sem problemas de timezone)
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

  const [dados, setDados] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    mes_inicio: getDefaultMonth(),
    mes_fim: getDefaultMonth(),
    status: "todos",
    medico: "",
  });
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pagamentos")
        .select(`
          id,
          valor,
          valor_liquido,
          status,
          mes_competencia,
          data_solicitacao,
          data_resposta,
          data_pagamento,
          medicos (
            nome,
            numero_whatsapp
          )
        `)
        .order("mes_competencia", { ascending: false });

      // Aplicar filtros
      if (filtros.mes_inicio) {
        query = query.gte("mes_competencia", filtros.mes_inicio);
      }
      
      if (filtros.mes_fim) {
        query = query.lte("mes_competencia", filtros.mes_fim);
      }
      
      if (filtros.status !== "todos") {
        query = query.eq("status", filtros.status as any);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Buscar números de notas
      const pagamentoIds = data?.map(p => p.id) || [];
      const { data: notasData } = await supabase
        .from("notas_medicos")
        .select("pagamento_id, numero_nota")
        .in("pagamento_id", pagamentoIds)
        .eq("status", "aprovado");

      const notasMap = new Map((notasData || []).map(n => [n.pagamento_id, n.numero_nota]));

      // Transformar dados para o formato do relatório
      const dadosFormatados = data?.map(item => {
        // Função para formatar data evitando timezone
        const formatarData = (dataStr: string | null) => {
          if (!dataStr) return '';
          const data = dataStr.split('T')[0]; // Pega apenas a parte da data
          const [ano, mes, dia] = data.split('-');
          return `${dia}/${mes}/${ano}`;
        };

        return {
          medico_nome: item.medicos.nome,
          numero_whatsapp: item.medicos.numero_whatsapp,
          mes_competencia: formatMesCompetencia(item.mes_competencia),
          valor: item.valor,
          valor_liquido: item.valor_liquido || 0,
          status: item.status,
          data_solicitacao: formatarData(item.data_solicitacao),
          data_resposta: formatarData(item.data_resposta),
          data_pagamento: formatarData(item.data_pagamento),
          numero_nota: notasMap.get(item.id) || '-',
        };
      }) || [];

      // Filtrar por médico se especificado
      const dadosFiltrados = filtros.medico 
        ? dadosFormatados.filter(item => 
            item.medico_nome.toLowerCase().includes(filtros.medico.toLowerCase())
          )
        : dadosFormatados;

      setDados(dadosFiltrados);
      
      toast({
        title: "Sucesso",
        description: `Relatório gerado com ${dadosFiltrados.length} registros`,
      });
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = async () => {
    if (dados.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    try {
      // Criar PDF em modo paisagem
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Buscar usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      let userName = 'Sistema';
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.name) userName = profile.name;
      }
      
      // Converter imagens para base64
      const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = url;
        });
      };

      const logoHccBase64 = await loadImage(logoHcc);
      const logoConquistaBase64 = await loadImage(logoConquista);

      // ========== HEADER PREMIUM ==========
      // Fundo degradê no header
      doc.setFillColor(41, 128, 185); // Azul principal
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // Logo HCC
      doc.addImage(logoHccBase64, 'PNG', 15, 8, 50, 19);
      
      // Título principal
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text("RELATÓRIO DE PAGAMENTOS", pageWidth / 2, 20, { align: 'center' });
      
      // Subtítulo
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text("Sistema de Gestão Médica - HCC Hospital", pageWidth / 2, 28, { align: 'center' });

      // ========== INFO BOX ==========
      const infoBoxY = 42;
      
      // Box com fundo suave
      doc.setFillColor(236, 240, 241);
      doc.roundedRect(15, infoBoxY, pageWidth - 30, 22, 2, 2, 'F');
      
      // Borda colorida
      doc.setDrawColor(52, 152, 219);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, infoBoxY, pageWidth - 30, 22, 2, 2, 'S');
      
      // Informações em colunas
      doc.setTextColor(52, 73, 94);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      const col1X = 20;
      const col2X = 100;
      const col3X = 180;
      const col4X = 235;
      const infoY = infoBoxY + 8;
      
      // Coluna 1 - Data
      doc.text("DATA DE GERAÇÃO:", col1X, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }), col1X, infoY + 5);
      
      // Coluna 2 - Usuário
      doc.setFont('helvetica', 'bold');
      doc.text("GERADO POR:", col2X, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(userName, col2X, infoY + 5);
      
      // Coluna 3 - Período
      doc.setFont('helvetica', 'bold');
      doc.text("PERÍODO:", col3X, infoY);
      doc.setFont('helvetica', 'normal');
      const periodoText = filtros.mes_inicio && filtros.mes_fim 
        ? `${filtros.mes_inicio} a ${filtros.mes_fim}`
        : "Todos os períodos";
      doc.text(periodoText, col3X, infoY + 5);
      
      // Coluna 4 - Total de registros
      doc.setFont('helvetica', 'bold');
      doc.text("REGISTROS:", col4X, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(dados.length.toString(), col4X, infoY + 5);

      // ========== CARDS DE RESUMO ==========
      const cardsY = 70;
      const cardWidth = 65;
      const cardHeight = 20;
      const cardSpacing = 8;
      
      const totalBruto = dados.reduce((sum, item) => sum + item.valor, 0);
      const totalLiquido = dados.reduce((sum, item) => sum + item.valor_liquido, 0);
      const totalPagos = dados.filter(item => item.status === 'pago').length;
      
      // Card 1 - Valor Bruto
      doc.setFillColor(46, 204, 113);
      doc.roundedRect(15, cardsY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text("VALOR TOTAL BRUTO", 15 + cardWidth/2, cardsY + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(totalBruto), 15 + cardWidth/2, cardsY + 14, { align: 'center' });
      
      // Card 2 - Valor Líquido
      doc.setFillColor(52, 152, 219);
      doc.roundedRect(15 + cardWidth + cardSpacing, cardsY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setFontSize(8);
      doc.text("VALOR TOTAL LÍQUIDO", 15 + cardWidth + cardSpacing + cardWidth/2, cardsY + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.text(formatCurrency(totalLiquido), 15 + cardWidth + cardSpacing + cardWidth/2, cardsY + 14, { align: 'center' });
      
      // Card 3 - Total de Pagamentos
      doc.setFillColor(155, 89, 182);
      doc.roundedRect(15 + (cardWidth + cardSpacing) * 2, cardsY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setFontSize(8);
      doc.text("TOTAL DE REGISTROS", 15 + (cardWidth + cardSpacing) * 2 + cardWidth/2, cardsY + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.text(dados.length.toString(), 15 + (cardWidth + cardSpacing) * 2 + cardWidth/2, cardsY + 14, { align: 'center' });
      
      // Card 4 - Pagamentos Efetuados
      doc.setFillColor(230, 126, 34);
      doc.roundedRect(15 + (cardWidth + cardSpacing) * 3, cardsY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setFontSize(8);
      doc.text("PAGAMENTOS EFETUADOS", 15 + (cardWidth + cardSpacing) * 3 + cardWidth/2, cardsY + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.text(totalPagos.toString(), 15 + (cardWidth + cardSpacing) * 3 + cardWidth/2, cardsY + 14, { align: 'center' });

      // ========== TABELA DE DADOS ==========
      const tableData = dados.map(item => [
        item.medico_nome,
        item.numero_nota,
        item.mes_competencia,
        formatCurrency(item.valor),
        formatCurrency(item.valor_liquido),
        getStatusLabel(item.status),
        item.data_solicitacao,
        item.data_pagamento
      ]);

      autoTable(doc, {
        startY: 98,
        head: [['Médico', 'Nº Nota', 'Competência', 'Vlr. Bruto', 'Vlr. Líquido', 'Status', 'Dt. Solicitação', 'Dt. Pagamento']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [52, 73, 94],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 3
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [52, 73, 94],
          cellPadding: 2.5
        },
        alternateRowStyles: {
          fillColor: [249, 249, 249]
        },
        columnStyles: {
          0: { cellWidth: 50, halign: 'left' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 24, halign: 'center' },
          6: { cellWidth: 28, halign: 'center' },
          7: { cellWidth: 28, halign: 'center' }
        },
        margin: { left: 15, right: 15 },
        styles: {
          lineColor: [189, 195, 199],
          lineWidth: 0.1
        }
      });

      // ========== FOOTER DISCRETO ==========
      const finalY = (doc as any).lastAutoTable.finalY || 98;
      
      // Se ultrapassar a página, adicionar nova
      if (finalY > pageHeight - 25) {
        doc.addPage();
      }
      
      // Linha sutil
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
      
      // Texto pequeno e discreto
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text("Desenvolvido por", pageWidth - 32, pageHeight - 8);
      
      // Logo Conquista bem pequena
      doc.addImage(logoConquistaBase64, 'PNG', pageWidth - 28, pageHeight - 7, 20, 5);

      // Salvar PDF
      doc.save(`relatorio_pagamentos_${new Date().toISOString().slice(0, 10)}.pdf`);

      toast({
        title: "Sucesso",
        description: "Relatório PDF gerado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportarCSV = () => {
    if (dados.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    const headers = [
      "Médico",
      "Nº Nota",
      "WhatsApp",
      "Competência",
      "Valor Bruto",
      "Valor Líquido",
      "Status",
      "Data Solicitação",
      "Data Resposta",
      "Data Pagamento"
    ];

    const csvContent = [
      headers.join(","),
      ...dados.map(item => [
        `"${item.medico_nome}"`,
        `"${item.numero_nota}"`,
        `"${item.numero_whatsapp}"`,
        item.mes_competencia,
        item.valor.toFixed(2),
        item.valor_liquido.toFixed(2),
        `"${getStatusLabel(item.status)}"`,
        `"${item.data_solicitacao}"`,
        `"${item.data_resposta}"`,
        `"${item.data_pagamento}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_pagamentos_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Sucesso",
      description: "Relatório exportado com sucesso!",
    });
    
    setExporting(false);
  };

  const exportarGoogleSheets = async () => {
    try {
      // Preparar dados para Google Sheets API
      const sheetData = [
        ["Médico", "WhatsApp", "Competência", "Valor Bruto", "Valor Líquido", "Status", "Data Solicitação", "Data Resposta", "Data Pagamento"],
        ...dados.map(item => [
          item.medico_nome,
          item.numero_whatsapp,
          item.mes_competencia,
          item.valor,
          item.valor_liquido,
          getStatusLabel(item.status),
          item.data_solicitacao,
          item.data_resposta,
          item.data_pagamento
        ])
      ];

      // Chamar edge function para integração com Google Sheets
      const { data, error } = await supabase.functions.invoke('google-sheets-export', {
        body: {
          data: sheetData,
          sheetName: `Pagamentos_${new Date().toISOString().slice(0, 10)}`
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados exportados para Google Sheets!",
      });
      
      if (data?.sheetUrl) {
        window.open(data.sheetUrl, '_blank');
      }
    } catch (error) {
      console.error("Erro ao exportar para Google Sheets:", error);
      toast({
        title: "Erro",
        description: "Falha ao exportar para Google Sheets. Verifique as configurações da API.",
        variant: "destructive",
      });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendente": return "Pendente";
      case "solicitado": return "Solicitado";
      case "nota_recebida": return "Nota Recebida";
      case "pago": return "Pago";
      default: return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-6">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerar relatórios e exportar dados para análise
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="mes_inicio">Mês Início</Label>
                <Input
                  id="mes_inicio"
                  type="month"
                  value={filtros.mes_inicio}
                  onChange={(e) => setFiltros({ ...filtros, mes_inicio: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mes_fim">Mês Fim</Label>
                <Input
                  id="mes_fim"
                  type="month"
                  value={filtros.mes_fim}
                  onChange={(e) => setFiltros({ ...filtros, mes_fim: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="solicitado">Solicitado</SelectItem>
                    <SelectItem value="nota_recebida">Nota Recebida</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="medico">Médico</Label>
                <Input
                  id="medico"
                  placeholder="Nome do médico..."
                  value={filtros.medico}
                  onChange={(e) => setFiltros({ ...filtros, medico: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={gerarRelatorio} disabled={loading} className="w-full sm:w-auto">
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
              
              {dados.length > 0 && (
                <>
                  <Button onClick={exportarPDF} variant="default" disabled={exporting} className="w-full sm:w-auto">
                    <FileText className="h-4 w-4 mr-2" />
                    {exporting ? "Gerando..." : "Exportar PDF"}
                  </Button>
                  
                  <Button onClick={exportarCSV} variant="outline" disabled={exporting} className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  
                  <Button onClick={exportarGoogleSheets} variant="outline" className="w-full sm:w-auto">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Google Sheets
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {dados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados ({dados.length} registros)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Médico</TableHead>
                      <TableHead className="min-w-[100px]">Nº Nota</TableHead>
                      <TableHead className="min-w-[120px]">Competência</TableHead>
                      <TableHead className="min-w-[120px]">Valor Bruto</TableHead>
                      <TableHead className="min-w-[120px]">Valor Líquido</TableHead>
                      <TableHead className="min-w-[130px]">Status</TableHead>
                      <TableHead className="min-w-[130px]">Data Solicitação</TableHead>
                      <TableHead className="min-w-[130px]">Data Resposta</TableHead>
                      <TableHead className="min-w-[130px]">Data Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.medico_nome}</TableCell>
                        <TableCell className="text-center">{item.numero_nota}</TableCell>
                        <TableCell>{item.mes_competencia}</TableCell>
                        <TableCell>{formatCurrency(item.valor)}</TableCell>
                        <TableCell>{formatCurrency(item.valor_liquido)}</TableCell>
                        <TableCell>{getStatusLabel(item.status)}</TableCell>
                        <TableCell>{item.data_solicitacao}</TableCell>
                        <TableCell>{item.data_resposta}</TableCell>
                        <TableCell>{item.data_pagamento}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}