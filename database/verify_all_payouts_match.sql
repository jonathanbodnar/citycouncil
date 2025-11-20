-- Comprehensive verification: Compare what Admin sees vs what Talent sees
-- This queries the exact same data that both dashboards use

-- 1. Show ALL payout batches (what Admin Payouts page shows)
-- Count total batches first
SELECT COUNT(*) as total_batches FROM payout_batches;

SELECT 
    '=== ADMIN VIEW - All Batches ===' as section,
    tp.username,
    u.full_name as talent_name,
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
LEFT JOIN users u ON u.id = tp.user_id
ORDER BY pb.created_at DESC, pb.week_start_date DESC, tp.username;

-- 2. Show individual payouts grouped by talent (what Talent Payouts page shows)
SELECT 
    '=== TALENT VIEW - Individual Payouts ===' as section,
    tp.username,
    p.week_start_date,
    p.order_id,
    o.amount / 100.0 as order_total_dollars,
    p.order_amount as base_price,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount as talent_gets,
    p.is_refunded,
    p.created_at
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
ORDER BY p.week_start_date DESC, tp.username, p.created_at;

-- 3. Verify batch totals match sum of individual payouts
SELECT 
    '=== VERIFICATION - Do Batches Match Payouts? ===' as section,
    tp.username,
    pb.week_start_date,
    pb.total_orders as batch_count,
    pb.net_payout_amount as batch_net_total,
    -- Calculate from actual payouts
    (SELECT COUNT(*) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date) as actual_count,
    (SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date) as actual_net_total,
    -- Check if they match
    CASE 
        WHEN pb.net_payout_amount = (SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date)
        THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
ORDER BY pb.week_start_date DESC, tp.username;

-- 4. Show Orders tab data (what talent sees in their Orders tab)
SELECT 
    '=== ORDERS TAB VIEW - Completed Orders ===' as section,
    tp.username,
    o.id as order_id,
    o.amount / 100.0 as order_displays_as,
    o.status,
    o.created_at,
    p.payout_amount as talent_earns
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.status = 'completed'
ORDER BY o.created_at DESC;

-- 5. Summary by talent - Total earnings
SELECT 
    '=== SUMMARY - Total Earnings by Talent ===' as section,
    tp.username,
    tp.total_earnings as stored_total_earnings,
    COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0) as calculated_total_earnings,
    CASE 
        WHEN tp.total_earnings = COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
FROM talent_profiles tp
LEFT JOIN payouts p ON p.talent_id = tp.id
WHERE tp.id IN (
    SELECT DISTINCT talent_id FROM payout_batches
)
GROUP BY tp.id, tp.username, tp.total_earnings
ORDER BY tp.username;

-- 6. Flag any problematic orders (amount < $2 or amount looks weird)
SELECT 
    '=== POTENTIAL ISSUES - Suspicious Orders ===' as section,
    tp.username,
    o.id as order_id,
    o.amount as amount_cents,
    o.amount / 100.0 as amount_dollars,
    p.payout_amount,
    CASE 
        WHEN o.amount < 200 THEN '⚠️ Too low (< $2)'
        WHEN o.amount > 100000 THEN '⚠️ Too high (> $1000)'
        WHEN p.payout_amount > o.amount / 100.0 THEN '⚠️ Payout > Order'
        ELSE '✅ OK'
    END as issue
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.status = 'completed'
AND (o.amount < 200 OR o.amount > 100000 OR p.payout_amount > o.amount / 100.0)
ORDER BY o.created_at DESC;

