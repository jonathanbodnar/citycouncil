// Edge Function to send user registration data to Zapier webhook
// This runs server-side to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/25578725/ufgyrec/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UserWebhookPayload {
  name: string;
  email: string;
  registered_at: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: UserWebhookPayload = await req.json();
    
    console.log('📤 Sending user registration webhook to Zapier:', payload);

    // Send to Zapier
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    
    console.log('✅ Zapier response:', {
      status: response.status,
      ok: response.ok,
      body: responseText
    });

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      zapier_response: responseText
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Error sending user webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

