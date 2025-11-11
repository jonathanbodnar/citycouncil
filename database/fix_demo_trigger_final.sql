-- FINAL FIX: Update demo order trigger with correct column names and constraints

DROP FUNCTION IF EXISTS create_demo_order_for_talent() CASCADE;

CREATE OR REPLACE FUNCTION create_demo_order_for_talent()
RETURNS TRIGGER AS $$
DECLARE
  demo_user_id UUID;
  demo_request TEXT;
  demo_name TEXT;
  demo_email TEXT;
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
    
    -- Hardcoded demo data (since demo tables don't exist)
    demo_request := 'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.';
    demo_name := 'Michael Thompson';
    demo_email := 'demo_order_customer@shoutout.us';
    
    -- Use an existing user as demo customer (to avoid FK constraint issues)
    SELECT id INTO demo_user_id
    FROM users
    WHERE user_type = 'user'
      AND id != NEW.user_id
    LIMIT 1;
    
    -- If no existing user, just skip demo order creation
    IF demo_user_id IS NULL THEN
      RAISE NOTICE 'No existing users to use as demo customer, skipping demo order';
      RETURN NEW;
    END IF;

    -- Create demo order with correct column names and 0.01 amount (to pass check constraint)
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
      0.01, -- Minimum amount to pass check constraint
      0,
      'pending',
      NOW() + INTERVAL '48 hours',
      'DEMO_ORDER_' || NEW.id,
      false,
      false,
      'approved',
      NOW(),
      NOW()
    );

    -- Create notification for talent
    INSERT INTO notifications (
      id,
      user_id,
      type,
      title,
      message,
      link,
      created_at,
      read
    ) VALUES (
      gen_random_uuid(),
      NEW.user_id,
      'order_received',
      'Demo Order - Get Started!',
      'Hey ' || SPLIT_PART(NEW.full_name, ' ', 1) || ', here''s your demo order! Please fulfill it to activate live orders and start earning.',
      '/orders',
      NOW(),
      false
    );

    RAISE NOTICE 'Demo order created for talent: %', NEW.full_name;
  
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

-- Verification
SELECT 'Demo order trigger updated with correct column names!' AS status;

