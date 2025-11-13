-- Check Jonathan's payout data to see why it's not showing in the dashboard

-- 1. Get Jonathan's talent_id
SELECT 
    tp.id as talent_id,
    tp.username,
    tp.temp_full_name,
    tp.total_earnings,
    tp.moov_account_id
FROM talent_profiles tp
WHERE tp.username = 'jonathanbodnar';

-- 2. Check Jonathan's payout_batches
SELECT 
    pb.id,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.total_refunded_amount,
    pb.net_payout_amount,
    pb.status,
    pb.created_at
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY pb.week_start_date DESC;

-- 3. Check Jonathan's individual payouts
SELECT 
    p.id,
    p.order_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.status,
    p.is_refunded,
    p.week_start_date,
    p.week_end_date,
    p.created_at
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY p.created_at DESC;

-- 4. Check Jonathan's completed orders (should match payouts)
SELECT 
    o.id,
    o.amount,
    o.status,
    o.video_url IS NOT NULL as has_video,
    o.created_at,
    o.updated_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'jonathanbodnar'
AND o.status = 'completed'
ORDER BY o.updated_at DESC;

