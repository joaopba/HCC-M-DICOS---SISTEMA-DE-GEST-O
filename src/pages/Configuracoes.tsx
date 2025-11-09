import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Copy, TestTube, Mail, Wrench, Settings, MessageSquare, Bell, Calendar, Cog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import SystemInfo from "@/components/SystemInfo";
import { HCC_EMPRESA_ID } from "@/lib/constants";

interface Configuracao {
  id: string;
  api_url: string;
  auth_token: string;
  webhook_url: string;
  email_notificacoes: boolean;
  ocr_nfse_habilitado: boolean;
  ocr_nfse_api_key: string;
  permitir_nota_via_whatsapp: boolean;
  horario_envio_relatorios: string;
  intervalo_cobranca_nota_horas: number;
  lembrete_periodico_horas: number;
  dashboard_medicos_manutencao: boolean;
  dashboard_medicos_mensagem_manutencao: string;
  dashboard_medicos_previsao_retorno: string;
  verificacao_medico_habilitada: boolean;
  verificacao_medico_template_nome: string;
  verificacao_medico_duracao_sessao_horas: number;
}

export default function Configuracoes() {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const { toast } = useToast();

  const webhookUrl = `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/webhook-handler`;

  useEffect(() => {
    loadConfiguracoes();
    
    const channel = supabase
      .channel('configuracoes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => {
        loadConfiguracoes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("*")
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      setConfig({
        id: "",
        api_url: "https://api.hcchospital.com.br/v2/api/external/43e14118-b615-419a-b827-23480915ddcb",
        auth_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MywicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoyLCJpYXQiOjE3NTgxMjkzMjMsImV4cCI6MTgyMTIwMTMyM30.dEvjbe3ZYLkFn3Bx7N8uKcsw34ZOJoCApJRgAAMmW2w",
        webhook_url: "",
        email_notificacoes: true,
        ocr_nfse_habilitado: false,
        ocr_nfse_api_key: "",
        permitir_nota_via_whatsapp: true,
        horario_envio_relatorios: "08:00",
        intervalo_cobranca_nota_horas: 24,
        lembrete_periodico_horas: 48,
        dashboard_medicos_manutencao: false,
        dashboard_medicos_mensagem_manutencao: "Dashboard em manutenção. Por favor, tente novamente mais tarde.",
        dashboard_medicos_previsao_retorno: "",
        verificacao_medico_habilitada: false,
        verificacao_medico_template_nome: "verificamedico",
        verificacao_medico_duracao_sessao_horas: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("configuracoes")
          .update({
            api_url: config.api_url,
            auth_token: config.auth_token,
            webhook_url: config.webhook_url,
            email_notificacoes: config.email_notificacoes,
            ocr_nfse_habilitado: config.ocr_nfse_habilitado,
            ocr_nfse_api_key: config.ocr_nfse_api_key,
            permitir_nota_via_whatsapp: config.permitir_nota_via_whatsapp,
            horario_envio_relatorios: config.horario_envio_relatorios,
            intervalo_cobranca_nota_horas: config.intervalo_cobranca_nota_horas,
            lembrete_periodico_horas: config.lembrete_periodico_horas,
            dashboard_medicos_manutencao: config.dashboard_medicos_manutencao,
            dashboard_medicos_mensagem_manutencao: config.dashboard_medicos_mensagem_manutencao,
            dashboard_medicos_previsao_retorno: config.dashboard_medicos_previsao_retorno || null,
            verificacao_medico_habilitada: config.verificacao_medico_habilitada,
            verificacao_medico_template_nome: config.verificacao_medico_template_nome,
            verificacao_medico_duracao_sessao_horas: config.verificacao_medico_duracao_sessao_horas,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("configuracoes")
          .insert([{
            empresa_id: HCC_EMPRESA_ID,
            api_url: config.api_url,
            auth_token: config.auth_token,
            webhook_url: config.webhook_url,
            email_notificacoes: config.email_notificacoes,
            ocr_nfse_habilitado: config.ocr_nfse_habilitado,
            ocr_nfse_api_key: config.ocr_nfse_api_key,
            permitir_nota_via_whatsapp: config.permitir_nota_via_whatsapp,
            horario_envio_relatorios: config.horario_envio_relatorios || "08:00",
            intervalo_cobranca_nota_horas: config.intervalo_cobranca_nota_horas || 24,
            lembrete_periodico_horas: config.lembrete_periodico_horas || 48,
            dashboard_medicos_manutencao: config.dashboard_medicos_manutencao || false,
            dashboard_medicos_mensagem_manutencao: config.dashboard_medicos_mensagem_manutencao || "",
            dashboard_medicos_previsao_retorno: config.dashboard_medicos_previsao_retorno || null,
            verificacao_medico_habilitada: config.verificacao_medico_habilitada || false,
            verificacao_medico_template_nome: config.verificacao_medico_template_nome || "verificamedico",
            verificacao_medico_duracao_sessao_horas: config.verificacao_medico_duracao_sessao_horas || 1,
          }])
          .select()
          .single();

        if (error) throw error;
        if (data) setConfig(data);
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "URL copiada para a área de transferência.",
    });
  };

  const handleTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const { error } = await supabase.functions.invoke('test-email');
      
      if (error) throw error;

      toast({
        title: "E-mail de teste enviado",
        description: "Verifique a caixa de entrada de suporte@chatconquista.com",
      });
    } catch (error: any) {
      console.error("Erro ao enviar e-mail de teste:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar e-mail de teste",
        variant: "destructive",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!config) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as configurações da API, notificações e integrações
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Tudo
              </>
            )}
          </Button>
        </div>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="manutencao" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Manutenção</span>
            </TabsTrigger>
            <TabsTrigger value="sistema" className="flex items-center gap-2">
              <Cog className="h-4 w-4" />
              <span className="hidden sm:inline">Sistema</span>
            </TabsTrigger>
          </TabsList>

          {/* API Configuration */}
          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da API WhatsApp</CardTitle>
                <CardDescription>
                  Configure a URL e token de autenticação da API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api_url">URL da API</Label>
                  <Input
                    id="api_url"
                    value={config.api_url}
                    onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                    placeholder="https://api.example.com/v1/messages"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth_token">Token de Autenticação</Label>
                  <Textarea
                    id="auth_token"
                    value={config.auth_token}
                    onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                    placeholder="Bearer token..."
                    className="font-mono text-sm"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhook URL</CardTitle>
                <CardDescription>
                  URL do webhook para receber atualizações do WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure esta URL no seu provedor de WhatsApp para receber webhooks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>OCR NFS-e (Leitura Automática)</CardTitle>
                <CardDescription>
                  Configure a API de OCR para leitura automática de notas fiscais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Habilitar OCR</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite leitura automática de valores em NFS-e
                    </p>
                  </div>
                  <Switch
                    checked={config.ocr_nfse_habilitado}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, ocr_nfse_habilitado: checked })
                    }
                  />
                </div>

                {config.ocr_nfse_habilitado && (
                  <div className="space-y-2">
                    <Label htmlFor="ocr_api_key">Chave da API OCR</Label>
                    <Input
                      id="ocr_api_key"
                      type="password"
                      value={config.ocr_nfse_api_key}
                      onChange={(e) =>
                        setConfig({ ...config, ocr_nfse_api_key: e.target.value })
                      }
                      placeholder="sk-..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notificacoes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notificações por E-mail</CardTitle>
                <CardDescription>
                  Configure o envio de notificações por e-mail para gestores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enviar E-mails</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifica gestores por e-mail sobre novas notas
                    </p>
                  </div>
                  <Switch
                    checked={config.email_notificacoes}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, email_notificacoes: checked })
                    }
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={sendingTestEmail}
                  className="w-full"
                >
                  {sendingTestEmail ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Enviar E-mail de Teste
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relatórios Automáticos</CardTitle>
                <CardDescription>
                  Configure o horário de envio dos relatórios diários
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="horario_relatorios">Horário de Envio (Brasília)</Label>
                  <Input
                    id="horario_relatorios"
                    type="time"
                    value={config.horario_envio_relatorios}
                    onChange={(e) =>
                      setConfig({ ...config, horario_envio_relatorios: e.target.value })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Os relatórios serão enviados diariamente neste horário
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      setSaving(true);
                      const { data, error } = await supabase.functions.invoke('force-send-reports');
                      
                      if (error) throw error;

                      toast({
                        title: "✅ Relatórios Enviados",
                        description: data?.message || "Relatórios enviados com sucesso para os gestores",
                      });
                    } catch (error: any) {
                      console.error("Erro ao enviar relatórios:", error);
                      toast({
                        title: "Erro",
                        description: error.message || "Erro ao enviar relatórios",
                        variant: "destructive",
                      });
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Enviar Relatórios Agora (Forçado)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp */}
          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notificações WhatsApp</CardTitle>
                <CardDescription>
                  Configure o comportamento das mensagens WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Permitir Nota via WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Médicos podem enviar notas diretamente pelo WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={config.permitir_nota_via_whatsapp}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, permitir_nota_via_whatsapp: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cobrança e Lembretes</CardTitle>
                <CardDescription>
                  Configure os intervalos de cobrança automática
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="intervalo_cobranca">
                    Intervalo de Cobrança de Nota (horas)
                  </Label>
                  <Input
                    id="intervalo_cobranca"
                    type="number"
                    min="1"
                    value={config.intervalo_cobranca_nota_horas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        intervalo_cobranca_nota_horas: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Tempo entre solicitações automáticas de nota
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lembrete_periodico">
                    Lembrete Periódico (horas)
                  </Label>
                  <Input
                    id="lembrete_periodico"
                    type="number"
                    min="1"
                    value={config.lembrete_periodico_horas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        lembrete_periodico_horas: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Intervalo de lembretes para notas pendentes
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verificação de Acesso ao Dashboard</CardTitle>
                <CardDescription>
                  Configure a verificação por código via WhatsApp para médicos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Habilitar Verificação</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir código de verificação via WhatsApp ao acessar o dashboard
                    </p>
                  </div>
                  <Switch
                    checked={config.verificacao_medico_habilitada}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, verificacao_medico_habilitada: checked })
                    }
                  />
                </div>

                {config.verificacao_medico_habilitada && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="verificacao_template">
                        Nome do Template WhatsApp
                      </Label>
                      <Input
                        id="verificacao_template"
                        value={config.verificacao_medico_template_nome}
                        onChange={(e) =>
                          setConfig({ ...config, verificacao_medico_template_nome: e.target.value })
                        }
                        placeholder="verificamedico"
                      />
                      <p className="text-sm text-muted-foreground">
                        O template deve conter o parâmetro {`{{1}}`} para o código
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duracao_sessao">
                        Duração da Sessão (horas)
                      </Label>
                      <Input
                        id="duracao_sessao"
                        type="number"
                        min="1"
                        max="168"
                        value={config.verificacao_medico_duracao_sessao_horas}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            verificacao_medico_duracao_sessao_horas: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Tempo até solicitar nova verificação (1-168 horas)
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance */}
          <TabsContent value="manutencao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manutenção do Dashboard Médicos</CardTitle>
                <CardDescription>
                  Ative a manutenção para bloquear o acesso temporariamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="space-y-0.5">
                    <Label className="text-base">Modo Manutenção</Label>
                    <p className="text-sm text-muted-foreground">
                      Bloqueia o acesso ao dashboard dos médicos
                    </p>
                  </div>
                  <Switch
                    checked={config.dashboard_medicos_manutencao}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, dashboard_medicos_manutencao: checked })
                    }
                  />
                </div>

                {config.dashboard_medicos_manutencao && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="mensagem_manutencao">
                        Mensagem de Manutenção
                      </Label>
                      <Textarea
                        id="mensagem_manutencao"
                        value={config.dashboard_medicos_mensagem_manutencao}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dashboard_medicos_mensagem_manutencao: e.target.value,
                          })
                        }
                        placeholder="Digite a mensagem que será exibida..."
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="previsao_retorno">
                        Previsão de Retorno
                      </Label>
                      <Input
                        id="previsao_retorno"
                        type="datetime-local"
                        value={config.dashboard_medicos_previsao_retorno || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dashboard_medicos_previsao_retorno: e.target.value,
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Data e hora estimada para o sistema voltar
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Info */}
          <TabsContent value="sistema">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Sistema</CardTitle>
                <CardDescription>
                  Detalhes técnicos e diagnósticos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SystemInfo />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
