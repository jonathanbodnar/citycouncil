-- Add welcome SMS notification when talent completes onboarding
-- This sends a text with their profile URL and saves our number

-- Update the demo order trigger to also send a welcome SMS
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
  profile_url TEXT;
  welcome_message TEXT;
  excluded_talent_ids UUID[] := ARRAY[
    (SELECT id FROM talent_profiles WHERE full_name = 'Nick Di Palo'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Shawn Farash'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Gerald Morgan')
  ];
BEGIN
  -- Only run if onboarding was just completed
  IF NEW.onboarding_completed = true 
     AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false)
  THEN
    
    -- Get talent phone number for SMS
    SELECT phone INTO talent_phone
    FROM users
    WHERE id = NEW.user_id;
    
    -- Build profile URL
    profile_url := 'ShoutOut.us/' || NEW.username;
    
    -- Build welcome message with profile URL
    welcome_message := '🎉 Congrats on finishing your ShoutOut profile, add ' || profile_url || ' to your social bios! Also we''ll text you here with new orders and updates so please save this number.';
    
    -- Send welcome SMS if phone number exists
    IF talent_phone IS NOT NULL THEN
      BEGIN
        -- Call send-sms Edge Function via HTTP
        PERFORM net.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/send-sms',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
          ),
          body := jsonb_build_object(
            'to', talent_phone,
            'message', welcome_message
          )::text
        );
        
        RAISE NOTICE '📱 Welcome SMS sent to: %', talent_phone;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the trigger
          RAISE NOTICE '❌ Failed to send welcome SMS: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '⚠️ No phone number for talent, welcome SMS not sent';
    END IF;

    -- Only create demo order if talent is not in exclusion list and no demo order exists
    IF NOT (NEW.id = ANY(excluded_talent_ids))
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
        RAISE NOTICE '👤 Created demo customer user: %', demo_name;
      END IF;

      -- Create demo order
      INSERT INTO orders (
        id,
        user_id,
        talent_id,
        request_details,
        order_type,
        amount,
        admin_fee,
        status,
        fulfillment_deadline,
        payment_transaction_id,
        is_corporate,
        is_corporate_order,
        approval_status,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        demo_user_id,
        NEW.id,
        demo_request,
        'demo',
        1, -- $0.01 (stored in cents)
        0,
        'pending',
        NOW() + INTERVAL '48 hours',
        'DEMO_ORDER_' || NEW.id,
        false,
        false,
        'approved',
        NOW(),
        NOW()
      )
      RETURNING id INTO created_order_id;

      -- Create notification for talent
      INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        order_id,
        created_at,
        is_read
      ) VALUES (
        gen_random_uuid(),
        NEW.user_id,
        'order_placed',
        'Demo Order - Get Started!',
        'Hey ' || SPLIT_PART(NEW.full_name, ' ', 1) || ', here''s your demo order! Please fulfill it to activate live orders and start earning.',
        created_order_id,
        NOW(),
        false
      );

      -- Check if SMS is enabled for demo order notifications
      SELECT sms_enabled INTO sms_is_enabled
      FROM notification_settings
      WHERE notification_type = 'talent_new_order';
      
      -- Send demo order SMS notification if enabled
      IF talent_phone IS NOT NULL AND sms_is_enabled = true THEN
        BEGIN
          PERFORM net.http_post(
            url := current_setting('app.supabase_url', true) || '/functions/v1/send-sms',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
            ),
            body := jsonb_build_object(
              'to', talent_phone,
              'message', '🎬 New demo ShoutOut order! Check your dashboard to fulfill it: https://shoutout.us/orders'
            )::text
          );
          
          RAISE NOTICE '📱 Demo order SMS sent to: %', talent_phone;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '❌ Failed to send demo order SMS: %', SQLERRM;
        END;
      END IF;

      RAISE NOTICE '✅ Demo order created for talent: %', NEW.full_name;
    
    END IF;
  
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_talent_onboarded ON talent_profiles;

CREATE TRIGGER on_talent_onboarded
  AFTER UPDATE ON talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_demo_order_for_talent();

-- Test the function with a sample talent (optional - comment out if not testing)
-- SELECT 
--   tp.id,
--   tp.username,
--   tp.full_name,
--   tp.onboarding_completed,
--   u.phone
-- FROM talent_profiles tp
-- JOIN users u ON tp.user_id = u.id
-- WHERE tp.username = 'your-test-talent-username'
-- LIMIT 1;

SELECT '✅ Welcome SMS notification added to onboarding trigger!' AS status;
SELECT '📱 Talent will now receive:' AS info;
SELECT '   1. Welcome SMS with profile URL and save number reminder' AS step_1;
SELECT '   2. Demo order SMS notification (if enabled)' AS step_2;

