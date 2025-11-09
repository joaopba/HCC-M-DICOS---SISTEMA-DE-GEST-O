import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TesteEnvioGestor = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleEnviar = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Buscar uma nota recente para teste
      const { data: notas, error: notasError } = await supabase
        .from('notas_medicos')
        .select('id')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(1);

      if (notasError) throw notasError;
      if (!notas || notas.length === 0) throw new Error('Nenhuma nota pendente encontrada');

      const notaId = notas[0].id;

      // Reenviar para o gestor específico
      const { data, error } = await supabase.functions.invoke('resend-nota-gestores', {
        body: { nota_ids: [notaId] }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Enviado!",
        description: "Nota enviada para o gestor de teste",
      });
    } catch (error: any) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">Teste de Envio para Gestor</h1>
        
        <p className="text-muted-foreground mb-4">
          Número do gestor: 5577981086497
        </p>

        <Button 
          onClick={handleEnviar} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Enviando..." : "Enviar Nota de Teste"}
        </Button>

        {result && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Resultado:</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TesteEnvioGestor;
