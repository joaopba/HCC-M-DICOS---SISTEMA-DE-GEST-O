import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API Meta WhatsApp oficial
const META_PHONE_ID = '468233466375447';
const META_TOKEN = 'EAAXSNrvzpbABP6IYXowGhZBzQbatbThlDDsidvOs77h6BAmhaJLZAos2SWzqZARSl57YiBvZCYJFCjJWSDbP5XuZAWT4ORdREQ2yBdaiYyk7si0boZB5LkoDzcCw6ZCiBy6tPMZBlrVtCcLZBQivZBc7xlIrDnQk1v8zgp3vK0coPZAGXAp0DSrEf9fVmjlZCXUk9gZDZD';
const META_API_URL = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`;

function formatMesCompetencia(mesCompetencia: string): string {
  if (!mesCompetencia || !mesCompetencia.includes('-')) return mesCompetencia;
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  const mesNome = meses[mesIndex] || mes;
  return `${mesNome} - ${ano}`;
}

interface WhatsAppRequest {
  type: 'nota' | 'pagamento' | 'nota_aprovada' | 'nota_rejeitada' | 'nota_recebida' | 'nova_mensagem_chat' | 'resposta_financeiro' | 'nota_aprovacao' | 'valor_ajustado' | 'nota_pendente';
  numero?: string;
  nome?: string;
  valor?: string | number;
  competencia?: string;
  dataPagamento?: string;
  pagamentoId?: string;
  medico?: {
    nome: string;
    numero_whatsapp: string;
  };
  motivo?: string;
  linkPortal?: string;
  numero_destino?: string;
  medico_nome?: string;
  mensagem_preview?: string;
  mensagem?: string;
  medico_id?: string;
  nota_id?: string;
  pdf_base64?: string;
  pdf_filename?: string;
  link_aprovar?: string;
  link_rejeitar?: string;
  financeiro_numero?: string;
  valorBruto?: number;
  valorLiquido?: number;
  valorOriginal?: string;
  valorNovo?: string;
  numeroNota?: string;
}

async function checkLast24Hours(supabase: any, medicoId: string): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('medico_id', medicoId)
    .eq('sender_type', 'medico')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1);
  
  return recentMessages && recentMessages.length > 0;
}

async function enviarMetaAPI(payload: any): Promise<any> {
  console.log('[Meta API] Enviando:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(META_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${META_TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Meta API] Erro ${response.status}:`, errorText);
    throw new Error(`Meta API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[Meta API] Sucesso:', result);
  return result;
}

async function enviarMensagemTexto(numero: string, mensagem: string): Promise<any> {
  return enviarMetaAPI({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: numero,
    type: "text",
    text: {
      preview_url: true,
      body: mensagem
    }
  });
}

async function enviarTemplate(numero: string, templateName: string, parameters: any[]): Promise<any> {
  return enviarMetaAPI({
    messaging_product: "whatsapp",
    to: numero,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: parameters
        }
      ]
    }
  });
}

async function uploadMediaMeta(pdfBase64: string, filename: string): Promise<string> {
  // Converter base64 para blob
  const binaryString = atob(pdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  
  // Upload para Meta
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('messaging_product', 'whatsapp');
  formData.append('type', 'application/pdf');

  const uploadUrl = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/media`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_TOKEN}`
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Erro ao fazer upload do PDF: ${error}`);
  }

  const uploadResult = await uploadResponse.json();
  console.log('[Meta API] PDF uploaded:', uploadResult);
  return uploadResult.id; // Retorna o media ID
}

async function enviarDocumento(numero: string, mediaId: string, caption?: string): Promise<any> {
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: numero,
    type: "document",
    document: {
      id: mediaId
    }
  };

  if (caption) {
    payload.document.caption = caption;
  }

  return enviarMetaAPI(payload);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: WhatsAppRequest = await req.json();
    const { type, numero, nome, valor, competencia, dataPagamento, pagamentoId, medico, motivo, linkPortal, numero_destino, medico_nome, mensagem_preview, mensagem, medico_id, nota_id, pdf_base64, pdf_filename, link_aprovar, link_rejeitar, financeiro_numero, valorBruto, valorLiquido, valorOriginal, valorNovo, numeroNota } = requestData;

    async function processarEnvio() {
      try {
        console.log(`[Processamento] Tipo: ${type}`);
        
        let phoneNumber = numero;
        if (medico?.numero_whatsapp) {
          phoneNumber = medico.numero_whatsapp;
        }

        // Idempotência
        if (pagamentoId) {
          const since = new Date(Date.now() - 20000).toISOString();
          const { data: recent } = await supabase
            .from('message_logs')
            .select('id')
            .eq('pagamento_id', pagamentoId)
            .eq('tipo', `whatsapp_${type}`)
            .gte('created_at', since)
            .limit(1);

          if (recent && recent.length > 0) {
            console.log('[Idempotência] Mensagem já enviada recentemente');
            return;
          }
        }

        let resultadoEnvio: any;

        switch (type) {
          case 'nota': {
            const within24Hours = medico_id ? await checkLast24Hours(supabase, medico_id) : false;
            
            if (within24Hours) {
              // Mensagem livre
              const mensagemNota = `🏥 *Solicitação de Nota Fiscal - HCC Hospital*\n\nOlá, ${nome}!\n\nPara darmos sequência ao seu pagamento, precisamos da sua nota fiscal.\n\n💰 Valor: ${valor}\n📅 Competência: ${formatMesCompetencia(competencia || '')}\n\nClique no botão abaixo para receber as instruções de como enviar.`;
              resultadoEnvio = await enviarMensagemTexto(phoneNumber!, mensagemNota);
            } else {
              // Template Facebook
              resultadoEnvio = await enviarTemplate(phoneNumber!, 'nota_hcc', [
                { type: "text", text: nome },
                { type: "text", text: String(valor) },
                { type: "text", text: formatMesCompetencia(competencia || '') }
              ]);
            }
            break;
          }

          case 'nota_pendente': {
            const valorFormatado = typeof valor === 'number' 
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
              : valor;
            
            resultadoEnvio = await enviarTemplate(phoneNumber!, 'nota_pendente', [
              { type: "text", text: medico?.nome || nome || '' },
              { type: "text", text: valorFormatado || '' },
              { type: "text", text: formatMesCompetencia(competencia || '') }
            ]);
            break;
          }

          case 'pagamento': {
            const within24Hours = medico_id ? await checkLast24Hours(supabase, medico_id) : false;
            
            if (within24Hours) {
              const mensagemPag = `💰 *Pagamento Efetuado*\n\nOlá ${nome}!\n\nSeu pagamento foi efetuado com sucesso em ${dataPagamento}.\n\nObrigado por sua colaboração!`;
              resultadoEnvio = await enviarMensagemTexto(phoneNumber!, mensagemPag);
            } else {
              resultadoEnvio = await enviarTemplate(phoneNumber!, 'pagamento', [
                { type: "text", text: nome || '' },
                { type: "text", text: dataPagamento || new Date().toLocaleDateString('pt-BR') }
              ]);
            }
            break;
          }

          case 'nota_recebida': {
            const mensagemRecebida = `✅ *Nota Fiscal Recebida*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi recebida com sucesso.\n\n📋 Status: Em análise\n⏱️ Prazo: Até 24h úteis\n\nVocê será notificado assim que a análise for concluída.\n\nObrigado!`;
            resultadoEnvio = await enviarMensagemTexto(phoneNumber!, mensagemRecebida);
            break;
          }

          case 'nota_aprovacao': {
            // Upload do PDF e envio com caption
            if (pdf_base64 && pdf_filename) {
              const mediaId = await uploadMediaMeta(pdf_base64, pdf_filename);
              const valorBrutoFormatado = valorBruto ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorBruto) : valor;
              const valorLiquidoFormatado = valorLiquido ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorLiquido) : 'Não informado';
              
              const caption = `📄 *Nova Nota Fiscal para Aprovação*\n\n👨‍⚕️ Médico: ${nome}${numeroNota ? `\n🧾 Nº Nota: ${numeroNota}` : ''}\n💰 Valor Bruto: ${valorBrutoFormatado}\n💵 Valor Líquido: ${valorLiquidoFormatado}\n   ⚠️ *Valor informado pelo médico - VERIFICAR*\n📅 Competência: ${formatMesCompetencia(competencia || '')}\n\n⚡ *IMPORTANTE:* Confira se o valor líquido está correto antes de aprovar!\n\n✅ Aprovar:\n${link_aprovar}\n\n❌ Rejeitar:\n${link_rejeitar}`;
              
              resultadoEnvio = await enviarDocumento(financeiro_numero!, mediaId, caption);
            }
            break;
          }

          case 'nota_aprovada': {
            const mensagemAprovada = `✅ *Nota Fiscal Aprovada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi aprovada.\n\nO pagamento está sendo processado e você será notificado quando estiver disponível.\n\nObrigado!`;
            resultadoEnvio = await enviarMensagemTexto(phoneNumber!, mensagemAprovada);
            break;
          }

          case 'nota_rejeitada': {
            const mensagemRejeitada = `❌ *Nota Fiscal Rejeitada*\n\nOlá ${medico?.nome}!\n\nSua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi rejeitada.\n\n*Motivo:* ${motivo}\n\nPor favor, corrija o documento e envie novamente através do nosso portal:\n\n🔗 ${linkPortal || 'https://hcc.chatconquista.com/dashboard-medicos'}\n\nPrecisa de ajuda? Entre em contato conosco.`;
            resultadoEnvio = await enviarMensagemTexto(phoneNumber!, mensagemRejeitada);
            break;
          }

          case 'nova_mensagem_chat': {
            const mensagemChat = `💬 *Nova Mensagem no Chat*\n\n*De:* ${medico_nome}\n\n*Mensagem:*\n"${mensagem || mensagem_preview}"\n\n🔗 Responder agora:\nhttps://hcc.chatconquista.com/chat?medico=${medico_id || ''}&responder=true\n\nOu acesse o sistema para visualizar o histórico completo.`;
            resultadoEnvio = await enviarMensagemTexto(numero_destino!, mensagemChat);
            break;
          }

          case 'resposta_financeiro': {
            const mensagemResposta = `💬 *Nova Resposta do Financeiro*\n\n*Mensagem:*\n"${mensagem || mensagem_preview}"\n\n🔗 Ver conversa:\nhttps://hcc.chatconquista.com/dashboard-medicos\n\nAcesse seu painel para continuar a conversa.`;
            resultadoEnvio = await enviarMensagemTexto(numero_destino!, mensagemResposta);
            break;
          }

          case 'valor_ajustado': {
            const mensagemAjuste = `⚠️ *Valor da Nota Ajustado*\n\nOlá ${medico?.nome}!\n\nO valor líquido da sua nota fiscal referente ao período ${formatMesCompetencia(competencia || '')} foi ajustado.\n\n💰 Valor Original: ${valorOriginal}\n💵 Novo Valor: ${valorNovo}\n\n📝 *Motivo do Ajuste:*\n${motivo}\n\nSe tiver dúvidas, entre em contato conosco.`;
            resultadoEnvio = await enviarMensagemTexto(phoneNumber!, mensagemAjuste);
            break;
          }

          default:
            throw new Error('Tipo de mensagem inválido');
        }

        // Enviar também para contador, se aplicável
        if (['nota', 'nota_pendente', 'nota_aprovada', 'nota_rejeitada', 'nota_recebida', 'valor_ajustado'].includes(type) && medico_id) {
          try {
            const { data: medicoCompleto } = await supabase
              .from('medicos')
              .select('numero_whatsapp_contador')
              .eq('id', medico_id)
              .maybeSingle();

            if (medicoCompleto?.numero_whatsapp_contador) {
              console.log('[Contador] Enviando cópia para:', medicoCompleto.numero_whatsapp_contador);
              
              // Replicar o mesmo envio para o contador
              // (simplificado - envia apenas mensagens de texto)
              if (type === 'nota_pendente') {
                const valorFormatado = typeof valor === 'number' 
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
                  : valor;
                await enviarTemplate(medicoCompleto.numero_whatsapp_contador, 'nota_pendente', [
                  { type: "text", text: medico?.nome || nome || '' },
                  { type: "text", text: valorFormatado || '' },
                  { type: "text", text: formatMesCompetencia(competencia || '') }
                ]);
              }
            }
          } catch (error) {
            console.error('[Contador] Erro ao enviar (não crítico):', error);
          }
        }

        // Log
        if (pagamentoId) {
          try {
            await supabase
              .from('message_logs')
              .insert({
                pagamento_id: pagamentoId,
                tipo: `whatsapp_${type}`,
                success: true,
                response: resultadoEnvio
              });
          } catch (logError) {
            console.warn('[Log] Erro:', logError);
          }
        }

        console.log('[Processamento] Concluído com sucesso');
      } catch (error: any) {
        console.error('[Processamento] Erro:', error);
        throw error;
      }
    }

    // Background processing
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(processarEnvio());
    } else {
      processarEnvio();
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Mensagem ${type} está sendo processada`,
      queued: true
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});
