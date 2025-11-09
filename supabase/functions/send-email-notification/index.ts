import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailNotificationRequest {
  type: 'nova_nota' | 'pagamento_realizado';
  pagamentoId: string;
  notaId?: string;
  fileName?: string;
  valorLiquido?: number;
  emailDestino?: string;
  pdfPath?: string;
  pdfSignedUrl?: string;
  approvalUrl?: string;
  rejectionUrl?: string;
  medicoNome?: string;
  medicoEspecialidade?: string;
  mes_competencia?: string;
  valor?: number;
}

// Função para formatar mês de competência
function formatMesCompetencia(mesCompetencia: string): string {
  if (!mesCompetencia || !mesCompetencia.includes('-')) return mesCompetencia;
  const [ano, mes] = mesCompetencia.split('-');
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  return `${meses[mesIndex]} - ${ano}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: EmailNotificationRequest = await req.json();
    console.log('Email notification request:', JSON.stringify(request, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Configurar cliente SMTP dinamicamente
    const smtpClient = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com",
        port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") || "suporte@chatconquista.com",
          password: Deno.env.get("SMTP_PASSWORD") || "",
        },
      },
    });

    // Buscar dados do pagamento se não fornecidos
    let pagamento: any;
    if (!request.medicoNome || !request.mes_competencia) {
      const { data } = await supabase
        .from('pagamentos')
        .select(`
          id,
          valor,
          mes_competencia,
          valor_liquido,
          medico_id,
          medicos (
            nome,
            especialidade
          )
        `)
        .eq('id', request.pagamentoId)
        .single();
      
      pagamento = data;
      if (!pagamento) {
        throw new Error('Pagamento não encontrado');
      }
    }

    // Buscar configurações para verificar se emails estão habilitados
    const { data: config } = await supabase
      .from('configuracoes')
      .select('email_notificacoes')
      .single();

    if (!config?.email_notificacoes) {
      console.log('Notificações por email estão desabilitadas');
      return new Response(JSON.stringify({
        success: true,
        message: 'Notificações por email estão desabilitadas'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

    // Buscar destinatários (gestores com email válido)
    const { data: usuarios, error: usuariosError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'gestor')
      .not('email', 'is', null)
      .neq('email', '');

    if (usuariosError) {
      console.error('Erro ao buscar usuários:', usuariosError);
      throw usuariosError;
    }

    const recipients = usuarios || [];
    console.log(`Encontrados ${recipients.length} destinatário(s) gestor(es)`);

    if (recipients.length === 0) {
      console.log('Nenhum destinatário encontrado para notificação por email');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum destinatário encontrado'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

    // Dados para o email
    const medicoNome = request.medicoNome || pagamento?.medicos?.nome;
    const medicoEspecialidade = request.medicoEspecialidade || pagamento?.medicos?.especialidade;
    const mesCompetencia = request.mes_competencia || pagamento?.mes_competencia;
    const valor = request.valor || pagamento?.valor;

    // Download do PDF se fornecido
    let pdfBuffer: Uint8Array | undefined;
    if (request.pdfPath) {
      try {
        const { data: pdfData } = await supabase.storage
          .from('notas')
          .download(request.pdfPath.replace('notas/', ''));
        
        if (pdfData) {
          pdfBuffer = new Uint8Array(await pdfData.arrayBuffer());
          console.log(`PDF baixado com sucesso: ${pdfBuffer.length} bytes`);
        }
      } catch (error: any) {
        console.error('Erro ao baixar PDF:', error.message);
      }
    }

    // HTML do email
    let subject = "";
    let html = "";

    if (request.type === 'nova_nota') {
      const mesFormatado = formatMesCompetencia(mesCompetencia);
      const valorFormatado = new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(valor);
      
      subject = `Nova Nota - ${medicoNome} - ${mesFormatado} - HCC Hospital`;
      
      html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nova Nota Fiscal</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
<tr>
<td style="background-color:#667eea;background-image:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0">
<h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600">HCC Hospital</h1>
<p style="margin:10px 0 0 0;color:#ffffff;font-size:18px">Nova Nota Fiscal Recebida</p>
</td>
</tr>
<tr>
<td style="padding:40px 30px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:30px">
<tr><td>
<h2 style="margin:0 0 20px 0;color:#333;font-size:20px;font-weight:600;border-left:4px solid #667eea;padding-left:12px">Detalhes da Nota</h2>
<table width="100%" cellpadding="8" cellspacing="0" border="0">
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Medico:</strong></td>
<td style="color:#333;font-size:14px;text-align:right">${medicoNome}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Especialidade:</strong></td>
<td style="color:#333;font-size:14px;text-align:right">${medicoEspecialidade || 'Nao informado'}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Competencia:</strong></td>
<td style="color:#333;font-size:14px;text-align:right">${mesFormatado}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Valor:</strong></td>
<td style="color:#10b981;font-size:16px;font-weight:600;text-align:right">${valorFormatado}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Arquivo:</strong></td>
<td style="color:#333;font-size:14px;text-align:right">${request.fileName || 'nota.pdf'}</td>
</tr>
</table>
</td></tr>
</table>
<p style="text-align:center;color:#333;font-size:16px;margin:0 0 30px 0;line-height:1.5">A nota fiscal foi recebida e esta aguardando sua analise.<br>Clique nos botoes abaixo para aprovar ou rejeitar:</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:10px">
<a href="${request.pdfSignedUrl}" style="display:inline-block;background-color:#667eea;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px">Baixar PDF da Nota</a>
</td>
</tr>
<tr>
<td align="center" style="padding:10px">
<a href="${request.approvalUrl}" style="display:inline-block;background-color:#10b981;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px">Aprovar Nota</a>
</td>
</tr>
<tr>
<td align="center" style="padding:10px">
<a href="${request.rejectionUrl}" style="display:inline-block;background-color:#ef4444;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px">Rejeitar Nota</a>
</td>
</tr>
<tr>
<td align="center" style="padding:20px 10px 10px 10px">
<a href="https://hcc.chatconquista.com" style="display:inline-block;background-color:#667eea;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px">Acessar Sistema Completo</a>
</td>
</tr>
</table>
<p style="text-align:center;color:#666;font-size:12px;margin:20px 0 0 0">O PDF tambem esta anexado neste email. Link valido por 7 dias.</p>
</td>
</tr>
<tr>
<td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px">
<p style="margin:0;color:#666;font-size:12px;line-height:1.5">Sistema de Gestao de Pagamentos - HCC Hospital<br>Este e um email automatico, nao responda.</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    } else if (request.type === 'pagamento_realizado') {
      const mesFormatado = formatMesCompetencia(mesCompetencia);
      const valorFormatado = new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(request.valorLiquido || 0);
      
      subject = `Pagamento Realizado - ${medicoNome} - ${mesFormatado} - HCC Hospital`;
      
      html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagamento Realizado</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
<tr>
<td style="background-color:#10b981;background-image:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0">
<h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600">HCC Hospital</h1>
<p style="margin:10px 0 0 0;color:#ffffff;font-size:18px">Pagamento Realizado com Sucesso!</p>
</td>
</tr>
<tr>
<td style="padding:40px 30px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border-radius:8px;padding:20px;margin-bottom:30px">
<tr><td>
<h2 style="margin:0 0 20px 0;color:#333;font-size:20px;font-weight:600;border-left:4px solid #10b981;padding-left:12px">Detalhes do Pagamento</h2>
<table width="100%" cellpadding="8" cellspacing="0" border="0">
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Medico:</strong></td>
<td style="color:#333;font-size:14px;text-align:right">${medicoNome}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Competencia:</strong></td>
<td style="color:#333;font-size:14px;text-align:right">${mesFormatado}</td>
</tr>
<tr>
<td style="color:#666;font-size:14px"><strong style="color:#333">Valor Liquido:</strong></td>
<td style="color:#10b981;font-size:20px;font-weight:700;text-align:right">${valorFormatado}</td>
</tr>
${request.fileName ? `<tr><td style="color:#666;font-size:14px"><strong style="color:#333">Comprovante:</strong></td><td style="color:#333;font-size:14px;text-align:right">${request.fileName}</td></tr>` : ''}
</table>
</td></tr>
</table>
<p style="text-align:center;color:#333;font-size:16px;margin:0 0 30px 0;line-height:1.5">O pagamento foi processado e o comprovante esta disponivel no sistema.<br>O comprovante tambem esta anexado neste email.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:10px">
<a href="https://hcc.chatconquista.com" style="display:inline-block;background-color:#10b981;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px">Acessar Sistema</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px">
<p style="margin:0;color:#666;font-size:12px;line-height:1.5">Sistema de Gestao de Pagamentos - HCC Hospital<br>Este e um email automatico, nao responda.</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
    }

    // Enviar emails
    let emailsSent = 0;
    const errors: any[] = [];

    for (const recipient of recipients) {
      try {
        console.log(`Enviando email para: ${recipient.email}`);
        
        const emailData: any = {
          from: "HCC Hospital <suporte@chatconquista.com>",
          to: recipient.email,
          subject: subject,
          html: html,
        };

        // Anexar PDF se disponível
        if (pdfBuffer) {
          emailData.attachments = [{
            filename: request.fileName || 'documento.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf'
          }];
        }
        
        await smtpClient.send(emailData);
        
        console.log(`Email enviado com sucesso para ${recipient.email}`);
        emailsSent++;
      } catch (emailError: any) {
        console.error(`Erro ao enviar email para ${recipient.email}:`, emailError.message);
        errors.push({
          email: recipient.email,
          error: emailError.message
        });
      }
    }

    console.log(`Total de emails enviados: ${emailsSent}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Emails enviados: ${emailsSent}`,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro ao processar notificação:', error);
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
