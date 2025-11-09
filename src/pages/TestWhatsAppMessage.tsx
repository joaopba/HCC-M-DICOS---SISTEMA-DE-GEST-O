import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

export default function TestWhatsAppMessage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();

  const enviarTeste = async () => {
    setLoading(true);
    setResponse(null);

    try {
      console.log('Invocando test-whatsapp-message...');
      
      const { data, error } = await supabase.functions.invoke('test-whatsapp-message');

      console.log('Resposta:', { data, error });

      if (error) throw error;

      setResponse(data);
      
      toast({
        title: "Sucesso!",
        description: "Mensagem de teste enviada para 77981086497",
      });
    } catch (error: any) {
      console.error('Erro:', error);
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
      <Card>
        <CardHeader>
          <CardTitle>Teste Rápido WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para enviar uma mensagem de teste para o número 77981086497
          </p>

          <Button onClick={enviarTeste} disabled={loading} size="lg">
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Enviando..." : "Enviar Teste"}
          </Button>

          {response && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
