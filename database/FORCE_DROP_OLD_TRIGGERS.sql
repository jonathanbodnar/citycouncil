-- FORCE DROP ALL OLD DEMO ORDER TRIGGERS
-- This will remove ANY conflicting triggers

-- Drop all triggers on talent_profiles that might be creating demo orders
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'talent_profiles' 
        AND tgname LIKE '%demo%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.tgname || ' ON talent_profiles CASCADE';
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- Drop old trigger functions
DROP FUNCTION IF EXISTS trigger_create_demo_order() CASCADE;
DROP FUNCTION IF EXISTS auto_create_demo_order() CASCADE;
DROP FUNCTION IF EXISTS create_demo_order() CASCADE;

-- Now recreate ONLY the correct trigger
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
  excluded_talent_ids UUID[] := ARRAY[
    (SELECT id FROM talent_profiles WHERE full_name = 'Nick Di Palo'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Shawn Farash'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Gerald Morgan')
  ];
BEGIN
  -- Only create demo order if:
  -- 1. Onboarding was just completed (from false/null to true)
  -- 2. Talent is not in exclusion list
  -- 3. No demo order exists yet
  IF NEW.onboarding_completed = true 
     AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false)
     AND NOT (NEW.id = ANY(excluded_talent_ids))
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
      RAISE NOTICE 'Created demo customer user: %', demo_name;
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
      1, -- $0.01
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

    -- Create notification
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

    -- Get talent phone number
    SELECT phone INTO talent_phone
    FROM users
    WHERE id = NEW.user_id;
    
    -- Check if SMS is enabled
    SELECT sms_enabled INTO sms_is_enabled
    FROM notification_settings
    WHERE notification_type = 'talent_new_order';
    
    -- Send SMS notification if conditions met
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
            'message', 'New demo ShoutOut order! Check your dashboard to fulfill it: https://shoutout.us/orders'
          )::text
        );
        
        RAISE NOTICE 'SMS sent to: %', talent_phone;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to send SMS: %', SQLERRM;
      END;
    END IF;

    RAISE NOTICE 'Demo order created for talent: %', NEW.full_name;
  
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_talent_onboarded
  AFTER UPDATE ON talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_demo_order_for_talent();

-- Verify only ONE trigger exists now
SELECT 
  'SUCCESS: Only one demo order trigger exists' as status,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'talent_profiles'::regclass
AND tgname = 'on_talent_onboarded';

