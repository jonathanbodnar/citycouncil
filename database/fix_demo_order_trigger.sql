-- Fix demo order trigger - Remove ON CONFLICT clause that requires unique constraint
-- Error: "42P18: there is no unique or exclusion constraint matching the ON CONFLICT specification"

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
    
    -- Get random request and name
    SELECT request INTO demo_request
    FROM demo_order_requests
    ORDER BY RANDOM()
    LIMIT 1;
    
    SELECT full_name INTO demo_name
    FROM demo_customer_names
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- Generate demo email
    demo_email := 'demo_' || LOWER(REPLACE(demo_name, ' ', '')) || '@shoutout.us';
    
    -- Check if demo user already exists (by email check before insert)
    SELECT id INTO demo_user_id
    FROM users
    WHERE email = demo_email
    LIMIT 1;
    
    -- If demo user doesn't exist, create one
    IF demo_user_id IS NULL THEN
      INSERT INTO users (
        id,
        email,
        full_name,
        user_type,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        demo_email,
        demo_name,
        'customer',
        NOW(),
        NOW()
      )
      RETURNING id INTO demo_user_id;
    END IF;

  -- Create demo order
  INSERT INTO orders (
    id,
    user_id,
    talent_id,
    request,
    order_type,
    occasion,
    delivery_method,
    pricing,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    demo_user_id,
    NEW.id,
    demo_request,
    'demo',
    'Other',
    'email',
    0, -- Free demo order
    'pending',
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
SELECT 'Demo order trigger fixed - ON CONFLICT clause removed' AS status;

