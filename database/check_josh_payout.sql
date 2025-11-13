-- Check Josh Firestine's payout details

-- 1. Find Josh's talent profile and admin fee
SELECT 
  tp.id,
  tp.username,
  COALESCE(u.full_name, tp.temp_full_name) as full_name,
  tp.admin_fee_percentage,
  tp.pricing
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
WHERE COALESCE(u.full_name, tp.temp_full_name) ILIKE '%Josh%Firestine%'
   OR tp.username ILIKE '%josh%firestine%';

-- 2. Check recent completed orders for Josh
SELECT 
  o.id,
  o.amount as order_amount,
  o.status,
  o.video_url IS NOT NULL as has_video,
  o.created_at,
  o.updated_at,
  tp.username,
  tp.admin_fee_percentage
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE (COALESCE(u.full_name, tp.temp_full_name) ILIKE '%Josh%Firestine%'
   OR tp.username ILIKE '%josh%firestine%')
  AND o.status IN ('completed', 'refunded')
ORDER BY o.updated_at DESC
LIMIT 5;

-- 3. Check payouts for Josh
SELECT 
  p.id,
  p.order_id,
  p.order_amount,
  p.admin_fee_percentage,
  p.admin_fee_amount,
  p.payout_amount,
  p.status,
  p.is_refunded,
  p.created_at,
  -- Verify calculation
  p.order_amount * (p.admin_fee_percentage / 100) as calculated_admin_fee,
  p.order_amount - (p.order_amount * (p.admin_fee_percentage / 100)) as calculated_payout
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE COALESCE(u.full_name, tp.temp_full_name) ILIKE '%Josh%Firestine%'
   OR tp.username ILIKE '%josh%firestine%'
ORDER BY p.created_at DESC
LIMIT 5;

