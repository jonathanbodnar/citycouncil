import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY');
const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { talentId, talentName, email } = await req.json();

    if (!talentId || !talentName || !email) {
      throw new Error('Missing required fields: talentId, talentName, or email');
    }

    console.log('Sending onboarding completion notification for:', talentName);

    // Send email notification via Mailgun
    const formData = new FormData();
    formData.append('from', `ShoutOut Notifications <notifications@${MAILGUN_DOMAIN}>`);
    formData.append('to', 'jb@shoutout.us, darrin@shoutout.us');
    formData.append('subject', `🎉 New Talent Onboarding Complete: ${talentName}`);
    formData.append('text', `
New Talent Onboarding Completed!

Talent Name: ${talentName}
Email: ${email}
Talent ID: ${talentId}

The talent has successfully completed their onboarding process and submitted their promo video.

Next Steps:
1. Review their profile at: https://shoutout.us/admin
2. Verify their promo video
3. Approve their profile for public listing

---
ShoutOut Admin Notifications
    `);
    
    formData.append('html', `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0b0123 0%, #905476 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
    .info-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 600; width: 120px; color: #6b7280; }
    .info-value { color: #111827; }
    .button { display: inline-block; background: #3a86ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
    .steps { background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    .steps h3 { margin-top: 0; color: #92400e; }
    .steps ol { margin: 10px 0; padding-left: 20px; }
    .steps li { margin: 8px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🎉 New Talent Onboarding Complete!</h1>
    </div>
    <div class="content">
      <p style="font-size: 16px; margin-top: 0;">A new talent has successfully completed their onboarding process.</p>
      
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Talent Name:</div>
          <div class="info-value"><strong>${talentName}</strong></div>
        </div>
        <div class="info-row">
          <div class="info-label">Email:</div>
          <div class="info-value">${email}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Talent ID:</div>
          <div class="info-value"><code>${talentId}</code></div>
        </div>
      </div>

      <div class="steps">
        <h3>📋 Next Steps:</h3>
        <ol>
          <li><strong>Review Profile</strong> - Check talent information and bio</li>
          <li><strong>Verify Promo Video</strong> - Ensure video meets quality standards</li>
          <li><strong>Approve for Listing</strong> - Make profile publicly visible</li>
        </ol>
      </div>

      <center>
        <a href="https://shoutout.us/admin" class="button">View in Admin Dashboard →</a>
      </center>

      <div class="footer">
        <p>ShoutOut Admin Notifications<br>
        This is an automated notification from the ShoutOut platform.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `);

    const mailgunResponse = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
        },
        body: formData,
      }
    );

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text();
      console.error('Mailgun error:', errorText);
      throw new Error(`Failed to send email: ${mailgunResponse.statusText}`);
    }

    const result = await mailgunResponse.json();
    console.log('Email sent successfully:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Onboarding completion notification sent',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error sending onboarding completion notification:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

