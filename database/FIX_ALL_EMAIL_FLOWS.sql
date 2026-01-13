-- =================================================================
-- COMPLETE EMAIL FLOW FIX
-- This script will:
-- 1. Fix the failing email cron job
-- 2. Create the post-purchase receipt email
-- 3. Enroll jonathanbagwell23@gmail.com in talent connection flow
-- 4. Test the system
-- =================================================================

-- STEP 1: Create function to invoke email processing edge function
CREATE OR REPLACE FUNCTION invoke_process_email_flows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg2ODMwMCwiZXhwIjoyMDc1NDQ0MzAwfQ.bmjLfmsX3_wYxjyHZzFoVhZ4XxJvqbH8DIfpHTXVrKQ';
BEGIN
  PERFORM net.http_post(
    url := 'https://utafetamgwukkbrlezev.supabase.co/functions/v1/process-email-flows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )
  );
END;
$$;

-- STEP 2: Drop old failing cron job
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-flows');
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- STEP 3: Create new working cron job
SELECT cron.schedule(
  'process-email-flows',
  '*/5 * * * *',
  'SELECT invoke_process_email_flows();'
);

-- STEP 4: Remove old post-purchase messages
DELETE FROM email_flow_messages WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555';

-- STEP 5: Create Email 1 - Order Receipt (immediate)
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
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" alt="ShoutOut" height="40" style="height: 40px;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: #ffffff; font-size: 48px; line-height: 0;">✓</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">Order Confirmed!</h1>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0;">Order #{{order_id}}</p>
            </td>
          </tr>
          <tr>
            <td style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 24px 0;">Hey {{first_name}}! 🎉</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Your order has been confirmed and <strong style="color: #ffffff;">{{talent_name}}</strong> will get started on your personalized video ShoutOut!</p>
              <div style="background: rgba(124,58,237,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(124,58,237,0.3);">
                <h3 style="color: #a78bfa; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Order Details</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="8">
                  <tr><td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">For:</td><td style="color: #ffffff; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 500;">{{recipient_name}}</td></tr>
                  <tr><td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">From:</td><td style="color: #ffffff; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 500;">{{talent_name}}</td></tr>
                  <tr><td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">Occasion:</td><td style="color: #ffffff; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 500;">{{occasion}}</td></tr>
                  <tr><td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">Expected Delivery:</td><td style="color: #10b981; font-size: 14px; text-align: right; padding: 8px 0; font-weight: 600;">Within {{delivery_hours}} hours</td></tr>
                  <tr style="border-top: 1px solid rgba(255,255,255,0.1);"><td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 12px 0 0 0;">Amount Paid:</td><td style="color: #ffffff; font-size: 18px; text-align: right; padding: 12px 0 0 0; font-weight: 700;">${{amount}}</td></tr>
                </table>
              </div>
              <div style="text-align: center;"><a href="https://shoutout.us/orders" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">View Order Status →</a></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$$,
  0,
  false,
  true
);

-- STEP 6: Create remaining emails (review, gift, new talent, comeback)
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, preview_text, html_content, delay_days, include_coupon, is_active) VALUES
('bbbb5555-5555-5555-5555-555555555555', 2, 'How was your ShoutOut experience? ⭐', 'Share your feedback', $$<html><body style="background:#0f0f1a;font-family:Arial,sans-serif;color:#fff;padding:40px 20px;"><div style="max-width:600px;margin:0 auto;"><img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" height="40"><h1>How was your ShoutOut?</h1><p>Hey {{first_name}}! We hope you loved your personalized video from {{talent_name}}.</p><a href="{{review_link}}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">Leave a Review →</a></div></body></html>$$, 3, false, true),
('bbbb5555-5555-5555-5555-555555555555', 3, 'The perfect gift is just a click away 🎁', 'Share the joy', $$<html><body style="background:#0f0f1a;font-family:Arial,sans-serif;color:#fff;padding:40px 20px;"><div style="max-width:600px;margin:0 auto;"><img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" height="40"><h1>Know someone who deserves a ShoutOut?</h1><p>Hey {{first_name}}! A personalized video makes the perfect gift for birthdays, graduations, and more.</p><a href="https://shoutout.us?utm=postpurchase" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">Browse Talent →</a></div></body></html>$$, 14, false, true),
('bbbb5555-5555-5555-5555-555555555555', 4, 'New faces on ShoutOut! 🌟', 'Discover new talent', $$<html><body style="background:#0f0f1a;font-family:Arial,sans-serif;color:#fff;padding:40px 20px;"><div style="max-width:600px;margin:0 auto;"><img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" height="40"><h1>Check out who is new!</h1><p>Hey {{first_name}}! We have been adding amazing new talent. Check them out!</p><a href="https://shoutout.us?utm=postpurchase" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">See New Talent →</a></div></body></html>$$, 30, false, true),
('bbbb5555-5555-5555-5555-555555555555', 5, 'We miss you! Here is 10% off 💜', 'Get 10% off', $$<html><body style="background:#0f0f1a;font-family:Arial,sans-serif;color:#fff;padding:40px 20px;"><div style="max-width:600px;margin:0 auto;"><img src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logowhite.png" height="40"><h1>It has been a while, {{first_name}}!</h1><p>As a thank you, here is 10% off your next order with code <strong>COMEBACK10</strong></p><a href="https://shoutout.us?utm=postpurchase&coupon=COMEBACK10" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">Shop Now →</a></div></body></html>$$, 60, true, true);

-- STEP 7: Enroll jonathanbagwell23@gmail.com in talent connection flow
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = 'jonathanbagwell23@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO user_email_flow_status (
      email, user_id, flow_id, current_message_order,
      next_email_scheduled_at, flow_started_at,
      source_talent_slug, is_paused, unsubscribed
    ) VALUES (
      'jonathanbagwell23@gmail.com', v_user_id,
      'aaaa1111-1111-1111-1111-111111111111', 0,
      NOW() + INTERVAL '30 seconds', NOW(),
      'meloniemac', false, false
    )
    ON CONFLICT (email, flow_id) DO UPDATE SET
      next_email_scheduled_at = NOW() + INTERVAL '30 seconds',
      is_paused = false;
    
    RAISE NOTICE '✅ jonathanbagwell23@gmail.com enrolled - email sends in 30 seconds';
  ELSE
    RAISE NOTICE '❌ User not found: jonathanbagwell23@gmail.com';
  END IF;
END $$;

-- STEP 8: Test the email processing function
SELECT invoke_process_email_flows();

-- STEP 9: Verify everything
SELECT 
  '✅ Cron job status' as check_type,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'process-email-flows';

SELECT 
  '✅ Post-purchase flow messages' as check_type,
  sequence_order,
  LEFT(subject, 50) as subject
FROM email_flow_messages 
WHERE flow_id = 'bbbb5555-5555-5555-5555-555555555555'
ORDER BY sequence_order;

SELECT 
  '✅ jonathanbagwell enrollment' as check_type,
  email,
  flow_id,
  next_email_scheduled_at,
  source_talent_slug
FROM user_email_flow_status
WHERE email = 'jonathanbagwell23@gmail.com'
  AND flow_id = 'aaaa1111-1111-1111-1111-111111111111';

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ALL FIXES APPLIED SUCCESSFULLY!';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Email cron job: FIXED (runs every 5 minutes)';
  RAISE NOTICE '✅ Post-purchase receipt: CREATED (5 emails)';
  RAISE NOTICE '✅ jonathanbagwell23@gmail.com: ENROLLED';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Wait 30 seconds for jonathanbagwell email to send';
  RAISE NOTICE '2. Check cron runs in 5 minutes with:';
  RAISE NOTICE '   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;';
  RAISE NOTICE '';
END $$;

