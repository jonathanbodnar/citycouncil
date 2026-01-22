-- Add Express Delivery Reminder Notification Type
-- For 24hr express orders, send reminder 6 hours before deadline

-- Add notification setting for express delivery deadline reminder
INSERT INTO notification_settings (notification_type, display_name, description, sms_enabled, sms_template)
VALUES 
  ('talent_express_deadline', 'Talent: Express Order Deadline', 'SMS sent to talent 6 hours before express order deadline', true, 'Hey {{first_name}}, your ⚡ EXPRESS ShoutOut order is due in 6 hours! Complete it here: {{order_link}}')
ON CONFLICT (notification_type) DO UPDATE SET
  sms_enabled = true,
  sms_template = 'Hey {{first_name}}, your ⚡ EXPRESS ShoutOut order is due in 6 hours! Complete it here: {{order_link}}';

-- Create or update the deadline reminder cron job
-- This job checks for orders with approaching deadlines and sends reminders
-- For express orders: send 6 hours before deadline
-- For regular orders: send 24 hours before deadline

-- First, let's create a function to send deadline reminders
CREATE OR REPLACE FUNCTION send_deadline_reminders()
RETURNS void AS $$
DECLARE
  order_record RECORD;
  talent_phone TEXT;
  talent_name TEXT;
  hours_left INT;
  short_link TEXT;
  message_text TEXT;
BEGIN
  -- Process express orders (6 hours before deadline)
  FOR order_record IN
    SELECT o.*, tp.user_id as talent_user_id
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    WHERE o.status IN ('pending', 'in_progress')
      AND o.is_express_delivery = true
      AND o.fulfillment_deadline > NOW()
      AND o.fulfillment_deadline <= NOW() + INTERVAL '6 hours'
      AND NOT EXISTS (
        SELECT 1 FROM sms_send_log 
        WHERE metadata->>'order_id' = o.id::text 
          AND metadata->>'reminder_type' = 'express_6hr'
          AND sent_at > NOW() - INTERVAL '5 hours' -- Don't send duplicate within 5 hours
      )
  LOOP
    -- Get talent phone and name
    SELECT u.phone, u.full_name INTO talent_phone, talent_name
    FROM users u
    WHERE u.id = order_record.talent_user_id
      AND u.phone IS NOT NULL;
    
    IF talent_phone IS NOT NULL THEN
      -- Get short link if exists
      SELECT short_code INTO short_link
      FROM short_links
      WHERE order_id = order_record.id
      ORDER BY created_at DESC
      LIMIT 1;
      
      hours_left := EXTRACT(EPOCH FROM (order_record.fulfillment_deadline - NOW())) / 3600;
      
      -- Log the SMS send attempt
      INSERT INTO sms_send_log (phone, user_id, message_text, status, metadata)
      VALUES (
        talent_phone,
        order_record.talent_user_id,
        'Express deadline reminder sent',
        'pending',
        jsonb_build_object(
          'order_id', order_record.id,
          'reminder_type', 'express_6hr',
          'hours_left', hours_left
        )
      );
      
      RAISE NOTICE 'Express deadline reminder queued for order % (% hours left)', order_record.id, hours_left;
    END IF;
  END LOOP;
  
  -- Process regular orders (24 hours before deadline) - existing behavior
  FOR order_record IN
    SELECT o.*, tp.user_id as talent_user_id
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    WHERE o.status IN ('pending', 'in_progress')
      AND (o.is_express_delivery IS NULL OR o.is_express_delivery = false)
      AND o.fulfillment_deadline > NOW()
      AND o.fulfillment_deadline <= NOW() + INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM sms_send_log 
        WHERE metadata->>'order_id' = o.id::text 
          AND metadata->>'reminder_type' = 'deadline_24hr'
          AND sent_at > NOW() - INTERVAL '12 hours' -- Don't send duplicate within 12 hours
      )
  LOOP
    -- Get talent phone
    SELECT u.phone INTO talent_phone
    FROM users u
    WHERE u.id = order_record.talent_user_id
      AND u.phone IS NOT NULL;
    
    IF talent_phone IS NOT NULL THEN
      hours_left := EXTRACT(EPOCH FROM (order_record.fulfillment_deadline - NOW())) / 3600;
      
      -- Log the SMS send attempt
      INSERT INTO sms_send_log (phone, user_id, message_text, status, metadata)
      VALUES (
        talent_phone,
        order_record.talent_user_id,
        'Deadline reminder sent',
        'pending',
        jsonb_build_object(
          'order_id', order_record.id,
          'reminder_type', 'deadline_24hr',
          'hours_left', hours_left
        )
      );
      
      RAISE NOTICE 'Deadline reminder queued for order % (% hours left)', order_record.id, hours_left;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule the reminder check to run every hour
-- Note: This requires pg_cron extension to be enabled
SELECT cron.schedule(
  'send-deadline-reminders',
  '0 * * * *',  -- Every hour on the hour
  $$SELECT send_deadline_reminders()$$
);

-- Update existing talent_deadline_approaching template to clarify it's for regular orders
UPDATE notification_settings 
SET description = 'SMS sent to talent 24 hours before regular order deadline'
WHERE notification_type = 'talent_deadline_approaching';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
