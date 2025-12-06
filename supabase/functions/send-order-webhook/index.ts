// Edge Function to send order data to Zapier webhook
// This runs server-side to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/25578725/ukls8cj/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OrderWebhookPayload {
  order_id: string;
  customer_name: string;
  customer_email: string;
  talent_name: string;
  amount: number;
  order_date: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: OrderWebhookPayload = await req.json();
    
    // Exclude test/admin emails from webhook
    const excludedEmails = [
      'helloshoutout@shoutout.us',
      'john@example.com',
      'admin@shoutout.us'
    ];
    
    if (excludedEmails.includes(payload.customer_email?.toLowerCase())) {
      console.log('⏭️ Skipping webhook for excluded email:', payload.customer_email);
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Excluded email address'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('📤 Sending order webhook to Zapier:', payload);

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
    console.error('❌ Error sending webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

