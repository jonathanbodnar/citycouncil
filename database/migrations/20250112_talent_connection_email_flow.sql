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
-- Note: {{talent_photo}} and {{talent}} will be replaced by process-email-flows
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); border-radius: 16px; overflow: hidden;">
          
          <!-- Header with Talent Photo -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px;">
              {{talent_photo_html}}
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 16px 0 8px;">{{talent}}</h1>
              <p style="color: #a0aec0; font-size: 14px; margin: 0;">You''re now connected!</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 30px 30px;">
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hey {{first_name}}! 👋
              </p>
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                You''re officially connected with <strong style="color: #ffffff;">{{talent}}</strong> on ShoutOut! This means you''ll be the first to know about:
              </p>
              <ul style="color: #e2e8f0; font-size: 16px; line-height: 1.8; margin: 0 0 25px; padding-left: 20px;">
                <li>New announcements and updates</li>
                <li>Exclusive offers and content</li>
                <li>Special events and appearances</li>
              </ul>
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Want a <strong style="color: #ffffff;">personalized video message</strong> from {{talent}}? Order a ShoutOut for yourself or as a unique gift for someone special!
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="{{talent_profile_link}}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                      Get a ShoutOut from {{talent}} →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px 30px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                Questions? Just reply to this email!<br>
                <a href="https://shoutout.us" style="color: #7c3aed; text-decoration: none;">ShoutOut</a> - Personalized videos from your favorite voices
              </p>
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); border-radius: 16px; overflow: hidden;">
          
          <!-- Header with Talent Photo -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px;">
              {{talent_photo_html}}
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 16px 0 8px;">{{talent}}</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 30px 30px;">
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hey {{first_name}}! 👋
              </p>
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Have you checked out <strong style="color: #ffffff;">{{talent}}</strong> on ShoutOut yet?
              </p>
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                A personalized video ShoutOut makes the perfect gift for:
              </p>
              <ul style="color: #e2e8f0; font-size: 16px; line-height: 1.8; margin: 0 0 25px; padding-left: 20px;">
                <li>🎂 Birthdays</li>
                <li>🎓 Graduations</li>
                <li>💪 Motivational boosts</li>
                <li>❤️ Just because!</li>
              </ul>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="{{talent_profile_link}}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                      Order Your ShoutOut →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px 30px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                <a href="https://shoutout.us" style="color: #7c3aed; text-decoration: none;">ShoutOut</a> - Personalized videos from your favorite voices
              </p>
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

