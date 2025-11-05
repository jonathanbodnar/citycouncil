// send-mailgun edge function
// Assumptions:
// - MAILGUN_API_KEY and MAILGUN_DOMAIN are set via `supabase secrets set`
// - Function is invoked at /send-email
// - Uses Deno.serve per Supabase recommendations

import { withRateLimit, RateLimitPresets, getIdentifier } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Connection': 'keep-alive'
};

console.info('send-email function starting');

Deno.serve(withRateLimit(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 405
    });
  }

  try {
    const body = await req.json();
    const to = body?.to?.trim();
    const subject = body?.subject?.trim();
    const html = body?.html;
    const from = body?.from?.trim() || 'ShoutOut <noreply@mail.shoutout.us>';

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: to, subject, html'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY');
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mail.shoutout.us';

    if (!MAILGUN_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'MAILGUN_API_KEY not configured'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    const formData = new FormData();
    formData.append('from', from);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);

    const mailgunUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;
    const auth = btoa(`api:${MAILGUN_API_KEY}`);

    const mgRes = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`
      },
      body: formData
    });

    if (!mgRes.ok) {
      const errorText = await mgRes.text().catch(() => 'unknown error');
      console.error('Mailgun Error:', errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `Mailgun error: ${mgRes.status} ${mgRes.statusText}`,
        details: errorText
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 502
      });
    }

    let result;
    try {
      result = await mgRes.json();
    } catch {
      // Mailgun may return text; fallback gracefully
      result = {
        id: undefined
      };
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      messageId: result?.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error: any) {
    console.error('Unhandled Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unexpected error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}, RateLimitPresets.EMAIL, { keyPrefix: 'email' }));
