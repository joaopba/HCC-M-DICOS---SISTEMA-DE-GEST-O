import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function SystemInfo() {
  const [stats, setStats] = useState({
    totalMedicos: 0,
    totalPagamentos: 0,
    versao: "2.0.0",
    ultimoBackup: "N/A"
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: medicos } = await supabase
        .from("medicos")
        .select("id", { count: "exact" });

      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select("id", { count: "exact" });

      setStats({
        totalMedicos: medicos?.length || 0,
        totalPagamentos: pagamentos?.length || 0,
        versao: "2.0.0",
        ultimoBackup: "Automático"
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-muted-foreground">Versão:</p>
        <p className="font-medium">{stats.versao}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Último backup:</p>
        <p className="font-medium">{stats.ultimoBackup}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Total de médicos:</p>
        <p className="font-medium">{stats.totalMedicos}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Total de pagamentos:</p>
        <p className="font-medium">{stats.totalPagamentos}</p>
      </div>
    </div>
  );
}
