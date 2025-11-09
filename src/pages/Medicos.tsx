import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { HCC_EMPRESA_ID } from "@/lib/constants";
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
import ExcelImport from "@/components/ExcelImport";
import conquistaLogo from "@/assets/conquista-inovacao.png";

interface Medico {
  id: string;
  nome: string;
  numero_whatsapp: string;
  numero_whatsapp_contador?: string;
  especialidade: string;
  documento: string;
  tipo_pessoa: string;
  ativo: boolean;
}

export default function Medicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    numero_whatsapp: "",
    numero_whatsapp_contador: "",
    especialidade: "",
    documento: "",
    tipo_pessoa: "CPF",
  });

  useEffect(() => {
    loadMedicos();
    
    // Realtime updates
    const channel = supabase
      .channel('medicos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicos' }, () => {
        loadMedicos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMedicos = async () => {
    try {
      const { data, error } = await supabase
        .from("medicos")
        .select("*")
        .order("nome");

      if (error) throw error;
      setMedicos(data || []);
    } catch (error) {
      console.error("Erro ao carregar médicos:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar lista de médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    try {
      if (editingMedico) {
        const { error } = await supabase
          .from("medicos")
          .update(formData)
          .eq("id", editingMedico.id);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Médico atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("medicos")
          .insert([{ ...formData, empresa_id: HCC_EMPRESA_ID }]);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Médico cadastrado com sucesso!",
        });
      }

      setShowDialog(false);
      setEditingMedico(null);
      setFormData({ nome: "", numero_whatsapp: "", numero_whatsapp_contador: "", especialidade: "", documento: "", tipo_pessoa: "CPF" });
      loadMedicos();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      
      let errorMessage = "Falha ao salvar médico";
      
      if (error?.code === '23505') {
        const detail = error?.details || error?.message || '';
        
        if (detail.includes('medicos_documento_key')) {
          const { data: medicoExistente } = await supabase
            .from('medicos')
            .select('nome, documento')
            .eq('documento', formData.documento)
            .maybeSingle();
          
          if (medicoExistente) {
            errorMessage = `CPF/CNPJ já cadastrado para: ${medicoExistente.nome} (${medicoExistente.documento})`;
          } else {
            errorMessage = `Este CPF/CNPJ já está cadastrado no sistema`;
          }
        } else {
          errorMessage = 'Registro duplicado encontrado. Verifique os dados.';
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (medico: Medico) => {
    setEditingMedico(medico);
    setFormData({
      nome: medico.nome,
      numero_whatsapp: medico.numero_whatsapp,
      numero_whatsapp_contador: medico.numero_whatsapp_contador || "",
      especialidade: medico.especialidade || "",
      documento: medico.documento || "",
      tipo_pessoa: medico.tipo_pessoa || "CPF",
    });
    setShowDialog(true);
  };

  const toggleStatus = async (medico: Medico) => {
    try {
      const { error } = await supabase
        .from("medicos")
        .update({ ativo: !medico.ativo })
        .eq("id", medico.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Médico ${!medico.ativo ? "ativado" : "desativado"} com sucesso!`,
      });

      loadMedicos();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast({
        title: "Erro",
        description: "Falha ao alterar status do médico",
        variant: "destructive",
      });
    }
  };

  const handleExcelImport = async (data: any[]) => {
    try {
      const medicosData = data.map(row => ({
        nome: row.nome || row.Nome,
        numero_whatsapp: row.numero_whatsapp || row.WhatsApp || row.whatsapp,
        numero_whatsapp_contador: row.numero_whatsapp_contador || row.whatsapp_contador || "",
        especialidade: row.especialidade || row.Especialidade || "",
        documento: row.documento || row.Documento || row.cpf || row.CPF || row.cnpj || row.CNPJ || "",
        tipo_pessoa: row.tipo_pessoa || row.tipo || (row.cnpj || row.CNPJ ? "CNPJ" : "CPF"),
        empresa_id: HCC_EMPRESA_ID
      }));

      const { error } = await supabase
        .from("medicos")
        .insert(medicosData);

      if (error) throw error;

      setShowImportDialog(false);
      await loadMedicos();
    } catch (error) {
      console.error("Erro ao importar médicos:", error);
      throw error;
    }
  };

  const getTemplateData = () => [
    {
      nome: "Dr. João Silva",
      numero_whatsapp: "5511999999999",
      numero_whatsapp_contador: "5511988888888",
      especialidade: "Cardiologia",
      documento: "12345678900",
      tipo_pessoa: "CPF"
    },
    {
      nome: "Clínica ABC Ltda",
      numero_whatsapp: "5511777777777",
      numero_whatsapp_contador: "",
      especialidade: "Radiologia",
      documento: "12345678000190",
      tipo_pessoa: "CNPJ"
    }
  ];

  const filteredMedicos = medicos.filter((medico) =>
    medico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medico.especialidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout title="Médicos" subtitle="Gerenciar cadastro de médicos do hospital">
      <div className="p-3 sm:p-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Médicos via Excel</DialogTitle>
                </DialogHeader>
                <ExcelImport
                  onImport={handleExcelImport}
                  templateData={getTemplateData()}
                  templateFilename="modelo-medicos.xlsx"
                  expectedColumns={["nome", "numero_whatsapp", "documento", "tipo_pessoa"]}
                  title="Importação de Médicos"
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingMedico(null);
                  setFormData({ nome: "", numero_whatsapp: "", numero_whatsapp_contador: "", especialidade: "", documento: "", tipo_pessoa: "CPF" });
                }} className="btn-gradient-primary gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Novo Médico
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMedico ? "Editar Médico" : "Novo Médico"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_pessoa">Tipo de Pessoa</Label>
                  <Select value={formData.tipo_pessoa} onValueChange={(value) => setFormData({ ...formData, tipo_pessoa: value })}>
                    <SelectTrigger id="tipo_pessoa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF - Pessoa Física</SelectItem>
                      <SelectItem value="CNPJ">CNPJ - Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documento">{formData.tipo_pessoa === "CNPJ" ? "CNPJ" : "CPF"}</Label>
                  <Input
                    id="documento"
                    value={formData.documento}
                    onChange={(e) => setFormData({ ...formData, documento: e.target.value.replace(/\D/g, '') })}
                    placeholder={formData.tipo_pessoa === "CNPJ" ? "00000000000000" : "00000000000"}
                    maxLength={formData.tipo_pessoa === "CNPJ" ? 14 : 11}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_whatsapp">Número WhatsApp (Médico)</Label>
                  <Input
                    id="numero_whatsapp"
                    value={formData.numero_whatsapp}
                    onChange={(e) => setFormData({ ...formData, numero_whatsapp: e.target.value })}
                    placeholder="5511999999999"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_whatsapp_contador">WhatsApp Contador (Opcional)</Label>
                  <Input
                    id="numero_whatsapp_contador"
                    value={formData.numero_whatsapp_contador}
                    onChange={(e) => setFormData({ ...formData, numero_whatsapp_contador: e.target.value })}
                    placeholder="5511988888888"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Input
                    id="especialidade"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : (editingMedico ? "Atualizar" : "Salvar")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="card-professional table-professional">
          <div className="table-header-professional p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar médicos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 w-full"
              />
            </div>
          </div>
          <div className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-poppins font-semibold min-w-[180px]">Nome</TableHead>
                  <TableHead className="font-poppins font-semibold min-w-[140px]">WhatsApp</TableHead>
                  <TableHead className="font-poppins font-semibold min-w-[140px]">Especialidade</TableHead>
                  <TableHead className="font-poppins font-semibold min-w-[100px]">Status</TableHead>
                  <TableHead className="font-poppins font-semibold min-w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicos.map((medico) => (
                  <TableRow key={medico.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{medico.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{medico.numero_whatsapp}</TableCell>
                    <TableCell className="text-muted-foreground">{medico.especialidade || "-"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={medico.ativo ? "default" : "secondary"}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => toggleStatus(medico)}
                      >
                        {medico.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(medico)}
                        className="hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer with Conquista Logo */}
        <div className="mt-8 pt-6 border-t border-border/30 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground">Desenvolvido por</span>
          <img 
            src={conquistaLogo} 
            alt="Conquista Inovação" 
            className="h-5 opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </AppLayout>
  );
}