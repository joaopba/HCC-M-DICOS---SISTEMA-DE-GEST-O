import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface ExcelImportProps {
  onImport: (data: any[]) => Promise<void>;
  templateData: any[];
  templateFilename: string;
  expectedColumns: string[];
  title: string;
}

export default function ExcelImport({ 
  onImport, 
  templateData, 
  templateFilename, 
  expectedColumns,
  title 
}: ExcelImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFilename);
    
    toast({
      title: "Sucesso",
      description: "Modelo Excel baixado com sucesso!",
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("Arquivo Excel está vazio");
      }

      // Validar colunas
      const firstRow = jsonData[0] as any;
      const fileColumns = Object.keys(firstRow);
      const missingColumns = expectedColumns.filter(col => !fileColumns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`);
      }

      await onImport(jsonData);
      
      toast({
        title: "Sucesso",
        description: `${jsonData.length} registro(s) importado(s) com sucesso!`,
      });

      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error("Erro ao importar:", error);
      
      let errorMessage = "Falha ao importar arquivo";
      
      if (error?.code === '23505') {
        const detail = error?.details || error?.message || '';
        const { supabase } = await import('@/integrations/supabase/client');
        
        if (detail.includes('medicos_documento_key')) {
          const docMatch = detail.match(/\(documento\)=\(([^)]+)\)/);
          const doc = docMatch ? docMatch[1] : 'não identificado';
          
          try {
            const { data: medicoExistente } = await supabase
              .from('medicos')
              .select('nome')
              .eq('documento', doc)
              .single();
            
            if (medicoExistente) {
              errorMessage = `CPF/CNPJ ${doc} já cadastrado para: ${medicoExistente.nome}`;
            } else {
              errorMessage = `CPF/CNPJ duplicado: ${doc}. Já existe cadastro com este documento.`;
            }
          } catch {
            errorMessage = `CPF/CNPJ duplicado: ${doc}. Já existe cadastro com este documento.`;
          }
        } else {
          errorMessage = `Registro duplicado encontrado. Verifique os dados.`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro na Importação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={downloadTemplate}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Modelo
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="excel-file">Selecionar arquivo Excel</Label>
        <div className="flex items-center space-x-2">
          <Input
            id="excel-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isImporting}
            ref={fileInputRef}
            className="flex-1"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? "Importando..." : "Importar"}
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4 inline mr-1" />
        Formatos aceitos: .xlsx, .xls
      </div>
    </div>
  );
}