import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando teste de email SMTP');

    // Configurar cliente SMTP
    const client = new SMTPClient({
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

    console.log('Cliente SMTP configurado');

    const testEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 HCC Hospital</h1>
            <h2>✅ Teste de Email SMTP</h2>
          </div>
          <div class="content">
            <div class="success">
              <h3>🎉 Configuração SMTP Funcionando!</h3>
              <p>Se você está lendo este email, significa que o servidor SMTP da Hostinger está configurado corretamente.</p>
            </div>
            
            <h3>📋 Detalhes da Configuração:</h3>
            <ul>
              <li><strong>Servidor:</strong> smtp.hostinger.com</li>
              <li><strong>Porta:</strong> 465 (SSL)</li>
              <li><strong>Email:</strong> suporte@chatconquista.com</li>
              <li><strong>Data do teste:</strong> ${new Date().toLocaleString('pt-BR')}</li>
            </ul>
            
            <p>✨ O sistema está pronto para enviar notificações automáticas de:</p>
            <ul>
              <li>📋 Novas notas fiscais recebidas</li>
              <li>💰 Pagamentos realizados</li>
              <li>🔔 Outros eventos do sistema</li>
            </ul>
          </div>
          <div class="footer">
            <p>Sistema de Gestão de Pagamentos - HCC Hospital</p>
            <p>Este é um email de teste automático.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email de teste
    await client.send({
      from: "HCC Hospital - Teste <suporte@chatconquista.com>",
      to: "suporte@chatconquista.com", // Enviar para o próprio email como teste
      subject: "🧪 Teste de Configuração SMTP - HCC Hospital",
      content: "Teste de email SMTP do sistema HCC Hospital",
      html: testEmail,
    });

    console.log('Email de teste enviado com sucesso');

    return new Response(JSON.stringify({
      success: true,
      message: 'Email de teste enviado com sucesso via SMTP',
      timestamp: new Date().toISOString(),
      smtpConfig: {
        host: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com",
        port: Deno.env.get("SMTP_PORT") || "465",
        user: Deno.env.get("SMTP_USER") || "suporte@chatconquista.com"
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      details: 'Verifique as configurações SMTP nos secrets'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});