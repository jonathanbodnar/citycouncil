-- Fix the existing hellonew demo order to use proper demo customer

DO $$
DECLARE
  hellonew_talent_id UUID;
  demo_user_id UUID;
  demo_order_id UUID;
BEGIN
  -- Find hellonew talent
  SELECT id INTO hellonew_talent_id
  FROM talent_profiles
  WHERE full_name ILIKE '%hellonew%'
  LIMIT 1;

  IF hellonew_talent_id IS NULL THEN
    RAISE NOTICE '❌ Could not find hellonew talent';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found hellonew talent: %', hellonew_talent_id;

  -- Create or get demo customer "Michael Thompson"
  SELECT id INTO demo_user_id
  FROM users
  WHERE email = 'demo_customer_' || hellonew_talent_id || '@shoutout.us'
  LIMIT 1;

  IF demo_user_id IS NULL THEN
    demo_user_id := gen_random_uuid();
    INSERT INTO users (id, email, full_name, user_type, created_at, updated_at)
    VALUES (
      demo_user_id,
      'demo_customer_' || hellonew_talent_id || '@shoutout.us',
      'Michael Thompson',
      'user',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✅ Created demo customer: Michael Thompson (%)', demo_user_id;
  ELSE
    RAISE NOTICE '✅ Using existing demo customer: %', demo_user_id;
  END IF;

  -- Update the existing demo order to use the demo customer
  UPDATE orders
  SET user_id = demo_user_id
  WHERE talent_id = hellonew_talent_id
    AND order_type = 'demo'
  RETURNING id INTO demo_order_id;

  IF demo_order_id IS NOT NULL THEN
    RAISE NOTICE '✅ Updated demo order % to use demo customer Michael Thompson', demo_order_id;
  ELSE
    RAISE NOTICE '⚠️ No demo order found to update';
  END IF;

END $$;

-- Verify the update
SELECT 
  o.id,
  o.order_type,
  o.amount / 100.0 as amount_dollars,
  u.full_name as customer_name,
  u.email as customer_email,
  tp.full_name as talent_name
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%hellonew%'
  AND o.order_type = 'demo';

