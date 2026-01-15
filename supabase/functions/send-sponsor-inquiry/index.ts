// Edge function to send sponsor inquiry emails to talent
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const {
      talent_id,
      talent_name,
      talent_username,
      service_title,
      company_name,
      contact_name,
      email,
      phone,
      budget,
      message,
    } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get talent email
    const { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('user_id, users:user_id(email, full_name)')
      .eq('id', talent_id)
      .single();

    if (talentError || !talent) {
      console.error('Error fetching talent:', talentError);
      return new Response(JSON.stringify({ error: 'Talent not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const talentEmail = talent.users?.email;
    if (!talentEmail) {
      return new Response(JSON.stringify({ error: 'Talent email not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Send email via Mailgun
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')!;
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN')!;

    const formData = new FormData();
    formData.append('from', `ShoutOut <noreply@${MAILGUN_DOMAIN}>`);
    formData.append('to', talentEmail);
    formData.append('subject', `🎯 New Sponsorship Inquiry from ${company_name}`);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #16a34a 0%, #059669 100%); padding: 40px 20px; text-align: center; border-radius: 16px 16px 0 0;">
            <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">
              💼 New Sponsorship Inquiry
            </h1>
            <p style="color: #dcfce7; margin: 10px 0 0 0; font-size: 16px;">
              Someone wants to sponsor you!
            </p>
          </div>
          
          <!-- Content -->
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${talent_name},
            </p>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              You have a new sponsorship inquiry for your <strong>"${service_title}"</strong> offering on your bio page.
            </p>
            
            <!-- Inquiry Details -->
            <div style="background: #f4f4f5; border-left: 4px solid #16a34a; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
              <h2 style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
                Sponsor Details
              </h2>
              
              <div style="margin-bottom: 12px;">
                <strong style="color: #52525b;">Company:</strong>
                <span style="color: #3f3f46; margin-left: 8px;">${company_name}</span>
              </div>
              
              <div style="margin-bottom: 12px;">
                <strong style="color: #52525b;">Contact:</strong>
                <span style="color: #3f3f46; margin-left: 8px;">${contact_name}</span>
              </div>
              
              <div style="margin-bottom: 12px;">
                <strong style="color: #52525b;">Email:</strong>
                <a href="mailto:${email}" style="color: #16a34a; margin-left: 8px; text-decoration: none;">
                  ${email}
                </a>
              </div>
              
              ${phone ? `
              <div style="margin-bottom: 12px;">
                <strong style="color: #52525b;">Phone:</strong>
                <a href="tel:${phone}" style="color: #16a34a; margin-left: 8px; text-decoration: none;">
                  ${phone}
                </a>
              </div>
              ` : ''}
              
              ${budget ? `
              <div style="margin-bottom: 12px;">
                <strong style="color: #52525b;">Budget Range:</strong>
                <span style="color: #3f3f46; margin-left: 8px;">${budget}</span>
              </div>
              ` : ''}
              
              <div style="margin-top: 16px;">
                <strong style="color: #52525b; display: block; margin-bottom: 8px;">Message:</strong>
                <div style="color: #3f3f46; line-height: 1.6; white-space: pre-wrap;">${message}</div>
              </div>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #e4e4e7;">
              Reply directly to this email to reach ${contact_name} at ${company_name}.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 20px; color: #71717a; font-size: 12px;">
            <p style="margin: 0 0 8px 0;">
              This inquiry was sent from your bio page at <a href="https://shoutout.fans/${talent_username}" style="color: #16a34a; text-decoration: none;">shoutout.fans/${talent_username}</a>
            </p>
            <p style="margin: 0; color: #a1a1aa;">
              © ${new Date().getFullYear()} ShoutOut. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    formData.append('html', htmlContent);
    // Set reply-to so talent can reply directly to sponsor
    formData.append('h:Reply-To', email);

    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mailgun error:', errorText);
      throw new Error(`Mailgun error: ${response.status}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-sponsor-inquiry:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
