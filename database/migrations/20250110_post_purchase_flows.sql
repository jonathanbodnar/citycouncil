-- Create Post-Purchase SMS Flow
-- Note: Using a new UUID since 44444444-... is already used for new_talent_announcement
INSERT INTO sms_flows (id, name, description, trigger_type, is_active, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'post_purchase',
  'SMS flow for customers who have placed an order',
  'order_complete',
  true,
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = true;

-- Post-Purchase SMS Messages (spaced out over time)
-- Message 1: 3 days after order - Thank you / review request
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, delay_days, is_active)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  1,
  'Thanks for your ShoutOut order! 🎉 We hope you loved it. Got a minute to leave a quick review? It helps others discover amazing talent! {{review_link}}',
  0,
  3, -- 3 days
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET message_text = EXCLUDED.message_text, delay_days = EXCLUDED.delay_days;

-- Message 2: 14 days after - Gift suggestion
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, delay_days, is_active)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  2,
  'Know someone who would love a personalized ShoutOut? 🎁 It makes the perfect gift for any occasion! Browse our talent: https://shoutout.us?utm=postpurchase',
  0,
  14, -- 14 days
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET message_text = EXCLUDED.message_text, delay_days = EXCLUDED.delay_days;

-- Message 3: 30 days - New talent announcement
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, delay_days, is_active)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  3,
  'We''ve added new talent to ShoutOut! 🌟 Check out who''s new and get your next personalized video: https://shoutout.us?utm=postpurchase',
  0,
  30, -- 30 days
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET message_text = EXCLUDED.message_text, delay_days = EXCLUDED.delay_days;

-- Message 4: 60 days - Come back offer
INSERT INTO sms_flow_messages (flow_id, sequence_order, message_text, delay_hours, delay_days, is_active)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  4,
  'Miss us? 😊 Here''s 10% off your next ShoutOut! Use code COMEBACK10 at checkout: https://shoutout.us?utm=postpurchase&coupon=COMEBACK10',
  0,
  60, -- 60 days
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET message_text = EXCLUDED.message_text, delay_days = EXCLUDED.delay_days;

-- Create Post-Purchase Email Flow
-- Use bbbb5555 since aaaa4444 already exists for order_followup
INSERT INTO email_flows (id, name, display_name, description, trigger_type, is_active, created_at)
VALUES (
  'bbbb5555-5555-5555-5555-555555555555',
  'post_purchase',
  '🛒 Post-Purchase Follow-up',
  'Email flow for customers who have placed an order',
  'order_complete',
  true,
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true;

-- Post-Purchase Email Messages
-- Email 1: 3 days after - Review request
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, html_content, delay_days, include_coupon, is_active)
VALUES (
  'bbbb5555-5555-5555-5555-555555555555',
  1,
  'How was your ShoutOut experience? ⭐',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #7c3aed;">Thanks for your order, {{first_name}}!</h2>
    <p>We hope you loved your personalized ShoutOut video! Your support means the world to us and our talent.</p>
    <p>Got a minute? We''d love to hear about your experience:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{review_link}}" style="background: linear-gradient(135deg, #7c3aed, #3b82f6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Leave a Review</a>
    </p>
    <p>Your feedback helps others discover the perfect talent for their special moments!</p>
    <p>Thank you,<br>The ShoutOut Team</p>
  </div>',
  3,
  false,
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content, delay_days = EXCLUDED.delay_days;

-- Email 2: 14 days - Gift suggestion
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, html_content, delay_days, include_coupon, is_active)
VALUES (
  'bbbb5555-5555-5555-5555-555555555555',
  2,
  'The perfect gift is just a click away 🎁',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #7c3aed;">Know someone who deserves a ShoutOut?</h2>
    <p>Hey {{first_name}},</p>
    <p>A personalized video ShoutOut makes the perfect gift for:</p>
    <ul>
      <li>🎂 Birthdays</li>
      <li>🎓 Graduations</li>
      <li>💼 Work celebrations</li>
      <li>❤️ Just because!</li>
    </ul>
    <p style="text-align: center; margin: 30px 0;">
      <a href="https://shoutout.us?utm=postpurchase" style="background: linear-gradient(135deg, #7c3aed, #3b82f6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Browse Talent</a>
    </p>
    <p>Spread the joy!</p>
    <p>The ShoutOut Team</p>
  </div>',
  14,
  false,
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content, delay_days = EXCLUDED.delay_days;

-- Email 3: 30 days - New talent
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, html_content, delay_days, include_coupon, is_active)
VALUES (
  'bbbb5555-5555-5555-5555-555555555555',
  3,
  'New faces on ShoutOut! 🌟',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #7c3aed;">Check out who''s new!</h2>
    <p>Hey {{first_name}},</p>
    <p>We''ve been busy adding amazing new talent to ShoutOut! From your favorite personalities to rising stars, there''s someone perfect for every occasion.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="https://shoutout.us?utm=postpurchase" style="background: linear-gradient(135deg, #7c3aed, #3b82f6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">See New Talent</a>
    </p>
    <p>The ShoutOut Team</p>
  </div>',
  30,
  false,
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content, delay_days = EXCLUDED.delay_days;

-- Email 4: 60 days - Come back with discount
INSERT INTO email_flow_messages (flow_id, sequence_order, subject, html_content, delay_days, include_coupon, coupon_code, is_active)
VALUES (
  'bbbb5555-5555-5555-5555-555555555555',
  4,
  'We miss you! Here''s 10% off 💜',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #7c3aed;">It''s been a while, {{first_name}}!</h2>
    <p>We miss seeing you around! As a thank you for being part of the ShoutOut family, here''s a special discount:</p>
    <div style="background: linear-gradient(135deg, #7c3aed, #3b82f6); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">Your exclusive code:</p>
      <p style="margin: 10px 0; font-size: 28px; font-weight: bold; letter-spacing: 2px;">COMEBACK10</p>
      <p style="margin: 0; font-size: 14px;">10% off your next order</p>
    </div>
    <p style="text-align: center; margin: 30px 0;">
      <a href="https://shoutout.us?utm=postpurchase&coupon=COMEBACK10" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Shop Now</a>
    </p>
    <p>See you soon!</p>
    <p>The ShoutOut Team</p>
  </div>',
  60,
  true,
  'COMEBACK10',
  true
) ON CONFLICT (flow_id, sequence_order) DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content, delay_days = EXCLUDED.delay_days, coupon_code = EXCLUDED.coupon_code;

-- Create the COMEBACK10 coupon if it doesn't exist
INSERT INTO coupons (code, discount_type, discount_value, description, is_active, max_uses)
VALUES ('COMEBACK10', 'percentage', 10, 'Post-purchase comeback discount', true, null)
ON CONFLICT (code) DO NOTHING;

