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
  background_style?: string;
  // Actual fields used in the database
  gradient_start?: string;
  gradient_end?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
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

// Get theme colors based on bio settings - uses actual gradient_start, accent_color from DB
function getThemeColors(bioSettings: BioSettings | null): { 
  bgColor: string; 
  cardBg: string; 
  accentColor: string;
  accentColor2: string; // Secondary color for gradients
  textColor: string;
  mutedText: string;
  lightAccent: string; // Lighter version of accent for text on accent bg
} {
  // Use actual values from bio_settings if available
  const gradientStart = bioSettings?.gradient_start || '#1a1a2e';
  const gradientEnd = bioSettings?.gradient_end || '#0a0a0a';
  const accentColor = bioSettings?.accent_color || '#6366f1';
  const textColor = bioSettings?.text_color || '#ffffff';
  
  // Generate a lighter card background from gradient start
  // and a secondary accent color for gradients
  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  };
  
  // Generate second accent color by shifting hue slightly
  const shiftHue = (hex: string): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const R = (num >> 16) & 0xFF;
    const G = (num >> 8) & 0xFF;
    const B = num & 0xFF;
    // Shift towards purple/pink
    const newR = Math.min(255, R + 30);
    const newG = Math.max(0, G - 20);
    const newB = Math.min(255, B + 40);
    return '#' + (0x1000000 + newR * 0x10000 + newG * 0x100 + newB).toString(16).slice(1);
  };
  
  // Determine if it's a light or dark theme
  const isLightTheme = gradientStart === '#ffffff' || gradientStart === '#fef3c7' || 
    parseInt(gradientStart.replace('#', ''), 16) > 0xaaaaaa;
  
  return {
    bgColor: gradientStart,
    cardBg: isLightTheme ? '#ffffff' : lightenColor(gradientStart, 10),
    accentColor: accentColor,
    accentColor2: shiftHue(accentColor),
    textColor: isLightTheme ? '#1e293b' : textColor,
    mutedText: isLightTheme ? '#64748b' : lightenColor(gradientStart, 40),
    lightAccent: lightenColor(accentColor, 30),
  };
}

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
  const theme = getThemeColors(bioSettings);
  
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
        <td style="width: 50%; padding: 6px; vertical-align: top;">
          <a href="${event.event_url || bioUrl}" target="_blank" style="text-decoration: none; display: block;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${theme.cardBg}; border-radius: 12px;">
              <tr>
                <td style="padding: 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align: top; padding-right: 10px; font-size: 20px;">
                        📅
                      </td>
                      <td style="vertical-align: top;">
                        <div style="color: ${theme.textColor}; font-size: 14px; font-weight: 600;">${event.title}</div>
                        <div style="color: ${theme.mutedText}; font-size: 12px; margin-top: 4px;">${formatEventDate(event.event_date)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </a>
        </td>
      `);
    }
    
    // Collab card
    if (hasCollab) {
      cards.push(`
        <td style="width: 50%; padding: 6px; vertical-align: top;">
          <a href="${bioUrl}" target="_blank" style="text-decoration: none; display: block;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${theme.cardBg}; border-radius: 12px;">
              <tr>
                <td style="padding: 16px;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align: middle; padding-right: 10px; font-size: 20px;">
                        📸
                      </td>
                      <td style="vertical-align: middle;">
                        <div style="color: ${theme.textColor}; font-size: 14px; font-weight: 600;">Collaborate with me</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </a>
        </td>
      `);
    }
    
    // Link cards (with images)
    linksWithImages.slice(0, 2).forEach(link => {
      cards.push(`
        <td style="width: 50%; padding: 6px; vertical-align: top;">
          <a href="${link.url}" target="_blank" style="text-decoration: none; display: block;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${theme.cardBg}; border-radius: 12px; overflow: hidden;">
              <tr>
                <td>
                  ${link.image_url ? `<img src="${link.image_url}" alt="" width="100%" style="width: 100%; height: 80px; object-fit: cover; display: block;">` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px;">
                  <div style="color: ${theme.textColor}; font-size: 13px; font-weight: 500;">${link.title}</div>
                </td>
              </tr>
            </table>
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
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${theme.cardBg}; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;">
            <tr>
              <td style="padding: 20px;">
                <div style="color: ${theme.textColor}; font-size: 16px; font-weight: 600; margin-bottom: 16px;">✨ More ways to connect</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${rowsHtml}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  // Build ShoutOut card - using table layout for email compatibility
  // Uses theme colors for gradient
  const shoutoutCardHtml = `
    <tr>
      <td style="padding-top: 16px;">
        <a href="https://shoutout.us/${talent.username || ''}" target="_blank" style="text-decoration: none; display: block;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${theme.accentColor} 0%, ${theme.accentColor2} 100%); border-radius: 16px; overflow: hidden;">
            <tr>
              ${profileImage ? `
              <td width="120" style="vertical-align: middle;">
                <img src="${profileImage}" alt="" width="120" height="120" style="width: 120px; height: 120px; object-fit: cover; display: block;">
              </td>
              ` : ''}
              <td style="padding: 20px; vertical-align: middle;">
                <div style="color: ${theme.lightAccent}; font-size: 15px; font-weight: 600;">Get a Personalized Video Shoutout</div>
                <div style="color: #ffffff; font-size: 14px; margin-top: 6px;">From ${talentName}</div>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>
  `;
  
  // ShoutOut logo - use the hosted Supabase logo with CSS filter for white
  // The logo is hosted on Supabase storage and we apply brightness/invert filter
  const shoutoutLogoUrl = "https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logo-1760990980777.png";
  const shoutoutLogoHtml = `<img src="${shoutoutLogoUrl}" alt="ShoutOut" height="24" style="height: 24px; vertical-align: middle; filter: brightness(0) invert(1); -webkit-filter: brightness(0) invert(1);">`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${draft.subject || 'Update from ' + talentName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${theme.bgColor};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          
          <!-- Header with profile -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              ${profileImage ? `
              <img src="${profileImage}" alt="${talentName}" width="80" height="80" style="border-radius: 50%; margin-bottom: 16px; border: 3px solid rgba(255,255,255,0.1);">
              ` : ''}
              <h1 style="color: ${theme.textColor}; font-size: 24px; font-weight: 600; margin: 0;">${talentName}</h1>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="background: ${theme.cardBg}; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; white-space: pre-wrap; opacity: 0.9;">${draft.content || ''}</div>
              
              ${draft.image_url ? `
              <div style="margin-top: 24px;">
                ${draft.image_link_url ? `<a href="${draft.image_link_url}" target="_blank">` : ''}
                <img src="${draft.image_url}" alt="" style="width: 100%; border-radius: 12px; display: block;">
                ${draft.image_link_url ? `</a>` : ''}
              </div>
              ` : ''}
              
              ${draft.button_text && draft.button_url ? `
              <div style="margin-top: 24px; text-align: center;">
                <a href="${draft.button_url}" target="_blank" style="display: inline-block; background: ${theme.accentColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">${draft.button_text}</a>
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
                <p style="color: ${theme.mutedText}; font-size: 12px; margin: 0 0 8px 0;">
                  You subscribed to ${firstName} through their link in bio on their social platforms.
                </p>
                <p style="color: ${theme.mutedText}; font-size: 12px; margin: 0 0 16px 0;">
                  <a href="${unsubscribeUrl}" style="color: ${theme.mutedText}; text-decoration: underline;">Unsubscribe</a>
                  &nbsp;•&nbsp;
                  <a href="https://shoutout.us/privacy" style="color: ${theme.mutedText}; text-decoration: underline;">Privacy Policy</a>
                </p>
                <p style="color: ${theme.mutedText}; font-size: 11px; margin: 0 0 16px 0; opacity: 0.7;">
                  ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
                </p>
                <div style="margin-top: 8px;">
                  <a href="https://shoutout.us/creators" style="text-decoration: none; opacity: 0.6;">
                    <span style="color: ${theme.mutedText}; font-size: 11px; margin-right: 8px; vertical-align: middle;">Powered by</span>
                    ${shoutoutLogoHtml}
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
