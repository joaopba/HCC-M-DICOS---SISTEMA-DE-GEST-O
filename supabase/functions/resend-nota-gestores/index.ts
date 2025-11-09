import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatMesCompetencia(mesCompetencia: string): string {
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `${meses[parseInt(mes) - 1]} - ${ano}`;
}

serve(async (req) => {
  // Versão: 2025-10-29-17:30-COM-EMAIL
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nota_ids }: { nota_ids: string[] } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📧 Reenviando notificações para ${nota_ids.length} nota(s)`);

    const results = [];

    for (const notaId of nota_ids) {
      try {
        // Buscar dados da nota com informações do OCR
        const { data: nota, error: notaError } = await supabase
          .from('notas_medicos')
          .select(`
            id,
            nome_arquivo,
            arquivo_url,
            pagamento_id,
            numero_nota,
            valor_bruto,
            valor_ajustado,
            created_at,
            pagamentos (
              id,
              valor,
              mes_competencia,
              medico_id,
              medicos (
                nome,
                especialidade
              )
            )
          `)
          .eq('id', notaId)
          .single();

        if (notaError) throw notaError;
        if (!nota) throw new Error('Nota não encontrada');

        const pagamento = nota.pagamentos as any;
        const medico = pagamento.medicos;

        // Buscar gestores com WhatsApp válido (não nulo e não vazio)
        const { data: gestores } = await supabase
          .from('profiles')
          .select('numero_whatsapp, name, email')
          .eq('role', 'gestor')
          .eq('whatsapp_notifications_enabled', true)
          .not('numero_whatsapp', 'is', null)
          .neq('numero_whatsapp', '');

        if (!gestores || gestores.length === 0) {
          throw new Error('Nenhum gestor com WhatsApp encontrado');
        }

        console.log(`📱 Enviando para ${gestores.length} gestor(es)`);

        // Baixar PDF - usar caminho completo do storage
        const filePath = nota.arquivo_url;
        console.log(`📥 Baixando PDF: ${filePath}`);
        
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('notas')
          .download(filePath);

        if (pdfError) {
          console.error('❌ Erro ao baixar PDF:', pdfError);
          throw pdfError;
        }

        // Converter PDF para base64
        const arrayBuffer = await pdfData.arrayBuffer();
        const pdfBase64 = btoa(
          new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        console.log(`✅ PDF convertido: ${pdfBase64.length} chars`);

        // Preparar mensagem com todas as informações
        const mesFormatado = formatMesCompetencia(pagamento.mes_competencia);
        const valorFormatado = new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL' 
        }).format(pagamento.valor);

        // Criar tokens únicos para aprovar e rejeitar
        const tokenAprovar = btoa(`${nota.id}-${nota.created_at}-approve`).substring(0, 20);
        const tokenRejeitar = btoa(`${nota.id}-${nota.created_at}-reject`).substring(0, 20);
        const linkAprovar = `https://hcc.chatconquista.com/aprovar?i=${nota.id}&t=${tokenAprovar}`;
        const linkRejeitar = `https://hcc.chatconquista.com/rejeitar?i=${nota.id}&t=${tokenRejeitar}`;

        // Informações da nota do OCR
        const numeroNotaInfo = nota.numero_nota ? `\n🔢 *Número da Nota:* ${nota.numero_nota}` : '';
        
        // Usar valor_ajustado se disponível, senão valor_bruto
        const valorLiquido = nota.valor_ajustado || nota.valor_bruto;
        let valorLiquidoInfo = '';
        if (valorLiquido) {
          const valorLiquidoFormatado = new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(valorLiquido);
          valorLiquidoInfo = `\n💵 *Valor Líquido:* ${valorLiquidoFormatado}`;
        }

        const especialidadeInfo = medico.especialidade ? `\n🩺 *Especialidade:* ${medico.especialidade}` : '';
        const mensagem = `🏥 *Nova Nota Fiscal Recebida - HCC Hospital*\n\n` +
          `📋 *Médico:* ${medico.nome}${especialidadeInfo}\n` +
          `📅 *Competência:* ${mesFormatado}\n` +
          `💰 *Valor Bruto:* ${valorFormatado}${valorLiquidoInfo}${numeroNotaInfo}\n` +
          `📄 *Arquivo:* ${nota.nome_arquivo}\n\n` +
          `⚠️ *Aguardando aprovação*\n\n` +
          `✅ *Aprovar:*\n${linkAprovar}\n\n` +
          `❌ *Rejeitar:*\n${linkRejeitar}`;

        // Gerar URL assinada do PDF para o e-mail
        const { data: signedUrlData } = await supabase.storage
          .from('notas')
          .createSignedUrl(filePath, 604800); // 7 dias

        const pdfSignedUrl = signedUrlData?.signedUrl || '';
        console.log('📎 URL assinada do PDF gerada para e-mail');

        // Enviar notificações via WhatsApp e Email para cada gestor
        const gestorResults = [];
        for (const gestor of gestores) {
          try {
            console.log(`📤 Enviando WhatsApp para ${gestor.name} (${gestor.numero_whatsapp})`);
            
            // 1. Enviar via WhatsApp
            const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-notification-gestores', {
              body: {
                phoneNumber: gestor.numero_whatsapp,
                message: mensagem,
                pdf_base64: pdfBase64,
                pdf_filename: nota.nome_arquivo
              }
            });

            console.log('Resultado do envio WhatsApp:', { sendResult, sendError });

            if (sendError) {
              console.error(`❌ Erro ao enviar WhatsApp para ${gestor.name}:`, sendError);
              gestorResults.push({
                gestor: gestor.name,
                success: false,
                error: sendError?.message || String(sendError)
              });
            } else {
              console.log(`✅ WhatsApp enviado para ${gestor.name}`);
              gestorResults.push({
                gestor: gestor.name,
                success: true,
                data: sendResult
              });
            }
          } catch (gestorError: any) {
            console.error(`❌ Exceção ao enviar WhatsApp para gestor ${gestor.name}:`, gestorError);
            gestorResults.push({
              gestor: gestor.name,
              success: false,
              error: gestorError?.message || String(gestorError)
            });
          }
        }

        // 2. Enviar notificação por e-mail para todos os gestores (chamada única)
        try {
          console.log('📧 Enviando notificação por e-mail para gestores...');
          
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-email-notification', {
            body: {
              type: 'nova_nota',
              pagamentoId: pagamento.id,
              notaId: nota.id,
              fileName: nota.nome_arquivo,
              pdfPath: nota.arquivo_url,
              pdfSignedUrl: pdfSignedUrl,
              approvalUrl: linkAprovar,
              rejectionUrl: linkRejeitar,
              medicoNome: medico.nome,
              medicoEspecialidade: medico.especialidade,
              mes_competencia: pagamento.mes_competencia,
              valor: pagamento.valor
            }
          });

          if (emailError) {
            console.error('❌ Erro ao enviar e-mails:', emailError);
          } else {
            console.log('✅ E-mails enviados:', emailResult);
          }
        } catch (emailError: any) {
          console.error('❌ Exceção ao enviar e-mails:', emailError);
        }

        results.push({
          nota_id: notaId,
          medico: medico.nome,
          arquivo: nota.nome_arquivo,
          gestores: gestorResults
        });

      } catch (notaError: any) {
        console.error(`❌ Erro ao processar nota ${notaId}:`, notaError);
        results.push({
          nota_id: notaId,
          success: false,
          error: notaError?.message || String(notaError)
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Notificações reenviadas para ${nota_ids.length} nota(s)`,
      results
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
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
