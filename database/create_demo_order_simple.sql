-- Simple script to create a demo order for hellonew talent

DO $$
DECLARE
  talent_record RECORD;
  demo_user_id UUID;
  demo_request TEXT := 'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.';
  demo_name TEXT := 'Michael Thompson';
  demo_email TEXT := 'demo_michaelthompson@shoutout.us';
  new_order_id UUID;
BEGIN
  -- Find hellonew talent
  SELECT tp.* INTO talent_record
  FROM talent_profiles tp
  LEFT JOIN users u ON u.id = tp.user_id
  WHERE tp.full_name ILIKE '%hellonew%'
    OR u.email ILIKE '%hellonew%'
    OR u.full_name ILIKE '%hellonew%'
  LIMIT 1;

  IF talent_record.id IS NULL THEN
    RAISE NOTICE '❌ Could not find talent matching "hellonew"';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found talent: % (ID: %)', talent_record.full_name, talent_record.id;
  
  -- Check if demo order already exists
  IF EXISTS (
    SELECT 1 FROM orders 
    WHERE talent_id = talent_record.id 
    AND order_type = 'demo'
  ) THEN
    RAISE NOTICE '⚠️ Demo order already exists for this talent';
    RETURN;
  END IF;

  -- Check if demo user exists
  SELECT id INTO demo_user_id
  FROM users
  WHERE email = demo_email
  LIMIT 1;
  
  -- Create demo user if doesn't exist
  IF demo_user_id IS NULL THEN
    -- Generate a UUID for the demo user
    demo_user_id := gen_random_uuid();
    
    -- Insert without foreign key constraint issues
    INSERT INTO users (
      id, email, full_name, user_type, created_at, updated_at
    ) VALUES (
      demo_user_id, demo_email, demo_name, 'user', NOW(), NOW()
    );
    RAISE NOTICE '✅ Created demo user: % (% - ID: %)', demo_name, demo_email, demo_user_id;
  ELSE
    RAISE NOTICE '✅ Using existing demo user: % (% - ID: %)', demo_name, demo_email, demo_user_id;
  END IF;
  
  -- Create demo order
  INSERT INTO orders (
    id, user_id, talent_id, request_details, order_type, 
    amount, admin_fee, status, fulfillment_deadline, created_at, updated_at,
    payment_transaction_id, is_corporate, approval_status, is_corporate_order
  ) VALUES (
    gen_random_uuid(), demo_user_id, talent_record.id, demo_request, 'demo',
    0, 0, 'pending', NOW() + INTERVAL '48 hours', NOW(), NOW(),
    'DEMO_ORDER_' || talent_record.id, false, 'approved', false
  )
  RETURNING id INTO new_order_id;
  
  RAISE NOTICE '✅ Created demo order (ID: %)', new_order_id;
  
  -- Create notification
  INSERT INTO notifications (
    id, user_id, type, title, message, link, created_at, read
  ) VALUES (
    gen_random_uuid(), talent_record.user_id, 'order_received',
    'Demo Order - Get Started!',
    'Hey ' || COALESCE(SPLIT_PART(talent_record.full_name, ' ', 1), 'there') || ', here''s your demo order! Please fulfill it to activate live orders and start earning.',
    '/orders', NOW(), false
  );
  
  RAISE NOTICE '✅ Created notification for talent user_id: %', talent_record.user_id;
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Demo order created successfully for %!', talent_record.full_name;
  RAISE NOTICE '📧 Customer: %', demo_name;
  RAISE NOTICE '📝 Request: %', demo_request;
  
END $$;

-- Verify the order was created
SELECT 
  o.id,
  o.order_type,
  o.status,
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

