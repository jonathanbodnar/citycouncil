// Edge function to track bio page views
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createHash } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { talent_id, referrer, utm_source, utm_medium, utm_campaign } = await req.json();

    if (!talent_id) {
      return new Response(JSON.stringify({ error: 'talent_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get viewer info from headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const country = req.headers.get('cf-ipcountry') || null; // Cloudflare header
    const city = req.headers.get('cf-ipcity') || null; // Cloudflare header

    // Hash IP for privacy (don't store raw IPs)
    const hashedIp = createHash('sha256').update(clientIp + 'salt').digest('hex').substring(0, 16);

    // Generate session ID (based on IP + User Agent, valid for 30 minutes)
    const sessionSeed = `${hashedIp}-${userAgent}`;
    const sessionId = createHash('sha256').update(sessionSeed).digest('hex').substring(0, 16);

    // Insert page view
    const { error } = await supabase
      .from('bio_page_views')
      .insert({
        talent_id,
        viewer_ip: hashedIp,
        viewer_country: country,
        viewer_city: city,
        user_agent: userAgent.substring(0, 500), // Limit length
        referrer: referrer?.substring(0, 500),
        utm_source: utm_source?.substring(0, 100),
        utm_medium: utm_medium?.substring(0, 100),
        utm_campaign: utm_campaign?.substring(0, 100),
        session_id: sessionId,
      });

    if (error) {
      console.error('Error tracking view:', error);
      // Don't fail the request if tracking fails
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in track-bio-view:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
