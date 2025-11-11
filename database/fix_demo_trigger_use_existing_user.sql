-- FIX: Use existing user (john@example.com) for ALL demo orders
-- This avoids the self-referencing foreign key constraint issue

DROP FUNCTION IF EXISTS create_demo_order_for_talent() CASCADE;

CREATE OR REPLACE FUNCTION create_demo_order_for_talent()
RETURNS TRIGGER AS $$
DECLARE
  demo_user_id UUID := '585fd4ae-a372-4879-8e6e-190dce8509f8'; -- john@example.com (John Smith)
  demo_request TEXT;
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
    
    -- Hardcoded demo request
    demo_request := 'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.';
    
    -- Create demo order using existing user (john@example.com)
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
      demo_user_id, -- Using John Smith (john@example.com)
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

    RAISE NOTICE 'Demo order created for talent: % (using john@example.com as customer)', NEW.full_name;
  
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

-- Test it immediately for testingauto
DO $$
DECLARE
  testing_talent_id UUID;
BEGIN
  SELECT id INTO testing_talent_id
  FROM talent_profiles
  WHERE full_name ILIKE '%testingauto%'
  LIMIT 1;
  
  IF testing_talent_id IS NOT NULL THEN
    -- Reset and trigger
    UPDATE talent_profiles SET onboarding_completed = false WHERE id = testing_talent_id;
    UPDATE talent_profiles SET onboarding_completed = true WHERE id = testing_talent_id;
    
    -- Verify demo order was created
    IF EXISTS (SELECT 1 FROM orders WHERE talent_id = testing_talent_id AND order_type = 'demo') THEN
      RAISE NOTICE '✅ SUCCESS: Demo order created for testingauto!';
    ELSE
      RAISE NOTICE '❌ FAILED: Demo order was NOT created for testingauto';
    END IF;
  END IF;
END $$;

-- Show final result
SELECT 
  'Demo Orders' as check,
  o.id,
  o.order_type,
  o.amount,
  u.full_name as customer_name,
  u.email as customer_email,
  tp.full_name as talent_name,
  o.created_at
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.order_type = 'demo'
ORDER BY o.created_at DESC;

