-- Create a test order for jb@apollo.inc (jonathanbodnar) to test video upload

-- Get user and talent IDs
SELECT 
  'USER INFO' as info,
  id as user_id,
  email,
  full_name
FROM users
WHERE email = 'jb@apollo.inc';

-- Get JP Sears talent info (assuming you want to test uploading as JP)
SELECT 
  'JP SEARS TALENT INFO' as info,
  id as talent_id,
  temp_full_name,
  user_id,
  pricing
FROM talent_profiles
WHERE temp_full_name ILIKE '%jp%sears%';

-- Create test order
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
SELECT 
  (SELECT id FROM users WHERE email = 'jb@apollo.inc'),
  (SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%' LIMIT 1),
  'TEST ORDER - Testing video upload functionality. This is a test message for JP Sears to create a ShoutOut video.',
  4700, -- $47.00 in cents (JP's base price)
  1175, -- 25% admin fee = $11.75
  0, -- No charity
  NOW() + INTERVAL '48 hours', -- 48 hours from now
  'TEST_UPLOAD_' || gen_random_uuid()::text,
  'pending',
  'approved',
  NOW(),
  false,
  false,
  true,
  NOW()
RETURNING 
  id as order_id,
  'Test order created!' as status,
  created_at;

-- Verify the order was created
SELECT 
  'TEST ORDER DETAILS' as info,
  o.id,
  o.status,
  o.amount / 100.0 as amount_dollars,
  o.request_details,
  o.created_at,
  u.email as customer_email,
  u.full_name as customer_name,
  t.temp_full_name as talent_name
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.user_id = (SELECT id FROM users WHERE email = 'jb@apollo.inc')
  AND o.payment_transaction_id LIKE 'TEST_UPLOAD_%'
ORDER BY o.created_at DESC
LIMIT 1;

-- Show message
SELECT 
  '✅ Test order created successfully!' as result,
  'jb@apollo.inc can now see this order in their dashboard' as note,
  'JP Sears can now upload a video for this order' as action;

