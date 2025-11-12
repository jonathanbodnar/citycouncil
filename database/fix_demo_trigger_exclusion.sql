-- Fix demo order trigger to handle missing excluded talent gracefully

DROP FUNCTION IF EXISTS create_demo_order_for_talent() CASCADE;

CREATE OR REPLACE FUNCTION create_demo_order_for_talent()
RETURNS TRIGGER AS $$
DECLARE
  demo_user_id UUID;
  demo_request TEXT;
  demo_name TEXT;
  demo_email TEXT;
  created_order_id UUID;
  talent_phone TEXT;
  sms_is_enabled BOOLEAN;
BEGIN
  -- Only create demo order if:
  -- 1. Onboarding was just completed (from false/null to true)
  -- 2. Talent is not in exclusion list (by full_name)
  -- 3. No demo order exists yet
  IF NEW.onboarding_completed = true 
     AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false)
     -- Exclude by name (handles missing talent gracefully)
     AND NEW.full_name NOT IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
     AND NOT EXISTS (
       SELECT 1 FROM orders 
       WHERE talent_id = NEW.id 
       AND order_type = 'demo'
     ) THEN
    
    -- Hardcoded demo data
    demo_request := 'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.';
    demo_name := 'Michael Thompson';
    demo_email := 'demo_customer_' || NEW.id || '@shoutout.us';
    
    -- Check if demo user already exists
    SELECT id INTO demo_user_id
    FROM users
    WHERE email = demo_email
    LIMIT 1;
    
    -- Create a dedicated demo customer user if doesn't exist
    IF demo_user_id IS NULL THEN
      demo_user_id := gen_random_uuid();
      INSERT INTO users (id, email, full_name, user_type, created_at, updated_at)
      VALUES (
        demo_user_id, demo_email, demo_name, 'user', NOW(), NOW()
      );
    END IF;
    
    -- Create the demo order
    INSERT INTO orders (
      user_id,
      talent_id,
      recipient_name,
      request_details,
      amount,
      admin_fee,
      payment_transaction_id,
      status,
      order_type,
      is_corporate,
      fulfillment_deadline,
      approval_status,
      created_at,
      updated_at
    ) VALUES (
      demo_user_id,
      NEW.id,
      'Linda', -- recipient_name
      demo_request,
      1, -- $0.01 to satisfy check constraint
      0,
      'DEMO_ORDER_' || NEW.id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
      'pending',
      'demo',
      false,
      NOW() + INTERVAL '72 hours',
      'pending',
      NOW(),
      NOW()
    ) RETURNING id INTO created_order_id;
    
    -- Create notification for the talent
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      order_id,
      is_read,
      created_at
    ) VALUES (
      NEW.user_id,
      'order_placed',
      'Demo Order Received! 🎬',
      'Complete your first demo order to get familiar with the fulfillment process.',
      created_order_id,
      false,
      NOW()
    );
    
    -- Send SMS notification to talent if SMS is enabled
    BEGIN
      -- Get talent's phone number
      SELECT phone INTO talent_phone
      FROM users
      WHERE id = NEW.user_id;
      
      -- Check if SMS notifications are enabled for this type
      SELECT notification_settings.sms_enabled INTO sms_is_enabled
      FROM notification_settings
      WHERE notification_type = 'order_placed';
      
      -- Send SMS if phone exists and SMS is enabled
      IF talent_phone IS NOT NULL AND sms_is_enabled = true THEN
        -- Call send-sms Edge Function via pg_net
        PERFORM net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/send-sms',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
          ),
          body := jsonb_build_object(
            'to', talent_phone,
            'orderId', created_order_id,
            'notificationType', 'order_placed'
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the trigger
      RAISE NOTICE 'Failed to send SMS notification: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Demo order created for talent: % (ID: %)', NEW.full_name, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_talent_onboarded ON talent_profiles;

CREATE TRIGGER on_talent_onboarded
  AFTER UPDATE ON talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_demo_order_for_talent();

-- Verify the trigger was created
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  'Trigger recreated successfully' AS status
FROM pg_trigger
WHERE tgname = 'on_talent_onboarded';

