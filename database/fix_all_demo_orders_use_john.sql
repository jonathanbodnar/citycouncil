-- FIX: Replace ALL existing demo orders to use john@example.com

-- 1. Show current demo orders (before fix)
SELECT 
  'BEFORE: Current Demo Orders' as status,
  o.id,
  o.order_type,
  o.amount,
  u.full_name as customer_name,
  u.email as customer_email,
  tp.full_name as talent_name
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.order_type = 'demo'
ORDER BY o.created_at DESC;

-- 2. Delete notifications for demo orders first (to avoid FK constraint)
DELETE FROM notifications 
WHERE order_id IN (
  SELECT id FROM orders WHERE order_type = 'demo'
);

-- 3. Delete ALL existing demo orders
DELETE FROM orders WHERE order_type = 'demo';

-- 4. Get list of all onboarded talents (excluding the 3 specific ones)
SELECT 
  'Talents that should have demo orders' as status,
  id,
  full_name,
  onboarding_completed
FROM talent_profiles
WHERE onboarding_completed = true
AND full_name NOT IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
ORDER BY full_name;

-- 5. Create demo orders for ALL eligible talents using john@example.com
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
)
SELECT 
  gen_random_uuid(),
  '585fd4ae-a372-4879-8e6e-190dce8509f8', -- john@example.com (John Smith)
  tp.id,
  'Wish my mother, Linda a happy 90th birthday! Make it heartfelt and mention how proud we are of her accomplishments.',
  'demo',
  1, -- $0.01
  0,
  'pending',
  NOW() + INTERVAL '48 hours',
  'DEMO_ORDER_' || tp.id,
  false,
  false,
  'approved',
  NOW(),
  NOW()
FROM talent_profiles tp
WHERE tp.onboarding_completed = true
AND tp.full_name NOT IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
AND NOT EXISTS (
  SELECT 1 FROM orders o2 
  WHERE o2.talent_id = tp.id 
  AND o2.order_type = 'demo'
)
RETURNING 
  id,
  talent_id;

-- 6. Create notifications for all these demo orders
INSERT INTO notifications (
  id,
  user_id,
  type,
  title,
  message,
  order_id,
  created_at,
  is_read
)
SELECT 
  gen_random_uuid(),
  tp.user_id,
  'order_placed',
  'Demo Order - Get Started!',
  'Hey ' || SPLIT_PART(tp.full_name, ' ', 1) || ', here''s your demo order! Please fulfill it to activate live orders and start earning.',
  o.id,
  NOW(),
  false
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.order_type = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM notifications n2 
  WHERE n2.order_id = o.id
)
RETURNING 
  id,
  user_id,
  type,
  title;

-- 7. Show final demo orders (after fix)
SELECT 
  'AFTER: All Demo Orders Now Use John Smith' as status,
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
ORDER BY tp.full_name;

