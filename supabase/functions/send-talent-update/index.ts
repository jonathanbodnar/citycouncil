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

// Get theme colors based on bio settings
function getThemeColors(bioSettings: BioSettings | null): { 
  bgColor: string; 
  cardBg: string; 
  accentColor: string;
  accentColor2: string; // Secondary color for gradients
  textColor: string;
  mutedText: string;
  lightAccent: string; // Lighter version of accent for text on accent bg
} {
  const themeColor = bioSettings?.theme_color || '#1a1a2e';
  
  // Define theme presets with gradient-friendly secondary colors
  const themes: Record<string, { bgColor: string; cardBg: string; accentColor: string; accentColor2: string; textColor: string; mutedText: string; lightAccent: string }> = {
    '#1a1a2e': { bgColor: '#1a1a2e', cardBg: '#252542', accentColor: '#6366f1', accentColor2: '#8b5cf6', textColor: '#ffffff', mutedText: '#888888', lightAccent: '#c7d2fe' },
    '#0f172a': { bgColor: '#0f172a', cardBg: '#1e293b', accentColor: '#3b82f6', accentColor2: '#6366f1', textColor: '#ffffff', mutedText: '#94a3b8', lightAccent: '#bfdbfe' },
    '#18181b': { bgColor: '#18181b', cardBg: '#27272a', accentColor: '#a855f7', accentColor2: '#ec4899', textColor: '#ffffff', mutedText: '#a1a1aa', lightAccent: '#e9d5ff' },
    '#1c1917': { bgColor: '#1c1917', cardBg: '#292524', accentColor: '#f97316', accentColor2: '#eab308', textColor: '#ffffff', mutedText: '#a8a29e', lightAccent: '#fed7aa' },
    '#052e16': { bgColor: '#052e16', cardBg: '#14532d', accentColor: '#22c55e', accentColor2: '#10b981', textColor: '#ffffff', mutedText: '#86efac', lightAccent: '#bbf7d0' },
    '#172554': { bgColor: '#172554', cardBg: '#1e3a8a', accentColor: '#60a5fa', accentColor2: '#818cf8', textColor: '#ffffff', mutedText: '#93c5fd', lightAccent: '#dbeafe' },
    '#4c0519': { bgColor: '#4c0519', cardBg: '#881337', accentColor: '#fb7185', accentColor2: '#f472b6', textColor: '#ffffff', mutedText: '#fda4af', lightAccent: '#fecdd3' },
    '#ffffff': { bgColor: '#f8fafc', cardBg: '#ffffff', accentColor: '#6366f1', accentColor2: '#8b5cf6', textColor: '#1e293b', mutedText: '#64748b', lightAccent: '#c7d2fe' },
    '#fef3c7': { bgColor: '#fef3c7', cardBg: '#ffffff', accentColor: '#f59e0b', accentColor2: '#f97316', textColor: '#1e293b', mutedText: '#92400e', lightAccent: '#fde68a' },
  };
  
  return themes[themeColor] || themes['#1a1a2e'];
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
  
  // ShoutOut logo as inline base64 SVG (white version for dark backgrounds)
  const shoutoutLogoHtml = `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxODAgNDAiPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik0xNS4yIDI4LjhjLTIuNCAwLTQuNS0uNC02LjItMS4yLTEuNy0uOC0zLTEuOS0zLjktMy4zLS45LTEuNC0xLjQtMy0xLjQtNC44aDYuMWMuMSAxLjIuNSAyLjEgMS4zIDIuOC44LjcgMS45IDEgMy4zIDEgMSAwIDEuOC0uMiAyLjQtLjYuNi0uNC45LS45LjktMS42IDAtLjYtLjItMS4xLS43LTEuNC0uNS0uNC0xLjEtLjctMS44LS45LS44LS4zLTEuOC0uNS0zLS44LTEuNy0uNC0zLjEtLjktNC4zLTEuNC0xLjItLjUtMi4yLTEuMy0zLTIuMy0uOC0xLTEuMi0yLjQtMS4yLTQuMSAwLTIuNC45LTQuMyAyLjctNS43IDEuOC0xLjQgNC4yLTIuMSA3LjEtMi4xIDMgMCA1LjQuNyA3LjIgMi4xIDEuOCAxLjQgMi44IDMuMyAyLjkgNS44aC02LjJjLS4xLTEtLjUtMS44LTEuMi0yLjQtLjctLjYtMS43LS45LTIuOS0uOS0uOSAwLTEuNy4yLTIuMi42LS41LjQtLjguOS0uOCAxLjYgMCAuNS4yLjkuNSAxLjIuNC4zLjkuNiAxLjUuOC42LjIgMS41LjUgMi43LjggMS44LjQgMy4zLjkgNC42IDEuNSAxLjMuNSAyLjMgMS4zIDMuMiAyLjQuOCAxIDEuMyAyLjQgMS4zIDQuMSAwIDEuNi0uNCAzLTEuMyA0LjMtLjggMS4zLTIgMi4zLTMuNiAzLTEuNS43LTMuNCAxLTUuNSAxek00MC44IDEyLjh2Mi45Yy42LTEgMS40LTEuOCAyLjQtMi40IDEtLjYgMi4xLS45IDMuNC0uOSAxLjggMCAzLjIuNSA0LjMgMS42IDEuMSAxLjEgMS42IDIuNyAxLjYgNC45djkuOGgtNS40di05YzAtMS4yLS4zLTIuMS0uOC0yLjctLjUtLjYtMS4zLS45LTIuMi0uOS0xIDAtMS44LjMtMi40IDEtLjYuNy0uOSAxLjYtLjkgMi44djguOGgtNS40VjEyLjhoNS40ek02Mi4zIDI5LjJjLTEuNiAwLTMtLjMtNC4zLTEtMS4zLS43LTIuMy0xLjYtMy0yLjgtLjctMS4yLTEuMS0yLjYtMS4xLTQuMiAwLTEuNi40LTMgMS4xLTQuMi43LTEuMiAxLjctMi4yIDMtMi44IDEuMy0uNyAyLjctMSA0LjMtMSAxLjYgMCAzIC4zIDQuMyAxIDEuMy43IDIuMyAxLjYgMyAyLjguNyAxLjIgMS4xIDIuNiAxLjEgNC4yIDAgMS42LS40IDMtMS4xIDQuMi0uNyAxLjItMS44IDIuMi0zLjEgMi44LTEuMi43LTIuNiAxLTQuMiAxem0wLTQuM2MxIDAgMS44LS40IDIuNC0xLjEuNi0uNy45LTEuNy45LTNzLS4zLTIuMy0uOS0zYy0uNi0uNy0xLjQtMS4xLTIuNC0xLjEtMSAwLTEuOC40LTIuNCAxLjEtLjYuNy0uOSAxLjctLjkgM3MuMyAyLjMuOSAzYy42LjcgMS40IDEuMSAyLjQgMS4xek04Ny4zIDEyLjh2MTUuOWgtNS40di0yLjVjLS41LjktMS4yIDEuNi0yLjEgMi4xLS45LjUtMiAuOC0zLjIuOC0xLjggMC0zLjItLjUtNC4zLTEuNi0xLjEtMS4xLTEuNi0yLjctMS42LTQuOXYtOS44aDUuNHY5YzAgMS4yLjMgMi4xLjggMi43LjUuNiAxLjMuOSAyLjIuOSAxIDAgMS44LS4zIDIuNC0xIC42LS43LjktMS42LjktMi44di04LjhoNC45ek05Ny44IDE3djcuM2MwIC41LjEuOS40IDEuMS4zLjIuNy4zIDEuMy4zaDEuOXYzLjFoLTIuNmMtMy42IDAtNS40LTEuNy01LjQtNS4yVjE3aC0yLjF2LTQuMmgyLjFWOC42aDUuNHY0LjJoMy42VjE3aC0zLjZ6TTEwMy4yIDIxLjFjMC0xLjYuMy0zIDEtNC4yLjctMS4yIDEuNi0yLjEgMi44LTIuOCAxLjItLjcgMi42LTEgNC4xLTEgMi4xIDAgMy45LjYgNS4yIDEuNyAxLjQgMS4xIDIuMiAyLjcgMi41IDQuN2gtNS41Yy0uMy0xLjQtMS4xLTIuMS0yLjQtMi4xLS45IDAtMS42LjQtMi4xIDEuMS0uNS43LS44IDEuOC0uOCAzLjIgMCAxLjQuMyAyLjQuOCAzLjIuNS43IDEuMiAxLjEgMi4xIDEuMSAxLjMgMCAyLjEtLjcgMi40LTIuMWg1LjVjLS4zIDItMS4xIDMuNS0yLjUgNC43LTEuNCAxLjEtMy4xIDEuNy01LjIgMS43LTEuNSAwLTIuOS0uMy00LjEtMS0xLjItLjctMi4xLTEuNi0yLjgtMi44LS43LTEuMy0xLTIuOC0xLTQuNHpNMTI4LjEgMjkuMmMtMS42IDAtMy0uMy00LjMtMS0xLjMtLjctMi4zLTEuNi0zLTIuOC0uNy0xLjItMS4xLTIuNi0xLjEtNC4yIDAtMS42LjQtMyAxLjEtNC4yLjctMS4yIDEuNy0yLjIgMy0yLjggMS4zLS43IDIuNy0xIDQuMy0xIDEuNiAwIDMgLjMgNC4zIDEgMS4zLjcgMi4zIDEuNiAzIDIuOC43IDEuMiAxLjEgMi42IDEuMSA0LjIgMCAxLjYtLjQgMy0xLjEgNC4yLS43IDEuMi0xLjggMi4yLTMuMSAyLjgtMS4yLjctMi42IDEtNC4yIDF6bTAtNC4zYzEgMCAxLjgtLjQgMi40LTEuMS42LS43LjktMS43LjktM3MtLjMtMi4zLS45LTNjLS42LS43LTEuNC0xLjEtMi40LTEuMS0xIDAtMS44LjQtMi40IDEuMS0uNi43LS45IDEuNy0uOSAzcy4zIDIuMy45IDNjLjYuNyAxLjQgMS4xIDIuNCAxLjF6TTE1My4xIDEyLjh2MTUuOWgtNS40di0yLjVjLS41LjktMS4yIDEuNi0yLjEgMi4xLS45LjUtMiAuOC0zLjIuOC0xLjggMC0zLjItLjUtNC4zLTEuNi0xLjEtMS4xLTEuNi0yLjctMS42LTQuOXYtOS44aDUuNHY5YzAgMS4yLjMgMi4xLjggMi43LjUuNiAxLjMuOSAyLjIuOSAxIDAgMS44LS4zIDIuNC0xIC42LS43LjktMS42LjktMi44di04LjhoNC45ek0xNjMuNiAxN3Y3LjNjMCAuNS4xLjkuNCAxLjEuMy4yLjcuMyAxLjMuM2gxLjl2My4xaC0yLjZjLTMuNiAwLTUuNC0xLjctNS40LTUuMlYxN2gtMi4xdi00LjJoMi4xVjguNmg1LjR2NC4yaDMuNlYxN2gtMy42eiIvPjwvc3ZnPg==" alt="ShoutOut" height="24" style="height: 24px; vertical-align: middle;">`;

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
