import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL é obrigatória');
    }

    console.log('Encurtando URL:', url);

    // Usar TinyURL API
    const tinyUrlResponse = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    
    if (!tinyUrlResponse.ok) {
      throw new Error('Erro ao encurtar URL com TinyURL');
    }

    const shortUrl = await tinyUrlResponse.text();
    console.log('URL encurtada:', shortUrl);

    return new Response(JSON.stringify({ 
      success: true, 
      shortUrl: shortUrl.trim(),
      originalUrl: url 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro ao encurtar URL:', error);
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
