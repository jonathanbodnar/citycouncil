-- Comprehensive verification of payout system setup
-- Run this to diagnose why payouts aren't showing

-- 1. CHECK: Do the RLS policies exist?
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('payouts', 'payout_batches')
ORDER BY tablename, policyname;

-- 2. CHECK: Is RLS actually enabled?
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('payouts', 'payout_batches');

-- 3. CHECK: Does payout data exist at all?
SELECT 
    'Total payouts in database' as check_name,
    COUNT(*) as count
FROM payouts
UNION ALL
SELECT 
    'Total payout_batches in database' as check_name,
    COUNT(*) as count
FROM payout_batches;

-- 4. CHECK: How many talent have payouts?
SELECT 
    COUNT(DISTINCT talent_id) as talent_with_payouts
FROM payouts;

-- 5. CHECK: Sample of payout data
SELECT 
    tp.username,
    tp.temp_full_name,
    COUNT(p.id) as payout_count,
    SUM(p.payout_amount) as total_payout,
    COUNT(pb.id) as batch_count
FROM talent_profiles tp
LEFT JOIN payouts p ON p.talent_id = tp.id
LEFT JOIN payout_batches pb ON pb.talent_id = tp.id
GROUP BY tp.id, tp.username, tp.temp_full_name
HAVING COUNT(p.id) > 0
ORDER BY payout_count DESC;

-- 6. CHECK: Jonathan's specific user_id and talent_id
SELECT 
    u.id as user_id,
    u.user_type,
    tp.id as talent_id,
    tp.username,
    tp.temp_full_name
FROM users u
JOIN talent_profiles tp ON tp.user_id = u.id
WHERE tp.username = 'jonathanbodnar';

-- 7. CHECK: Can we manually query Jonathan's payouts?
SELECT 
    p.id,
    p.talent_id,
    p.order_amount,
    p.payout_amount,
    p.status,
    p.week_start_date,
    p.created_at
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY p.created_at DESC
LIMIT 5;

-- 8. CHECK: Can we manually query Jonathan's batches?
SELECT 
    pb.id,
    pb.talent_id,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY pb.week_start_date DESC;

-- 9. CHECK: Are there any completed orders without payouts?
SELECT 
    tp.username,
    o.id as order_id,
    o.amount,
    o.status,
    o.video_url IS NOT NULL as has_video,
    o.updated_at,
    CASE WHEN p.id IS NULL THEN 'NO PAYOUT' ELSE 'HAS PAYOUT' END as payout_status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.status = 'completed'
AND o.video_url IS NOT NULL
AND o.video_url != ''
ORDER BY o.updated_at DESC
LIMIT 10;

