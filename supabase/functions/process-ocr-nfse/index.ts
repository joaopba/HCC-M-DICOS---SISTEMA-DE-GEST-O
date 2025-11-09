import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseBR(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // remove non-digits except comma and dot
  const cleaned = value.replace(/[^\d\,\.]/g, '');
  // assume format like 3.578,72 or 3578.72
  if (/\,\d{2}$/.test(cleaned)) {
    const step = cleaned.replace(/\./g, '').replace(',', '.');
    return parseFloat(step) || 0;
  }
  return parseFloat(cleaned.replace(',', '.')) || 0;
}

function calcularValorLiquido(result: any) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = result?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };

  const bruto = parseBR(get('totalValue','totalAmount','invoiceTotal','total','total_value','valorTotal','valor_total'));
  const inss = parseBR(get('INSSRetention','INSS','INSSvalue','inss'));
  const irrf = parseBR(get('IRRFvalue','IRRF','IR','irrf'));
  const csll = parseBR(get('CSLLvalue','csll'));
  const cofins = parseBR(get('COFINSvalue','cofins'));
  const pis = parseBR(get('PISvalue','pis'));
  const discount = parseBR(get('inconditionalDiscount','unconditionalDiscount','descontoIncondicional','desconto_incondicional','discount'));
  const outras = parseBR(get('totalDeductions','outrasDeducoes','outras_deducoes', 0 as any));
  const issFlag = get('ISSretain','issRetained','iss_retain','issRetido');
  const issRetido = (issFlag === 'Sim' || issFlag === true || issFlag === 'true' || issFlag === 'Yes') 
    ? parseBR(get('ISSvalue','issValue','iss')) 
    : 0;

  const net = bruto - (inss + irrf + csll + cofins + pis + issRetido + discount + outras);
  const liquido = Math.round((net + Number.EPSILON) * 100) / 100;

  const numeroNota = get('invoiceNumber','nfseNumber','nfNumber','number','numeroNota','numero_nota','invoice_no') ?? null;

  return {
    numeroNota,
    valorBruto: bruto,
    valorLiquido: liquido,
    issRetido: (issFlag === 'Sim' || issFlag === true || issFlag === 'true' || issFlag === 'Yes'),
    retencoes: { INSS: inss, IRRF: irrf, CSLL: csll, COFINS: cofins, PIS: pis, ISS: issRetido, descontoIncondicional: discount, outrasDeducoes: outras }
  };
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

    const { pdfData } = await req.json();

    if (!pdfData) {
      return new Response(JSON.stringify({ success: false, error: 'PDF não fornecido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar API key do banco
    const { data: config } = await supabase.from('configuracoes').select('ocr_nfse_api_key').single();
    
    if (!config?.ocr_nfse_api_key) {
      return new Response(JSON.stringify({ success: false, error: 'API key OCR não configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

    const formData = new FormData();
    // A API espera o campo "invoices" no multipart
    formData.append('invoices', pdfBlob, 'nota.pdf');

    // Timeout de 60s para APIs que demoram
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // Tentar primeiro o endpoint padrão; se falhar com 404/400, tentar o alternativo
    const primaryUrl = 'https://ocr.api.shelf.evtit.com/v1/external/nfse/map';
    const fallbackUrl = 'https://ocr.api.shelf.evtit.com/v1/external/v1/external/nfse/map';

    let ocrResponse = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-api-key': config.ocr_nfse_api_key
      },
      body: formData,
      signal: controller.signal
    });

    if (!ocrResponse.ok && (ocrResponse.status === 404 || ocrResponse.status === 400)) {
      // tenta fallback
      ocrResponse = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'x-api-key': config.ocr_nfse_api_key
        },
        body: formData,
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      return new Response(JSON.stringify({ success: false, error: `Erro API OCR: ${ocrResponse.status}`, details: errorText }), {
        status: ocrResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ocrResult = await ocrResponse.json();

    // Logs úteis para depuração de mapeamento
    try {
      console.log('🔎 OCR invoicesResult length:', Array.isArray(ocrResult?.invoicesResult) ? ocrResult.invoicesResult.length : 'N/A');
    } catch {}

    if (!ocrResult.invoicesResult || ocrResult.invoicesResult.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Nota não encontrada no PDF' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const invoice = ocrResult.invoicesResult[0];
    if (invoice.errors?.length > 0) {
      return new Response(JSON.stringify({ success: false, error: 'Erro ao processar nota', details: invoice.errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      console.log('🔑 Chaves do resultado da nota:', Object.keys(invoice.result || {}));
      console.log('📌 Candidatos de número:', {
        invoiceNumber: invoice.result?.invoiceNumber,
        nfseNumber: invoice.result?.nfseNumber,
        nfNumber: invoice.result?.nfNumber,
        number: invoice.result?.number,
      });
    } catch {}

    const dadosCalculados = calcularValorLiquido(invoice.result);

    return new Response(JSON.stringify({ 
      success: true,
      numeroNota: dadosCalculados.numeroNota,
      valorBruto: dadosCalculados.valorBruto,
      valorLiquido: dadosCalculados.valorLiquido,
      issRetido: dadosCalculados.issRetido,
      retencoes: dadosCalculados.retencoes
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
