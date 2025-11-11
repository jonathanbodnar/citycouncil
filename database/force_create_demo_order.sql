-- Force create a demo order for hellonew with detailed logging

DO $$
DECLARE
  talent_record RECORD;
  demo_user_id UUID;
  demo_request TEXT := 'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.';
  new_order_id UUID;
BEGIN
  -- Find hellonew talent
  SELECT * INTO talent_record
  FROM talent_profiles
  WHERE full_name ILIKE '%hellonew%'
  OR id IN (
    SELECT tp.id FROM talent_profiles tp
    JOIN users u ON u.id = tp.user_id
    WHERE u.full_name ILIKE '%hellonew%' OR u.email ILIKE '%hellonew%'
  )
  LIMIT 1;

  IF talent_record.id IS NULL THEN
    RAISE NOTICE '❌ Could not find hellonew talent';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found talent: % (ID: %, user_id: %, onboarding_completed: %)', 
    talent_record.full_name, talent_record.id, talent_record.user_id, talent_record.onboarding_completed;
  
  -- Check if demo order already exists
  IF EXISTS (
    SELECT 1 FROM orders 
    WHERE talent_id = talent_record.id 
    AND order_type = 'demo'
  ) THEN
    RAISE NOTICE '⚠️ Demo order ALREADY EXISTS for this talent!';
    RAISE NOTICE 'Deleting existing demo order to create a fresh one...';
    DELETE FROM orders WHERE talent_id = talent_record.id AND order_type = 'demo';
  END IF;

  -- Find ANY existing user to use as demo customer
  SELECT id INTO demo_user_id
  FROM users
  WHERE id != talent_record.user_id
  LIMIT 1;
  
  IF demo_user_id IS NULL THEN
    RAISE NOTICE '❌ No existing users found to use as demo customer!';
    RAISE NOTICE 'Creating a demo user...';
    
    -- Create a simple demo user
    demo_user_id := gen_random_uuid();
    INSERT INTO users (id, email, full_name, user_type, created_at, updated_at)
    VALUES (
      demo_user_id,
      'demo_' || talent_record.id || '@shoutout.us',
      'Demo Customer',
      'user',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✅ Created demo user: %', demo_user_id;
  ELSE
    RAISE NOTICE '✅ Using existing user as demo customer: %', demo_user_id;
  END IF;
  
  -- Create demo order
  RAISE NOTICE 'Creating demo order...';
  INSERT INTO orders (
    id, user_id, talent_id, request_details, order_type, 
    amount, admin_fee, status, fulfillment_deadline,
    payment_transaction_id, is_corporate, is_corporate_order,
    approval_status, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), demo_user_id, talent_record.id, demo_request, 'demo',
    1, 0, 'pending', NOW() + INTERVAL '48 hours',
    'DEMO_ORDER_' || talent_record.id, false, false,
    'approved', NOW(), NOW()
  )
  RETURNING id INTO new_order_id;
  
  RAISE NOTICE '✅ Created demo order (ID: %)', new_order_id;
  
  -- Create notification
  INSERT INTO notifications (
    id, user_id, type, title, message, order_id, created_at, is_read
  ) VALUES (
    gen_random_uuid(), talent_record.user_id, 'order_placed',
    'Demo Order - Get Started!',
    'Hey ' || COALESCE(SPLIT_PART(talent_record.full_name, ' ', 1), 'there') || ', here''s your demo order! Please fulfill it to activate live orders and start earning.',
    new_order_id, NOW(), false
  );
  
  RAISE NOTICE '✅ Created notification for talent';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 SUCCESS! Demo order created for %', talent_record.full_name;
  
END $$;

-- Show the created order
SELECT 
  o.id,
  o.order_type,
  o.status,
  o.amount,
  o.request_details,
  o.created_at,
  tp.full_name as talent_name,
  u.full_name as customer_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
JOIN users u ON u.id = o.user_id
WHERE o.order_type = 'demo'
  AND tp.full_name ILIKE '%hellonew%'
ORDER BY o.created_at DESC
LIMIT 1;

