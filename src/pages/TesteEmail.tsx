import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail } from "lucide-react";

export default function TesteEmail() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSendTestEmail = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Buscando último pagamento com nota...');
      
      // Buscar último pagamento com nota recebida
      const { data: pagamento, error: pagError } = await supabase
        .from('pagamentos')
        .select('id, mes_competencia, valor, nota_pdf_url')
        .eq('status', 'nota_recebida')
        .not('nota_pdf_url', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (pagError || !pagamento) {
        throw new Error('Nenhum pagamento com nota encontrado');
      }

      console.log('Pagamento encontrado:', pagamento);

      // Buscar nota associada
      const { data: nota } = await supabase
        .from('notas_medicos')
        .select('id, nome_arquivo, arquivo_url')
        .eq('pagamento_id', pagamento.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      console.log('Nota encontrada:', nota);

      // Enviar e-mail de teste
      console.log('Invocando função de e-mail...');
      const response = await supabase.functions.invoke('send-email-notification', {
        body: {
          type: 'nova_nota',
          pagamentoId: pagamento.id,
          notaId: nota?.id,
          fileName: nota?.nome_arquivo || 'nota.pdf',
          pdfPath: nota?.arquivo_url || pagamento.nota_pdf_url
        }
      });

      console.log('Resposta da função:', response);

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResult(response.data);
      
      toast({
        title: "✅ E-mail enviado!",
        description: "Verifique sua caixa de entrada",
      });

    } catch (error: any) {
      console.error('Erro ao enviar e-mail de teste:', error);
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Teste de E-mail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Este teste enviará um e-mail de notificação de nova nota para todos os usuários cadastrados no sistema.
            </p>
            
            <Button 
              onClick={handleSendTestEmail}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar E-mail de Teste
                </>
              )}
            </Button>

            {result && (
              <Card className="mt-4 bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">Resultado</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-sm">ℹ️ Informações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>O que será enviado:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
              <li>E-mail para: chat.chatconquista@gmail.com</li>
              <li>E-mail para: joaopedrorochabahiano@gmail.com</li>
              <li>Com o PDF da última nota anexado</li>
              <li>Notificação de nova nota recebida</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
