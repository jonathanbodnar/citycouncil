-- Debug why demo order wasn't created for hellonew

-- 1. Find the talent profile for hellonew
SELECT 
  id,
  full_name,
  user_id,
  onboarding_completed,
  is_active,
  created_at
FROM talent_profiles
WHERE full_name ILIKE '%hellonew%'
  OR id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    JOIN users u ON u.id = tp.user_id
    WHERE u.email ILIKE '%hellonew%'
  );

-- 2. Check if demo order exists for this talent
SELECT 
  o.id,
  o.talent_id,
  o.user_id,
  o.order_type,
  o.status,
  o.request_details,
  o.created_at,
  u.full_name as customer_name,
  u.email as customer_email
FROM orders o
LEFT JOIN users u ON u.id = o.user_id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE full_name ILIKE '%hellonew%'
    OR user_id IN (
      SELECT id FROM users WHERE email ILIKE '%hellonew%'
    )
)
ORDER BY o.created_at DESC;

-- 3. Check if hellonew is in the exclusion list
SELECT 
  tp.id,
  tp.full_name,
  CASE 
    WHEN tp.full_name = 'Nick Di Palo' THEN '❌ Excluded (Nick Di Palo)'
    WHEN tp.full_name = 'Shawn Farash' THEN '❌ Excluded (Shawn Farash)'
    WHEN tp.full_name = 'Gerald Morgan' THEN '❌ Excluded (Gerald Morgan)'
    ELSE '✅ Should get demo order'
  END as demo_order_status
FROM talent_profiles tp
WHERE tp.full_name ILIKE '%hellonew%'
  OR tp.user_id IN (
    SELECT id FROM users WHERE email ILIKE '%hellonew%'
  );

-- 4. Check demo order requests table
SELECT COUNT(*) as total_demo_requests FROM demo_order_requests;
SELECT COUNT(*) as total_demo_names FROM demo_customer_names;

-- 5. Manually trigger demo order creation for hellonew (if needed)
-- Get the talent ID first
DO $$
DECLARE
  talent_record RECORD;
  demo_user_id UUID;
  demo_request TEXT;
  demo_name TEXT;
  demo_email TEXT;
BEGIN
  -- Find hellonew talent
  SELECT tp.* INTO talent_record
  FROM talent_profiles tp
  LEFT JOIN users u ON u.id = tp.user_id
  WHERE tp.full_name ILIKE '%hellonew%'
    OR u.email ILIKE '%hellonew%'
  LIMIT 1;

  IF talent_record.id IS NOT NULL THEN
    RAISE NOTICE 'Found talent: % (ID: %)', talent_record.full_name, talent_record.id;
    
    -- Check if demo order already exists
    IF EXISTS (
      SELECT 1 FROM orders 
      WHERE talent_id = talent_record.id 
      AND order_type = 'demo'
    ) THEN
      RAISE NOTICE '⚠️ Demo order already exists for this talent';
    ELSE
      -- Get random request and name
      SELECT request INTO demo_request
      FROM demo_order_requests
      ORDER BY RANDOM()
      LIMIT 1;
      
      SELECT full_name INTO demo_name
      FROM demo_customer_names
      ORDER BY RANDOM()
      LIMIT 1;
      
      demo_email := 'demo_' || LOWER(REPLACE(demo_name, ' ', '')) || '@shoutout.us';
      
      -- Check if demo user exists
      SELECT id INTO demo_user_id
      FROM users
      WHERE email = demo_email
      LIMIT 1;
      
      -- Create demo user if doesn't exist
      IF demo_user_id IS NULL THEN
        INSERT INTO users (
          id, email, full_name, user_type, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), demo_email, demo_name, 'customer', NOW(), NOW()
        )
        RETURNING id INTO demo_user_id;
        RAISE NOTICE '✅ Created demo user: % (%)', demo_name, demo_email;
      END IF;
      
      -- Create demo order
      INSERT INTO orders (
        id, user_id, talent_id, request_details, order_type, 
        amount, status, fulfillment_deadline, created_at, updated_at,
        payment_transaction_id, is_corporate, approval_status
      ) VALUES (
        gen_random_uuid(), demo_user_id, talent_record.id, demo_request, 'demo',
        0, 'pending', NOW() + INTERVAL '48 hours', NOW(), NOW(),
        'DEMO_ORDER', false, 'approved'
      );
      
      -- Create notification
      INSERT INTO notifications (
        id, user_id, type, title, message, link, created_at, read
      ) VALUES (
        gen_random_uuid(), talent_record.user_id, 'order_received',
        'Demo Order - Get Started!',
        'Hey ' || SPLIT_PART(talent_record.full_name, ' ', 1) || ', here''s your demo order! Please fulfill it to activate live orders and start earning.',
        '/orders', NOW(), false
      );
      
      RAISE NOTICE '✅ Created demo order for %', talent_record.full_name;
    END IF;
  ELSE
    RAISE NOTICE '❌ Could not find talent matching "hellonew"';
  END IF;
END $$;

