-- Fix Phillip G's order specifically for Jeremy Hambly
-- The order shows $27.78 but should show Jeremy's video price

-- Step 1: Find Jeremy's pricing (RUN THIS FIRST to see his price)
SELECT id, username, slug, pricing FROM talent_profiles 
WHERE username ILIKE '%hambly%' OR slug ILIKE '%hambly%' OR slug ILIKE '%quartering%';

-- Step 2: Find ALL orders for Jeremy (RUN THIS to see current state)
SELECT 
  o.id as order_id,
  o.amount,
  o.original_amount,
  o.coupon_code,
  o.status,
  u.full_name,
  o.created_at
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE username ILIKE '%hambly%' OR slug ILIKE '%hambly%' OR slug ILIKE '%quartering%'
)
ORDER BY o.created_at DESC;

-- Step 3: FORCE UPDATE using talent's actual pricing from database
-- This sets original_amount = talent.pricing * 100 * 1.029 (price + processing in cents)
UPDATE orders o
SET original_amount = ROUND(tp.pricing * 100 * 1.029)
FROM talent_profiles tp
WHERE o.talent_id = tp.id
AND (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
AND (o.original_amount IS NULL OR o.original_amount < 5000);

-- Step 4: Verify the update worked
SELECT 
  'AFTER UPDATE' as status,
  o.id as order_id,
  o.amount as paid_cents,
  o.original_amount as display_cents,
  (o.original_amount / 100.0) as display_dollars,
  o.coupon_code,
  u.full_name,
  tp.pricing as talent_price
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
ORDER BY o.created_at DESC;

-- Step 3: Verify the fix
SELECT 
  'AFTER FIX' as status,
  tp.username,
  tp.pricing as jeremy_pricing,
  o.id as order_id,
  o.amount as amount_cents,
  o.original_amount as original_amount_cents,
  (o.original_amount / 100.0) as display_price_dollars,
  o.coupon_code,
  u.full_name as customer_name
FROM talent_profiles tp
JOIN orders o ON o.talent_id = tp.id
JOIN users u ON u.id = o.user_id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
  AND u.full_name ILIKE '%phillip%'
ORDER BY o.created_at DESC;

-- Also check ALL of Jeremy's recent orders to make sure original_amount is set
SELECT 
  'ALL JEREMY ORDERS' as status,
  o.id::text as order_id,
  o.amount as amount_cents,
  o.original_amount,
  (o.original_amount / 100.0) as display_dollars,
  o.coupon_code,
  u.full_name,
  o.status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
JOIN users u ON u.id = o.user_id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
ORDER BY o.created_at DESC
LIMIT 10;

