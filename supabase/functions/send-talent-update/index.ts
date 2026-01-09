// send-talent-update edge function
// Sends email updates from talent to their followers via SendGrid
// Uses dynamic sender addresses like firstname@shouts.bio

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TalentProfile {
  id: string;
  full_name: string;
  username?: string;
  temp_avatar_url?: string;
}

interface Follower {
  id: string;
  user_id: string;
  unsubscribe_token: string;
  users: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface EmailDraft {
  id: string;
  talent_id: string;
  subject: string;
  content: string;
  button_text?: string;
  button_url?: string;
  image_url?: string;
  image_link_url?: string;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const { draft_id, talent_id } = await req.json();

    if (!draft_id || !talent_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: draft_id, talent_id' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get SendGrid API key
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

    if (!SENDGRID_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Email service not configured (SENDGRID_API_KEY missing)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Fetch the draft
    const { data: draft, error: draftError } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', draft_id)
      .single();

    if (draftError || !draft) {
      return new Response(JSON.stringify({ success: false, error: 'Draft not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Fetch talent profile
    const { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id, full_name, username, temp_avatar_url')
      .eq('id', talent_id)
      .single();

    if (talentError || !talent) {
      return new Response(JSON.stringify({ success: false, error: 'Talent not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Fetch active followers (not unsubscribed)
    const { data: followers, error: followersError } = await supabase
      .from('talent_followers')
      .select(`
        id,
        user_id,
        unsubscribe_token,
        users!inner (
          id,
          email,
          full_name
        )
      `)
      .eq('talent_id', talent_id)
      .is('unsubscribed_at', null);

    if (followersError) {
      console.error('Error fetching followers:', followersError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch followers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!followers || followers.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No followers to send to' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Generate sender email from talent name
    const senderName = talent.full_name || 'Creator';
    const senderHandle = (talent.username || talent.full_name || 'creator')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/, '');
    const fromEmail = `${senderHandle}@shouts.bio`;

    // Build the email HTML template (with placeholder for unsubscribe URL)
    const emailHtml = buildEmailHtml(draft, talent, '{{unsubscribe_url}}');

    // Send emails in batches
    const batchSize = 100;
    let sentCount = 0;
    let failedCount = 0;
    const emailSends: any[] = [];

    for (let i = 0; i < followers.length; i += batchSize) {
      const batch = followers.slice(i, i + batchSize);
      
      // Send each email individually (for personalized unsubscribe links)
      const sendPromises = batch.map(async (follower: any) => {
        const user = follower.users;
        const unsubscribeUrl = `https://bio.shoutout.us/unsubscribe/${follower.unsubscribe_token}`;
        const personalizedHtml = emailHtml.replace('{{unsubscribe_url}}', unsubscribeUrl);

        try {
          // SendGrid API v3 request
          const sendGridPayload = {
            personalizations: [
              {
                to: [{ email: user.email, name: user.full_name || undefined }],
              }
            ],
            from: {
              email: fromEmail,
              name: senderName,
            },
            reply_to: {
              email: fromEmail,
              name: senderName,
            },
            subject: draft.subject || `Update from ${senderName}`,
            content: [
              {
                type: 'text/html',
                value: personalizedHtml,
              }
            ],
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            tracking_settings: {
              click_tracking: { enable: true },
              open_tracking: { enable: true },
            },
          };

          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sendGridPayload),
          });

          // SendGrid returns 202 for successful queued emails
          if (response.ok || response.status === 202) {
            const messageId = response.headers.get('X-Message-Id') || '';
            sentCount++;
            emailSends.push({
              email_draft_id: draft.id,
              talent_id: talent.id,
              user_id: user.id,
              recipient_email: user.email,
              mailgun_message_id: messageId, // Using same field name for compatibility
              status: 'sent',
              created_at: new Date().toISOString(),
            });
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`Failed to send to ${user.email}:`, response.status, errorText);
            failedCount++;
            emailSends.push({
              email_draft_id: draft.id,
              talent_id: talent.id,
              user_id: user.id,
              recipient_email: user.email,
              status: 'failed',
              created_at: new Date().toISOString(),
            });
          }
        } catch (error: any) {
          console.error(`Error sending to ${user.email}:`, error);
          failedCount++;
          emailSends.push({
            email_draft_id: draft.id,
            talent_id: talent.id,
            user_id: user.id,
            recipient_email: user.email,
            status: 'failed',
            created_at: new Date().toISOString(),
          });
        }
      });

      await Promise.all(sendPromises);
    }

    // Record all sends in the database
    if (emailSends.length > 0) {
      await supabase.from('email_sends').insert(emailSends);
    }

    // Update the draft as sent
    await supabase
      .from('email_drafts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipients_count: followers.length,
      })
      .eq('id', draft_id);

    return new Response(JSON.stringify({
      success: true,
      message: `Email sent to ${sentCount} followers`,
      sent: sentCount,
      failed: failedCount,
      total: followers.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Build the email HTML template
function buildEmailHtml(draft: EmailDraft, talent: TalentProfile, unsubscribeUrl: string): string {
  const talentName = talent.full_name || 'Creator';
  const firstName = talentName.split(' ')[0];
  const profileImage = talent.temp_avatar_url || '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${draft.subject || 'Update from ' + talentName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a1a2e;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          
          <!-- Header with profile -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              ${profileImage ? `
              <img src="${profileImage}" alt="${talentName}" width="80" height="80" style="border-radius: 50%; margin-bottom: 16px; border: 3px solid rgba(255,255,255,0.1);">
              ` : ''}
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0;">${talentName}</h1>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="background: linear-gradient(135deg, #252542 0%, #1a1a2e 100%); border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="color: #e0e0e0; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${draft.content || ''}</div>
              
              ${draft.image_url ? `
              <div style="margin-top: 24px;">
                ${draft.image_link_url ? `<a href="${draft.image_link_url}" target="_blank">` : ''}
                <img src="${draft.image_url}" alt="" style="width: 100%; border-radius: 12px; display: block;">
                ${draft.image_link_url ? `</a>` : ''}
              </div>
              ` : ''}
              
              ${draft.button_text && draft.button_url ? `
              <div style="margin-top: 24px; text-align: center;">
                <a href="${draft.button_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">${draft.button_text}</a>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
                You subscribed to ${firstName} through their link in bio.
              </p>
              <p style="color: #666; font-size: 12px; margin: 0 0 16px 0;">
                <a href="${unsubscribeUrl}" style="color: #888; text-decoration: underline;">Unsubscribe</a>
                &nbsp;•&nbsp;
                <a href="https://shoutout.us/privacy" style="color: #888; text-decoration: underline;">Privacy Policy</a>
              </p>
              <p style="color: #555; font-size: 11px; margin: 0;">
                ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
              </p>
              <div style="margin-top: 16px;">
                <a href="https://shoutout.us/creators" style="opacity: 0.5;">
                  <img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logo-1760990980777.png" alt="ShoutOut" height="32" style="filter: brightness(0) invert(1);">
                </a>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
