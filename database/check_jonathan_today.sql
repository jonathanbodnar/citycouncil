-- Check all of Jonathan's orders from today
SELECT 
    o.id as order_id,
    o.amount as order_cents,
    (o.amount / 100.0) as order_dollars,
    (o.amount / 100.0 / 1.029) as base_price,
    o.created_at,
    o.status,
    p.order_amount as payout_order_amount,
    p.admin_fee_percentage,
    p.payout_amount
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'jonathanbodnar'
  AND o.created_at::date = CURRENT_DATE
ORDER BY o.created_at;

-- Check Jonathan's talent profile
SELECT 
    username,
    first_orders_promo_active,
    fulfilled_orders,
    admin_fee_percentage
FROM talent_profiles
WHERE username = 'jonathanbodnar';

-- Count Jonathan's completed orders before today
SELECT 
    COUNT(*) as orders_before_today
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'jonathanbodnar'
  AND o.status = 'completed'
  AND o.created_at::date < CURRENT_DATE;

