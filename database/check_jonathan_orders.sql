-- Check all of Jonathan's orders to see which ones are broken

SELECT 
    'Jonathan Orders' as check,
    o.id,
    o.amount as amount_cents,
    o.amount / 100.0 as amount_dollars,
    o.status,
    o.created_at,
    p.order_amount as payout_base_price,
    p.admin_fee_percentage,
    p.payout_amount as talent_gets
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'jonathanbodnar'
ORDER BY o.created_at DESC;

-- Check jonathan's batches
SELECT 
    'Jonathan Batches' as check,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY pb.week_start_date DESC;
