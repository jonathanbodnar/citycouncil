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

interface BioSettings {
  id: string;
  talent_id: string;
  theme_color?: string;
}

interface BioLink {
  id: string;
  title: string;
  url: string;
  image_url?: string;
  link_type?: string;
}

interface BioEvent {
  id: string;
  title: string;
  event_date: string;
  event_url?: string;
  button_text?: string;
  image_url?: string;
}

interface ServiceOffering {
  id: string;
  service_type: string;
  price: number;
  title?: string;
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

    // Fetch bio settings for theme
    const { data: bioSettings } = await supabase
      .from('bio_settings')
      .select('*')
      .eq('talent_id', talent_id)
      .single();

    // Fetch bio links
    const { data: bioLinks } = await supabase
      .from('bio_links')
      .select('*')
      .eq('talent_id', talent_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // Fetch events (upcoming ones only)
    const { data: bioEvents } = await supabase
      .from('bio_events')
      .select('*')
      .eq('talent_id', talent_id)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .limit(1);

    // Fetch service offerings (for collab)
    const { data: services } = await supabase
      .from('service_offerings')
      .select('*')
      .eq('talent_id', talent_id)
      .eq('is_active', true);

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
    const emailHtml = buildEmailHtml(
      draft, 
      talent, 
      '{{unsubscribe_url}}',
      bioSettings,
      bioLinks || [],
      bioEvents || [],
      services || []
    );

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
function buildEmailHtml(
  draft: EmailDraft, 
  talent: TalentProfile, 
  unsubscribeUrl: string,
  bioSettings: BioSettings | null,
  bioLinks: BioLink[],
  bioEvents: BioEvent[],
  services: ServiceOffering[]
): string {
  const talentName = talent.full_name || 'Creator';
  const firstName = talentName.split(' ')[0];
  const profileImage = talent.temp_avatar_url || '';
  const bioUrl = `https://bio.shoutout.us/${talent.username || talent.id}`;
  
  // Check what content is available
  const hasEvent = bioEvents.length > 0;
  const hasCollab = services.some(s => s.service_type === 'instagram_collab');
  const linksWithImages = bioLinks.filter(l => l.image_url && l.link_type !== 'standard');
  const hasLinks = linksWithImages.length > 0;
  const hasMoreWays = hasEvent || hasCollab || hasLinks;
  
  // Format event date
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Build "More ways to connect" cards
  let moreWaysHtml = '';
  if (hasMoreWays) {
    const cards: string[] = [];
    
    // Event card
    if (hasEvent) {
      const event = bioEvents[0];
      cards.push(`
        <td style="width: 50%; padding: 6px;">
          <a href="${event.event_url || bioUrl}" target="_blank" style="text-decoration: none; display: block;">
            <div style="background: #2a2a3e; border-radius: 12px; padding: 16px; min-height: 60px;">
              <div style="display: flex; align-items: center;">
                <div style="color: #ec4899; font-size: 20px; margin-right: 12px;">📅</div>
                <div>
                  <div style="color: #fff; font-size: 14px; font-weight: 500;">${event.title}</div>
                  <div style="color: #888; font-size: 12px;">${formatEventDate(event.event_date)}</div>
                </div>
              </div>
            </div>
          </a>
        </td>
      `);
    }
    
    // Collab card
    if (hasCollab) {
      cards.push(`
        <td style="width: 50%; padding: 6px;">
          <a href="${bioUrl}" target="_blank" style="text-decoration: none; display: block;">
            <div style="background: #2a2a3e; border-radius: 12px; padding: 16px; min-height: 60px;">
              <div style="display: flex; align-items: center;">
                <div style="color: #a855f7; font-size: 20px; margin-right: 12px;">📸</div>
                <div>
                  <div style="color: #fff; font-size: 14px; font-weight: 500;">Collaborate with me</div>
                </div>
              </div>
            </div>
          </a>
        </td>
      `);
    }
    
    // Link cards (with images)
    linksWithImages.slice(0, 2).forEach(link => {
      cards.push(`
        <td style="width: 50%; padding: 6px;">
          <a href="${link.url}" target="_blank" style="text-decoration: none; display: block;">
            <div style="background: #2a2a3e; border-radius: 12px; overflow: hidden; min-height: 60px;">
              ${link.image_url ? `<img src="${link.image_url}" alt="" style="width: 100%; height: 80px; object-fit: cover;">` : ''}
              <div style="padding: 12px;">
                <div style="color: #fff; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${link.title}</div>
              </div>
            </div>
          </a>
        </td>
      `);
    });
    
    // Build rows (2 cards per row)
    let rowsHtml = '';
    for (let i = 0; i < cards.length; i += 2) {
      rowsHtml += `<tr>${cards[i]}${cards[i + 1] || '<td style="width: 50%;"></td>'}</tr>`;
    }
    
    moreWaysHtml = `
      <tr>
        <td style="padding-top: 24px;">
          <a href="${bioUrl}" target="_blank" style="text-decoration: none; display: block;">
            <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px;">
              <div style="color: #fff; font-size: 16px; font-weight: 600; margin-bottom: 16px;">✨ More ways to connect</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${rowsHtml}
              </table>
            </div>
          </a>
        </td>
      </tr>
    `;
  }

  // Build ShoutOut card
  const shoutoutCardHtml = `
    <tr>
      <td style="padding-top: 16px;">
        <a href="https://shoutout.us/${talent.username || ''}" target="_blank" style="text-decoration: none; display: block;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px; overflow: hidden;">
            <tr>
              <td style="width: 140px; vertical-align: top; position: relative;">
                ${profileImage ? `
                <div style="position: relative;">
                  <img src="${profileImage}" alt="" style="width: 140px; height: 140px; object-fit: cover; display: block;">
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 48px; height: 48px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <div style="width: 0; height: 0; border-left: 16px solid #6366f1; border-top: 10px solid transparent; border-bottom: 10px solid transparent; margin-left: 4px;"></div>
                  </div>
                </div>
                ` : ''}
              </td>
              <td style="padding: 20px; vertical-align: middle;">
                <div style="color: #93c5fd; font-size: 16px; font-weight: 600;">Get a Personalized Video Shoutout</div>
                <div style="color: #fff; font-size: 14px; margin-top: 4px;">From ${talentName}</div>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>
  `;
  
  // White ShoutOut logo SVG (inline for email compatibility)
  const shoutoutLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" width="120" height="28"><path fill="#ffffff" d="M15.2 28.8c-2.4 0-4.5-.4-6.2-1.2-1.7-.8-3-1.9-3.9-3.3-.9-1.4-1.4-3-1.4-4.8h6.1c.1 1.2.5 2.1 1.3 2.8.8.7 1.9 1 3.3 1 1 0 1.8-.2 2.4-.6.6-.4.9-.9.9-1.6 0-.6-.2-1.1-.7-1.4-.5-.4-1.1-.7-1.8-.9-.8-.3-1.8-.5-3-.8-1.7-.4-3.1-.9-4.3-1.4-1.2-.5-2.2-1.3-3-2.3-.8-1-1.2-2.4-1.2-4.1 0-2.4.9-4.3 2.7-5.7 1.8-1.4 4.2-2.1 7.1-2.1 3 0 5.4.7 7.2 2.1 1.8 1.4 2.8 3.3 2.9 5.8h-6.2c-.1-1-.5-1.8-1.2-2.4-.7-.6-1.7-.9-2.9-.9-.9 0-1.7.2-2.2.6-.5.4-.8.9-.8 1.6 0 .5.2.9.5 1.2.4.3.9.6 1.5.8.6.2 1.5.5 2.7.8 1.8.4 3.3.9 4.6 1.5 1.3.5 2.3 1.3 3.2 2.4.8 1 1.3 2.4 1.3 4.1 0 1.6-.4 3-1.3 4.3-.8 1.3-2 2.3-3.6 3-1.5.7-3.4 1-5.5 1zM40.8 12.8v2.9c.6-1 1.4-1.8 2.4-2.4 1-.6 2.1-.9 3.4-.9 1.8 0 3.2.5 4.3 1.6 1.1 1.1 1.6 2.7 1.6 4.9v9.8h-5.4v-9c0-1.2-.3-2.1-.8-2.7-.5-.6-1.3-.9-2.2-.9-1 0-1.8.3-2.4 1-.6.7-.9 1.6-.9 2.8v8.8h-5.4V12.8h5.4zM62.3 29.2c-1.6 0-3-.3-4.3-1-1.3-.7-2.3-1.6-3-2.8-.7-1.2-1.1-2.6-1.1-4.2 0-1.6.4-3 1.1-4.2.7-1.2 1.7-2.2 3-2.8 1.3-.7 2.7-1 4.3-1 1.6 0 3 .3 4.3 1 1.3.7 2.3 1.6 3 2.8.7 1.2 1.1 2.6 1.1 4.2 0 1.6-.4 3-1.1 4.2-.7 1.2-1.8 2.2-3.1 2.8-1.2.7-2.6 1-4.2 1zm0-4.3c1 0 1.8-.4 2.4-1.1.6-.7.9-1.7.9-3s-.3-2.3-.9-3c-.6-.7-1.4-1.1-2.4-1.1-1 0-1.8.4-2.4 1.1-.6.7-.9 1.7-.9 3s.3 2.3.9 3c.6.7 1.4 1.1 2.4 1.1zM87.3 12.8v15.9h-5.4v-2.5c-.5.9-1.2 1.6-2.1 2.1-.9.5-2 .8-3.2.8-1.8 0-3.2-.5-4.3-1.6-1.1-1.1-1.6-2.7-1.6-4.9v-9.8h5.4v9c0 1.2.3 2.1.8 2.7.5.6 1.3.9 2.2.9 1 0 1.8-.3 2.4-1 .6-.7.9-1.6.9-2.8v-8.8h4.9zM97.8 17v7.3c0 .5.1.9.4 1.1.3.2.7.3 1.3.3h1.9v3.1h-2.6c-3.6 0-5.4-1.7-5.4-5.2V17h-2.1v-4.2h2.1V8.6h5.4v4.2h3.6V17h-3.6zM103.2 21.1c0-1.6.3-3 1-4.2.7-1.2 1.6-2.1 2.8-2.8 1.2-.7 2.6-1 4.1-1 2.1 0 3.9.6 5.2 1.7 1.4 1.1 2.2 2.7 2.5 4.7h-5.5c-.3-1.4-1.1-2.1-2.4-2.1-.9 0-1.6.4-2.1 1.1-.5.7-.8 1.8-.8 3.2 0 1.4.3 2.4.8 3.2.5.7 1.2 1.1 2.1 1.1 1.3 0 2.1-.7 2.4-2.1h5.5c-.3 2-1.1 3.5-2.5 4.7-1.4 1.1-3.1 1.7-5.2 1.7-1.5 0-2.9-.3-4.1-1-1.2-.7-2.1-1.6-2.8-2.8-.7-1.3-1-2.8-1-4.4zM128.1 29.2c-1.6 0-3-.3-4.3-1-1.3-.7-2.3-1.6-3-2.8-.7-1.2-1.1-2.6-1.1-4.2 0-1.6.4-3 1.1-4.2.7-1.2 1.7-2.2 3-2.8 1.3-.7 2.7-1 4.3-1 1.6 0 3 .3 4.3 1 1.3.7 2.3 1.6 3 2.8.7 1.2 1.1 2.6 1.1 4.2 0 1.6-.4 3-1.1 4.2-.7 1.2-1.8 2.2-3.1 2.8-1.2.7-2.6 1-4.2 1zm0-4.3c1 0 1.8-.4 2.4-1.1.6-.7.9-1.7.9-3s-.3-2.3-.9-3c-.6-.7-1.4-1.1-2.4-1.1-1 0-1.8.4-2.4 1.1-.6.7-.9 1.7-.9 3s.3 2.3.9 3c.6.7 1.4 1.1 2.4 1.1zM153.1 12.8v15.9h-5.4v-2.5c-.5.9-1.2 1.6-2.1 2.1-.9.5-2 .8-3.2.8-1.8 0-3.2-.5-4.3-1.6-1.1-1.1-1.6-2.7-1.6-4.9v-9.8h5.4v9c0 1.2.3 2.1.8 2.7.5.6 1.3.9 2.2.9 1 0 1.8-.3 2.4-1 .6-.7.9-1.6.9-2.8v-8.8h4.9zM163.6 17v7.3c0 .5.1.9.4 1.1.3.2.7.3 1.3.3h1.9v3.1h-2.6c-3.6 0-5.4-1.7-5.4-5.2V17h-2.1v-4.2h2.1V8.6h5.4v4.2h3.6V17h-3.6z"/></svg>`;

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
          
          <!-- Divider -->
          <tr>
            <td style="padding: 24px 0;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>
          
          <!-- More ways to connect -->
          ${moreWaysHtml}
          
          <!-- ShoutOut card -->
          ${shoutoutCardHtml}
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
                  You subscribed to ${firstName} through their link in bio on their social platforms.
                </p>
                <p style="color: #666; font-size: 12px; margin: 0 0 16px 0;">
                  <a href="${unsubscribeUrl}" style="color: #888; text-decoration: underline;">Unsubscribe</a>
                  &nbsp;•&nbsp;
                  <a href="https://shoutout.us/privacy" style="color: #888; text-decoration: underline;">Privacy Policy</a>
                </p>
                <p style="color: #555; font-size: 11px; margin: 0 0 16px 0;">
                  ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
                </p>
                <div style="margin-top: 8px;">
                  <a href="https://shoutout.us/creators" style="text-decoration: none; opacity: 0.6;">
                    <span style="color: #888; font-size: 11px; margin-right: 8px;">Powered by</span>
                    ${shoutoutLogoSvg}
                  </a>
                </div>
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
