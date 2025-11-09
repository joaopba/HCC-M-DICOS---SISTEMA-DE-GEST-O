/**
 * Helper para processar OCR de notas fiscais
 */

export async function processarOCRNota(
  pdfData: ArrayBuffer,
  apiKey: string,
  supabase: any
): Promise<{
  success: boolean;
  numeroNota?: string;
  valorBruto?: number;
  valorLiquido?: number;
  erro?: string;
}> {
  try {
    console.log('🔍 Iniciando processamento OCR da nota fiscal');
    
    // Converter ArrayBuffer para base64
    const uint8Array = new Uint8Array(pdfData);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binary);

    // Chamar a edge function de OCR (não precisa passar apiKey, ela busca do banco)
    const { data: ocrResult, error: ocrError } = await supabase.functions.invoke(
      'process-ocr-nfse',
      {
        body: {
          pdfData: base64Data
        }
      }
    );

    if (ocrError) {
      console.error('❌ Erro ao chamar função OCR:', ocrError);
      return {
        success: false,
        erro: 'Erro ao processar OCR da nota fiscal'
      };
    }

    if (!ocrResult.success) {
      console.error('❌ OCR falhou:', ocrResult.error);
      return {
        success: false,
        erro: ocrResult.error || 'Falha no processamento OCR'
      };
    }

    console.log('✅ OCR processado com sucesso:', {
      numeroNota: ocrResult.numeroNota,
      valorBruto: ocrResult.valorBruto,
      valorLiquido: ocrResult.valorLiquido
    });

    return {
      success: true,
      numeroNota: ocrResult.numeroNota,
      valorBruto: ocrResult.valorBruto,
      valorLiquido: ocrResult.valorLiquido
    };

  } catch (error: any) {
    console.error('❌ Erro no processamento OCR:', error);
    return {
      success: false,
      erro: error.message || 'Erro desconhecido no OCR'
    };
  }
}

export async function enviarMensagemRejeicaoValor(
  supabase: any,
  numeroWhatsApp: string,
  medicoNome: string,
  valorEsperado: number,
  valorRecebido: number,
  competencia: string
): Promise<void> {
  try {
    console.log('📱 Enviando mensagem de rejeição por valor incorreto');

    const { data: config } = await supabase
      .from('configuracoes')
      .select('api_url, auth_token')
      .single();

    if (!config) {
      throw new Error('Configurações não encontradas');
    }

    const mensagem = `🏥 *HCC Hospital - Nota Fiscal Rejeitada* ⚠️\n\n` +
      `Olá ${medicoNome}!\n\n` +
      `Sua nota fiscal referente a *${competencia}* foi rejeitada automaticamente pelo sistema.\n\n` +
      `❌ *Motivo:* Valor bruto incorreto\n\n` +
      `📊 *Detalhes:*\n` +
      `• Valor esperado: R$ ${valorEsperado.toFixed(2).replace('.', ',')}\n` +
      `• Valor na nota: R$ ${valorRecebido.toFixed(2).replace('.', ',')}\n` +
      `• Diferença: R$ ${Math.abs(valorEsperado - valorRecebido).toFixed(2).replace('.', ',')}\n\n` +
      `🔍 *Próximos passos:*\n` +
      `1. Verifique se anexou a nota correta\n` +
      `2. Confirme se o valor da nota corresponde ao pagamento\n` +
      `3. Envie a nota correta pelo portal\n\n` +
      `🔗 Acesse: https://hcc.chatconquista.com/dashboard-medicos\n\n` +
      `❓ Dúvidas? Entre em contato com o financeiro.`;

    const form = new FormData();
    form.append('number', numeroWhatsApp);
    form.append('body', mensagem);
    form.append('externalKey', `rejeicao_valor_${Date.now()}`);
    form.append('isClosed', 'false');

    await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.auth_token}`
      },
      body: form
    });

    console.log('✅ Mensagem de rejeição enviada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem de rejeição:', error);
  }
}

export async function enviarMensagemApenasPortal(
  supabase: any,
  numeroWhatsApp: string,
  medicoNome: string
): Promise<void> {
  try {
    console.log('📱 Enviando mensagem direcionando ao portal');

    const { data: config } = await supabase
      .from('configuracoes')
      .select('api_url, auth_token')
      .single();

    if (!config) {
      throw new Error('Configurações não encontradas');
    }

    const mensagem = `🏥 *HCC Hospital - Envio de Notas Fiscais* 📋\n\n` +
      `Olá ${medicoNome}!\n\n` +
      `⚠️ *Atenção:* O sistema está configurado para aceitar notas fiscais *apenas pelo portal web*.\n\n` +
      `🔗 *Acesse o portal:*\n` +
      `https://hcc.chatconquista.com/dashboard-medicos\n\n` +
      `📝 *Como anexar sua nota:*\n` +
      `1. Digite seu CPF\n` +
      `2. Localize o pagamento pendente\n` +
      `3. Clique em "Anexar Nota Fiscal"\n` +
      `4. Faça upload do arquivo PDF\n\n` +
      `✅ Após o envio, você receberá confirmação e será avisado sobre a análise.\n\n` +
      `❓ Dúvidas? Entre em contato com o financeiro.`;

    const form = new FormData();
    form.append('number', numeroWhatsApp);
    form.append('body', mensagem);
    form.append('externalKey', `portal_only_${Date.now()}`);
    form.append('isClosed', 'false');

    await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.auth_token}`
      },
      body: form
    });

    console.log('✅ Mensagem de direcionamento ao portal enviada');
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem de direcionamento:', error);
  }
}