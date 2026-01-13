-- Update Post-Purchase Email Flow to Start with Receipt
-- Delete existing messages and recreate with proper format and receipt first

-- Remove old messages
DELETE FROM email_flow_messages WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555';

-- Email 1: Order Receipt (sent immediately after order placement)
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, preview_text, html_content, delay_minutes, include_coupon, is_active) VALUES
(
  'bbbb5555-5555-5555-5555-555555555555',
  1,
  '✅ Your ShoutOut Order Confirmation',
  'Order #{{order_id}} - {{talent_name}} video ShoutOut',
  $$<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
          
          <!-- Success Icon -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: #ffffff; font-size: 48px; line-height: 0;">✓</span>
              </div>
            </td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">Order Confirmed!</h1>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0;">Order #{{order_id}}</p>
            </td>
          </tr>
          
          <!-- Main Content Card -->
          <tr>
            <td style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 24px 0;">
                Hey {{first_name}}! 🎉
              </p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Your order has been confirmed and <strong style="color: #ffffff;">{{talent_name}}</strong> will get started on your personalized video ShoutOut!
              </p>
              
              <!-- Order Details -->
              <div style="background: rgba(124,58,237,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(124,58,237,0.3);">
                <h3 style="color: #a78bfa; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Order Details</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="8">
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">For:</td>
                    <td style="color: #ffffff; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 500;">{{recipient_name}}</td>
                  </tr>
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">From:</td>
                    <td style="color: #ffffff; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 500;">{{talent_name}}</td>
                  </tr>
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">Occasion:</td>
                    <td style="color: #ffffff; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 500;">{{occasion}}</td>
                  </tr>
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">Expected Delivery:</td>
                    <td style="color: #10b981; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 600;">Within {{delivery_hours}} hours</td>
                  </tr>
                  <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 12px 0 0 0;">Amount Paid:</td>
                    <td style="color: #ffffff; font-size: 18px; text-align: right; padding: 12px 0 0 0; font-weight: 700;">${{amount}}</td>
                  </tr>
                </table>
              </div>
              
              <!-- What is Next -->
              <div style="background: rgba(59,130,246,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(59,130,246,0.3);">
                <h3 style="color: #60a5fa; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">What Happens Next?</h3>
                <ol style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">{{talent_name}}</strong> will create your personalized video</li>
                  <li style="margin-bottom: 8px;">You will receive an email as soon as it is ready</li>
                  <li>Download and share your ShoutOut video!</li>
                </ol>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="https://shoutout.us/orders" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  View Order Status →
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
          
          <!-- General ShoutOut Promo Card -->
          <tr>
            <td style="padding-top: 16px;">
              <a href="https://shoutout.us?utm=order_receipt" target="_blank" style="text-decoration: none; display: block;">
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
                  You received this email because you placed an order on ShoutOut.
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
</html>$$,
  0, -- Send immediately
  false,
  true
);

-- Verification query
SELECT 
  sequence_order,
  subject,
  LEFT(html_content, 50) as content_preview
FROM email_flow_messages
WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555'
ORDER BY sequence_order
LIMIT 1;

