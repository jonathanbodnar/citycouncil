-- Find ALL of Hayley's orders regardless of status

SELECT 
    'All Hayley Orders' as check,
    o.id,
    o.status,
    o.amount / 100.0 as order_amount_dollars,
    o.admin_fee / 100.0 as admin_fee_dollars,
    o.created_at,
    o.updated_at,
    CASE WHEN p.id IS NOT NULL THEN 'Has Payout' ELSE 'No Payout' END as payout_status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'hayleycaronia'
ORDER BY o.created_at DESC;

-- Check payout_batches for Hayley
SELECT 
    'Hayley Batches' as check,
    pb.id,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'hayleycaronia'
ORDER BY pb.week_start_date DESC;

-- Check all payouts for Hayley
SELECT 
    'Hayley Payouts' as check,
    p.id,
    p.order_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.is_refunded,
    p.created_at,
    o.status as order_status
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
LEFT JOIN orders o ON o.id = p.order_id
WHERE tp.username = 'hayleycaronia'
ORDER BY p.created_at DESC;

