import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function TesteWhatsApp() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'nota' as 'nota' | 'pagamento',
    numero: '',
    nome: '',
    valor: '',
    competencia: '',
    dataPagamento: ''
  });
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    try {
      console.log('Enviando dados para edge function:', formData);
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp-template', {
        body: formData
      });

      console.log('Resposta da edge function:', { data, error });

      if (error) {
        throw error;
      }

      setResponse(data);
      
      toast({
        title: "Sucesso!",
        description: "Mensagem WhatsApp enviada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      setResponse({ error: error.message });
      
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de teste */}
        <Card>
          <CardHeader>
            <CardTitle>Teste WhatsApp</CardTitle>
            <CardDescription>
              Envie mensagens de teste para WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de mensagem</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'nota' | 'pagamento') => 
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nota">Nota Fiscal</SelectItem>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero">Número WhatsApp</Label>
                <Input
                  id="numero"
                  placeholder="5577981086497"
                  value={formData.numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome do médico</Label>
                <Input
                  id="nome"
                  placeholder="Dr. João Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  required
                />
              </div>

              {formData.type === 'nota' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor</Label>
                    <Input
                      id="valor"
                      placeholder="1500.00"
                      value={formData.valor}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="competencia">Competência</Label>
                    <Input
                      id="competencia"
                      placeholder="Janeiro/2025"
                      value={formData.competencia}
                      onChange={(e) => setFormData(prev => ({ ...prev, competencia: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {formData.type === 'pagamento' && (
                <div className="space-y-2">
                  <Label htmlFor="dataPagamento">Data do pagamento</Label>
                  <Input
                    id="dataPagamento"
                    placeholder="15/01/2025"
                    value={formData.dataPagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, dataPagamento: e.target.value }))}
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resposta */}
        <Card>
          <CardHeader>
            <CardTitle>Resposta da API</CardTitle>
            <CardDescription>
              Visualize a resposta e logs da edge function
            </CardDescription>
          </CardHeader>
          <CardContent>
            {response ? (
              <Textarea
                readOnly
                value={JSON.stringify(response, null, 2)}
                className="min-h-[300px] font-mono text-sm"
              />
            ) : (
              <p className="text-muted-foreground">
                Nenhuma resposta ainda. Envie uma mensagem para ver o resultado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}