-- Check how order amounts are stored

-- 1. Check Josh's specific order
SELECT 
  o.id,
  o.amount as stored_amount,
  o.amount / 100 as amount_in_dollars,
  o.status,
  tp.username,
  tp.pricing as talent_pricing,
  COALESCE(u.full_name, tp.temp_full_name) as talent_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE COALESCE(u.full_name, tp.temp_full_name) ILIKE '%Josh%Firestine%'
  AND o.status = 'completed'
ORDER BY o.created_at DESC
LIMIT 5;

-- 2. Check the payout for this order
SELECT 
  p.order_id,
  p.order_amount as payout_order_amount,
  p.admin_fee_amount,
  p.payout_amount,
  p.admin_fee_percentage,
  o.amount as actual_order_amount,
  -- Check if amounts match
  CASE 
    WHEN p.order_amount = o.amount THEN '✅ Amounts match'
    WHEN p.order_amount = o.amount / 100 THEN '⚠️ Payout used dollars, order stored cents'
    WHEN p.order_amount * 100 = o.amount THEN '⚠️ Payout used cents, order stored dollars'
    ELSE '❌ MISMATCH'
  END as amount_comparison
FROM payouts p
JOIN orders o ON o.id = p.order_id
JOIN talent_profiles tp ON tp.id = p.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE COALESCE(u.full_name, tp.temp_full_name) ILIKE '%Josh%Firestine%'
ORDER BY p.created_at DESC
LIMIT 5;

-- 3. Sample of all orders to see storage pattern
SELECT 
  id,
  amount,
  status,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 10;

