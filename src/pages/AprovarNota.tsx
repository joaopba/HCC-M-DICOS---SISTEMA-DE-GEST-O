import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, DollarSign, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import conquistaLogo from "@/assets/conquista-inovacao.png";

export default function AprovarNota() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicoNome, setMedicoNome] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notaData, setNotaData] = useState<any>(null);
  const [valorDigitado, setValorDigitado] = useState("");
  const [valorError, setValorError] = useState(false);
  const [valorLiquidoAjustado, setValorLiquidoAjustado] = useState("");

  // Novo estado para mostrar popup
  const [showValorErrorPopup, setShowValorErrorPopup] = useState(false);

  useEffect(() => {
    carregarDadosNota();
  }, []);

  const carregarDadosNota = async () => {
    const notaId = searchParams.get('i') || searchParams.get('nota');
    const token = searchParams.get('t') || searchParams.get('token');

    if (!notaId || !token) {
      setError("Link inválido ou expirado");
      setLoading(false);
      return;
    }

    try {
      const { data: nota, error: notaError } = await supabase
        .from('notas_medicos')
        .select(`
          id,
          medico_id,
          pagamento_id,
          arquivo_url,
          nome_arquivo,
          status,
          numero_nota
        `)
        .eq('id', notaId)
        .maybeSingle();

      if (notaError || !nota) {
        throw new Error('Nota não encontrada');
      }

      // Verificar se a nota já foi aprovada
      if (nota.status === 'aprovado') {
        setError('Esta nota fiscal já foi aprovada anteriormente.');
        setLoading(false);
        return;
      }

      const { data: pagamento, error: pagamentoError } = await supabase
        .from('pagamentos')
        .select('valor_liquido, mes_competencia, valor')
        .eq('id', nota.pagamento_id)
        .maybeSingle();

      if (pagamentoError || !pagamento) {
        throw new Error('Pagamento não encontrado');
      }

      const { data: medico } = await supabase
        .from('medicos')
        .select('nome')
        .eq('id', nota.medico_id)
        .maybeSingle();

      if (medico?.nome) {
        setMedicoNome(medico.nome);
      }

      // Resolver corretamente o path do PDF no bucket 'notas'
      const rawUrl = String(nota.arquivo_url || '');
      let pdfPath: string | null = null;

      // Caso 1: URL já contém '/notas/' (signed/public/object)
      const afterBucket = rawUrl.split('/notas/')[1];
      if (afterBucket) {
        pdfPath = afterBucket.split('?')[0];
      } else {
        // Caso 2: veio como domínio próprio com '/medicos/...'
        const medicosIdx = rawUrl.indexOf('/medicos/');
        if (medicosIdx !== -1) {
          const after = rawUrl.substring(medicosIdx + 1); // remove '/'
          pdfPath = after.split('?')[0]; // 'medicos/xxx.pdf'
        } else if (!rawUrl.startsWith('http') && /\.pdf($|\?)/.test(rawUrl)) {
          // Caso 3: veio somente o caminho relativo
          pdfPath = rawUrl.split('?')[0];
        } else if (nota.nome_arquivo) {
          // Caso 4: fallback pelo nome do arquivo no padrão 'medicos/<file>'
          pdfPath = `medicos/${nota.nome_arquivo}`;
        }
      }

      // Gerar signed URL válida para o PDF (1h)
      let signedPdfUrl = rawUrl;
      if (pdfPath) {
        const { data: urlData } = await supabase.storage
          .from('notas')
          .createSignedUrl(pdfPath, 3600);
        if (urlData?.signedUrl) signedPdfUrl = urlData.signedUrl;
      }

      setNotaData({
        ...nota,
        ...pagamento,
        arquivo_url: signedPdfUrl,
        token
      });
      setValorLiquidoAjustado(pagamento.valor_liquido?.toString() || "");
      setShowConfirmation(true);

    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados da nota.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarAprovacao = async () => {
    if (!notaData) return;
    
    const valorLiquidoAjustadoNum = parseFloat(valorLiquidoAjustado.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const valorDigitadoNum = parseFloat(valorDigitado.replace(/[^\d,.-]/g, '').replace(',', '.'));

    if (!valorDigitado || isNaN(valorDigitadoNum)) {
      setValorError(true);
      setShowValorErrorPopup(true);
      return;
    }

    if (!valorLiquidoAjustado || isNaN(valorLiquidoAjustadoNum)) {
      setValorError(true);
      setShowValorErrorPopup(true);
      return;
    }

    if (Math.abs(valorLiquidoAjustadoNum - valorDigitadoNum) > 0.01) {
      setValorError(true);
      setShowValorErrorPopup(true);
      return;
    }

    setValorError(false);
    setShowValorErrorPopup(false);
    setLoading(true);

    try {
      const notaId = searchParams.get('i') || searchParams.get('nota');
      const token = notaData.token;

      // Atualizar valor_liquido se foi ajustado
      if (Math.abs(valorLiquidoAjustadoNum - parseFloat(notaData.valor_liquido || '0')) > 0.01) {
        await supabase
          .from('pagamentos')
          .update({ valor_liquido: valorLiquidoAjustadoNum })
          .eq('id', notaData.pagamento_id);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(
          `https://nnytrkgsjajsecotasqv.supabase.co/functions/v1/processar-aprovacao?nota=${notaId}&action=aprovar&token=${token}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Erro ao processar aprovação: ${response.status}`);
        }

        setSuccess(true);
        setShowConfirmation(false);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Tempo limite excedido. Tente novamente.');
        }
        throw new Error(`Erro de conexão: ${fetchErr.message}`);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar aprovação.");
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  // Popup/Card de erro para valor digitado incorreto
  const ValorErrorPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <Card className="p-6 rounded-xl max-w-xs w-full shadow-xl relative animate-in fade-in duration-300">
        <button
          onClick={() => setShowValorErrorPopup(false)}
          className="absolute top-3 right-3 text-gray-400 hover:text-red-600"
          aria-label="Fechar"
        >
          <XCircle className="h-6 w-6" />
        </button>
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="h-10 w-10 text-red-600 mb-2" />
          <h2 className="text-lg font-bold text-red-700 mb-1">Valor não confere!</h2>
          <p className="text-gray-800 mb-3 text-sm">
            O valor digitado não corresponde ao valor informado pelo médico.<br/>
            <span className="font-semibold">Confira na nota fiscal</span> e tente novamente.
          </p>
          <Button
            onClick={() => setShowValorErrorPopup(false)}
            className="bg-red-600 text-white w-full mt-2"
          >
            OK, Entendi
          </Button>
        </div>
      </Card>
    </div>
  );

  if (loading) {
    // ... (mantém igual)
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Carregando dados...
          </h1>
          <p className="text-gray-900 text-base">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  if (error) {
    // ... (mantém igual)
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive to-red-700 flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-destructive mb-2">
            Erro ao processar
          </h1>
          <p className="text-gray-900 mb-4 text-base">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors w-full"
          >
            Voltar ao Sistema
          </button>
        </div>
      </div>
    );
  }

  if (showConfirmation && notaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4 relative">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full">
          <div className="text-center mb-6">
            <DollarSign className="h-10 w-10 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Confirmar Aprovação da Nota Fiscal
            </h1>
            <p className="text-gray-800 text-base">Revise todos os dados e confirme o valor líquido</p>
          </div>

          {/* Layout em Grid: PDF à esquerda, Dados à direita */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Coluna da esquerda: PDF Viewer */}
            <div className="space-y-4">
              <Card className="p-4 bg-gray-50 border-gray-200 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  📄 Nota Fiscal Anexada
                </h3>
                <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden" style={{ height: '600px' }}>
                  <iframe
                    src={notaData.arquivo_url}
                    className="w-full h-full"
                    title="Visualização da Nota Fiscal"
                  />
                </div>
                <a 
                  href={notaData.arquivo_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium text-sm flex items-center justify-center gap-1 mt-3"
                >
                  🔗 Abrir em Nova Aba
                </a>
              </Card>
            </div>

            {/* Coluna da direita: Dados e Validação */}
            <div className="space-y-4">
              <Card className="p-4 bg-blue-50 border-blue-200 text-gray-900 rounded-xl">
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-blue-900 mb-1">Médico</Label>
                <p className="font-semibold text-base">{medicoNome}</p>
              </div>
              <div>
                <Label className="text-xs text-blue-900 mb-1">Número da Nota</Label>
                <p className="font-semibold text-base">{notaData.numero_nota || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-blue-900 mb-1">Competência</Label>
                <p className="font-semibold text-base">{notaData.mes_competencia}</p>
              </div>
              <div>
                <Label className="text-xs text-blue-900 mb-1">Valor Bruto</Label>
                <p className="font-semibold text-base">
                  R$ {notaData.valor ? parseFloat(notaData.valor).toFixed(2).replace('.', ',') : '0,00'}
                </p>
              </div>
              </div>
            </Card>

            <Card className="p-4 bg-amber-50 border-amber-300 border rounded-xl">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-amber-900 mb-1 text-base">Atenção: Verificação Obrigatória</h3>
                  <p className="text-xs text-amber-900">
                    Confira o valor líquido na nota fiscal. Você pode ajustar o valor se necessário antes de aprovar.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-amber-400">
                  <Label className="text-xs text-amber-900 mb-1 block">Valor Líquido (editável)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={valorLiquidoAjustado}
                    onChange={(e) => setValorLiquidoAjustado(e.target.value)}
                    className="text-xl font-bold text-amber-900 bg-white border-amber-400"
                    placeholder="Ex: 1234,56"
                  />
                  <p className="text-xs text-amber-700 mt-1">
                    💡 Ajuste se o valor na nota for diferente
                  </p>
                </div>
              </div>
            </Card>

            <div>
              <Label htmlFor="valorDigitado" className="block mb-2 font-semibold text-gray-900 text-base">
                Digite novamente o valor líquido para confirmar:
              </Label>
              <Input
                id="valorDigitado"
                type="text"
                inputMode="decimal"
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                placeholder="Ex: 1234,56"
                value={valorDigitado}
                onChange={(e) => {
                  setValorDigitado(e.target.value);
                  setValorError(false);
                }}
                className={`text-xl text-gray-900 bg-white border-2 rounded-lg px-4 py-3 w-full ${valorError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              <p className="text-xs text-gray-600 mt-1">
                ⚠️ Digite o mesmo valor acima para confirmar (use vírgula: 1234,56)
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full mt-6">
              <Button
                onClick={handleConfirmarAprovacao}
                disabled={!valorDigitado || loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-lg rounded-lg shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando aprovação...
                  </>
                ) : (
                  <>
                    ✓ Confirmar e Aprovar Nota
                  </>
                )}
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full px-6 py-4 rounded-lg text-lg"
              >
                Cancelar
              </Button>
            </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/30 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-800">Desenvolvido por</span>
            <img 
              src={conquistaLogo} 
              alt="Conquista Inovação" 
              className="h-5 opacity-60"
            />
          </div>
        </div>

        {/* Renderiza o popup de erro se necessário */}
        {showValorErrorPopup && <ValorErrorPopup />}
      </div>
    );
  }

  if (success) {
    // ... (mantém igual)
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center animate-in fade-in duration-500">
          <div className="mb-4 animate-bounce">
            <CheckCircle className="h-14 w-14 text-green-600 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">
            Nota Fiscal Aprovada!
          </h1>
          {medicoNome && (
            <div className="bg-green-50 rounded-lg p-2 mb-4 text-left border border-green-200">
              <p className="text-xs text-green-700 mb-1">Médico</p>
              <p className="font-semibold text-base text-gray-900">{medicoNome}</p>
            </div>
          )}
          <p className="text-gray-900 mb-4 text-base">
            O pagamento será processado em breve e o médico foi notificado via WhatsApp.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105 w-full"
          >
            Voltar ao Sistema
          </button>
          <div className="mt-6 pt-4 border-t border-border/30 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-800">Desenvolvido por</span>
            <img 
              src={conquistaLogo} 
              alt="Conquista Inovação" 
              className="h-5 opacity-60"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
