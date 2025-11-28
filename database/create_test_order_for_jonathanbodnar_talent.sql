-- Create a test order for jonathanbodnar TALENT to upload video
-- Customer will be a different user, jonathanbodnar will be the talent

-- Get jonathanbodnar's user and talent IDs
SELECT 
  'JONATHANBODNAR INFO' as info,
  u.id as user_id,
  u.email,
  u.full_name,
  tp.id as talent_id,
  tp.temp_full_name
FROM users u
LEFT JOIN talent_profiles tp ON tp.user_id = u.id
WHERE u.email LIKE '%jb@apollo%' OR u.email LIKE '%jonathanbodnar%'
LIMIT 1;

-- Find a test customer (or we'll create one)
SELECT 
  'TEST CUSTOMER' as info,
  id as user_id,
  email,
  full_name
FROM users
WHERE user_type = 'user'
  AND id != (SELECT id FROM users WHERE email LIKE '%jb@apollo%' OR email LIKE '%jonathanbodnar%' LIMIT 1)
ORDER BY created_at DESC
LIMIT 1;

-- Create test order with jonathanbodnar as the TALENT
INSERT INTO orders (
  user_id,
  talent_id,
  request_details,
  amount,
  admin_fee,
  charity_amount,
  fulfillment_deadline,
  payment_transaction_id,
  status,
  approval_status,
  approved_at,
  is_corporate,
  is_corporate_order,
  allow_promotional_use,
  created_at
)
VALUES (
  -- Use first available regular user as customer, or use a placeholder
  COALESCE(
    (SELECT id FROM users WHERE user_type = 'user' AND email NOT LIKE '%jb@apollo%' ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM users WHERE email LIKE '%jb@apollo%' OR email LIKE '%jonathanbodnar%' LIMIT 1)
  ),
  -- jonathanbodnar's talent profile
  (SELECT id FROM talent_profiles WHERE user_id = (
    SELECT id FROM users WHERE email LIKE '%jb@apollo%' OR email LIKE '%jonathanbodnar%' LIMIT 1
  )),
  'TEST ORDER FOR VIDEO UPLOAD - Please upload a test video to complete this order. This is for testing the upload functionality.',
  10000, -- $100.00 in cents
  2500, -- 25% admin fee = $25.00
  0, -- No charity
  NOW() + INTERVAL '48 hours',
  'TEST_UPLOAD_JB_' || gen_random_uuid()::text,
  'pending',
  'approved',
  NOW(),
  false,
  false,
  true,
  NOW()
)
RETURNING 
  id as order_id,
  '✅ Test order created!' as status,
  created_at;

-- Verify the order
SELECT 
  'TEST ORDER FOR JONATHANBODNAR TO UPLOAD' as info,
  o.id as order_id,
  o.status,
  o.amount / 100.0 as amount_dollars,
  o.request_details,
  o.created_at,
  u.email as customer_email,
  u.full_name as customer_name,
  t.temp_full_name as talent_name,
  tu.email as talent_email
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN talent_profiles t ON o.talent_id = t.id
JOIN users tu ON t.user_id = tu.id
WHERE o.talent_id = (
  SELECT id FROM talent_profiles WHERE user_id = (
    SELECT id FROM users WHERE email LIKE '%jb@apollo%' OR email LIKE '%jonathanbodnar%' LIMIT 1
  )
)
  AND o.payment_transaction_id LIKE 'TEST_UPLOAD_JB_%'
ORDER BY o.created_at DESC
LIMIT 1;

-- Final message
SELECT 
  '✅ SUCCESS!' as result,
  'Log in as jonathanbodnar talent account' as step_1,
  'Go to talent dashboard' as step_2,
  'You will see this pending order' as step_3,
  'Upload a video to test the upload functionality' as step_4;

