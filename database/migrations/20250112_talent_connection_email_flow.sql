-- Talent Connection Email Flow
-- Emails sent when a user subscribes/connects with a talent member
-- Supports {{talent}} variable and talent photo in header

-- Update the bio_page_welcome flow to be talent_connection
UPDATE email_flows 
SET 
  name = 'talent_connection',
  display_name = '🔗 Talent Connection Welcome',
  description = 'Welcome email when a user connects/subscribes to a talent',
  trigger_type = 'bio_page'
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';

-- Delete any existing messages for this flow (to replace with new ones)
DELETE FROM email_flow_messages WHERE flow_id = 'aaaa1111-1111-1111-1111-111111111111';

-- Insert welcome email for talent connection flow
-- Note: {{talent_photo_html}} and {{talent}} will be replaced by process-email-flows
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, preview_text, html_content, delay_minutes, include_coupon, is_active) VALUES
(
  'aaaa1111-1111-1111-1111-111111111111', 
  1, 
  'You''re now connected with {{talent}} on ShoutOut! 🎉', 
  'Get personalized video messages from {{talent}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f1a; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f0f1a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          
          <!-- ShoutOut Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" alt="ShoutOut" height="40" style="height: 40px;">
            </td>
          </tr>
          
          <!-- Header with Talent Photo (centered like talent updates) -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              {{talent_photo_html}}
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 16px 0 0 0;">{{talent}}</h1>
            </td>
          </tr>
          
          <!-- Main Content Card -->
          <tr>
            <td style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
                Hey {{first_name}}! 👋
              </p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                You''re officially connected with <strong style="color: #ffffff;">{{talent}}</strong> on ShoutOut! This means you''ll be the first to know about:
              </p>
              <ul style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li>New announcements and updates</li>
                <li>Exclusive offers and content</li>
                <li>Special events and appearances</li>
              </ul>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Want a <strong style="color: #ffffff;">personalized video message</strong> from {{talent}}? Order a ShoutOut for yourself or as a unique gift!
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="{{talent_profile_link}}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  Get a ShoutOut from {{talent}} →
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 24px 0;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>
          
          <!-- ShoutOut Card -->
          <tr>
            <td style="padding-top: 16px;">
              <a href="{{talent_profile_link}}" target="_blank" style="text-decoration: none; display: block;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #1e3a5f 0%, #4c1d95 100%); background-color: #2d2a6e; border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td width="120" style="vertical-align: middle; background-color: transparent;">
                      <div style="width: 120px; height: 120px; overflow: hidden;">
                        {{talent_photo_square}}
                      </div>
                    </td>
                    <td style="padding: 20px; vertical-align: middle; background-color: transparent;">
                      <div style="color: #93c5fd; font-size: 15px; font-weight: 600;">Get a Personalized Video Shoutout</div>
                      <div style="color: #ffffff; font-size: 14px; margin-top: 6px;">From {{talent}}</div>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          
          <!-- General ShoutOut Promo Card -->
          <tr>
            <td style="padding-top: 16px;">
              <a href="https://shoutout.us?utm=talent_connection" target="_blank" style="text-decoration: none; display: block;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #f43f5e 100%); border-radius: 16px; padding: 24px;">
                  <tr>
                    <td>
                      <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 4px;">Get a Personalized Video ShoutOut</div>
                      <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 16px;">From top free-speech personalities — starting at $47</div>
                      <!-- Talent avatars table -->
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); text-align: center; vertical-align: middle;">
                            <span style="color: #ffffff; font-size: 10px; font-weight: 600;">+42</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0 0 8px 0;">
                  You subscribed to {{talent}} through ShoutOut.
                </p>
                <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0 0 16px 0;">
                  <a href="{{unsubscribe_url}}" style="color: rgba(255,255,255,0.4); text-decoration: underline;">Unsubscribe</a>
                  &nbsp;•&nbsp;
                  <a href="https://shoutout.us/privacy" style="color: rgba(255,255,255,0.4); text-decoration: underline;">Privacy Policy</a>
                </p>
                <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0 0 16px 0; opacity: 0.7;">
                  ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
                </p>
                <div style="margin-top: 8px;">
                  <a href="https://shoutout.us/creators" style="text-decoration: none; opacity: 0.6;">
                    <span style="color: rgba(255,255,255,0.4); font-size: 11px; margin-right: 8px; vertical-align: middle;">Powered by</span>
                    <img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" alt="ShoutOut" height="24" style="height: 24px; vertical-align: middle;">
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
</html>',
  0, -- Send immediately
  false, -- No coupon for first email
  true
);

-- Second email: Follow-up after 3 days
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, preview_text, html_content, delay_days, include_coupon, is_active) VALUES
(
  'aaaa1111-1111-1111-1111-111111111111', 
  2, 
  'Don''t miss out on {{talent}}! 🎬', 
  'Get your personalized video ShoutOut',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f1a; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f0f1a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          
          <!-- ShoutOut Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" alt="ShoutOut" height="40" style="height: 40px;">
            </td>
          </tr>
          
          <!-- Header with Talent Photo (centered like talent updates) -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              {{talent_photo_html}}
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 16px 0 0 0;">{{talent}}</h1>
            </td>
          </tr>
          
          <!-- Main Content Card -->
          <tr>
            <td style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
                Hey {{first_name}}! 👋
              </p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Have you checked out <strong style="color: #ffffff;">{{talent}}</strong> on ShoutOut yet?
              </p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                A personalized video ShoutOut makes the perfect gift for:
              </p>
              <ul style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li>🎂 Birthdays</li>
                <li>🎓 Graduations</li>
                <li>💪 Motivational boosts</li>
                <li>❤️ Just because!</li>
              </ul>
              
              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="{{talent_profile_link}}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  Order Your ShoutOut →
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 24px 0;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>
          
          <!-- ShoutOut Card -->
          <tr>
            <td style="padding-top: 16px;">
              <a href="{{talent_profile_link}}" target="_blank" style="text-decoration: none; display: block;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #1e3a5f 0%, #4c1d95 100%); background-color: #2d2a6e; border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td width="120" style="vertical-align: middle; background-color: transparent;">
                      <div style="width: 120px; height: 120px; overflow: hidden;">
                        {{talent_photo_square}}
                      </div>
                    </td>
                    <td style="padding: 20px; vertical-align: middle; background-color: transparent;">
                      <div style="color: #93c5fd; font-size: 15px; font-weight: 600;">Get a Personalized Video Shoutout</div>
                      <div style="color: #ffffff; font-size: 14px; margin-top: 6px;">From {{talent}}</div>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          
          <!-- General ShoutOut Promo Card -->
          <tr>
            <td style="padding-top: 16px;">
              <a href="https://shoutout.us?utm=talent_connection_followup" target="_blank" style="text-decoration: none; display: block;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #f43f5e 100%); border-radius: 16px; padding: 24px;">
                  <tr>
                    <td>
                      <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 4px;">Get a Personalized Video ShoutOut</div>
                      <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 16px;">From top free-speech personalities — starting at $47</div>
                      <!-- Talent avatars table -->
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); padding-right: 4px;"></td>
                          <td width="40" height="40" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); text-align: center; vertical-align: middle;">
                            <span style="color: #ffffff; font-size: 10px; font-weight: 600;">+42</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0 0 8px 0;">
                  You subscribed to {{talent}} through ShoutOut.
                </p>
                <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0 0 16px 0;">
                  <a href="{{unsubscribe_url}}" style="color: rgba(255,255,255,0.4); text-decoration: underline;">Unsubscribe</a>
                  &nbsp;•&nbsp;
                  <a href="https://shoutout.us/privacy" style="color: rgba(255,255,255,0.4); text-decoration: underline;">Privacy Policy</a>
                </p>
                <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0 0 16px 0; opacity: 0.7;">
                  ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
                </p>
                <div style="margin-top: 8px;">
                  <a href="https://shoutout.us/creators" style="text-decoration: none; opacity: 0.6;">
                    <span style="color: rgba(255,255,255,0.4); font-size: 11px; margin-right: 8px; vertical-align: middle;">Powered by</span>
                    <img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" alt="ShoutOut" height="24" style="height: 24px; vertical-align: middle;">
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
</html>',
  3, -- 3 days after first email
  false,
  true
);

-- Verify the flow and messages
SELECT f.id, f.name, f.display_name, COUNT(m.id) as message_count
FROM email_flows f
LEFT JOIN email_flow_messages m ON m.flow_id = f.id
WHERE f.id = 'aaaa1111-1111-1111-1111-111111111111'
GROUP BY f.id, f.name, f.display_name;

