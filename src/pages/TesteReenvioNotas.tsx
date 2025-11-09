import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TesteReenvioNotas = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleReenviar = async () => {
    setLoading(true);
    setResult(null);

    try {
      // IDs das 2 notas mais recentes de hoje
      const notaIds = [
        '02de9745-9e47-412d-8581-7e5ef4ad5b60', // SAMUEL RANGEL
        'b20e2459-b073-415f-a3eb-735946146d57'  // MARIA IZABELLA
      ];

      const { data, error } = await supabase.functions.invoke('resend-nota-gestores', {
        body: { nota_ids: notaIds }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Notificações Enviadas!",
        description: `${notaIds.length} notificações reenviadas com sucesso`,
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
        <h1 className="text-2xl font-bold mb-4">Reenvio de Notificações aos Gestores</h1>
        
        <p className="text-muted-foreground mb-4">
          Esta página irá reenviar as notificações das 2 notas recebidas hoje:
        </p>
        
        <ul className="list-disc list-inside mb-6 space-y-2">
          <li>SAMUEL RANGEL DE SOUZA BRITO - SETEMBRO/2025 - R$ 4.661,45</li>
          <li>MARIA IZABELLA NAVARRO - SETEMBRO/2025 - R$ 2.915,44</li>
        </ul>

        <Button 
          onClick={handleReenviar} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Enviando..." : "Reenviar Notificações aos Gestores"}
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

export default TesteReenvioNotas;
