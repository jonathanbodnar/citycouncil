-- Completely recalculate all payout batch totals from scratch
-- This will fix the batch totals shown in the admin payouts page

-- First, show current batch totals before fix
SELECT 
    'BEFORE FIX - Current Batch Totals' as check,
    tp.username,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    -- Calculate what they SHOULD be
    (SELECT COUNT(*) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date) as actual_count,
    (SELECT COALESCE(SUM(p.payout_amount), 0) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date) as actual_total,
    (SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date) as actual_net
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine', 'elsakurt', 'basrutten', 'jonathanbodnar')
ORDER BY pb.week_start_date DESC, tp.username;

-- Now recalculate ALL batches
UPDATE payout_batches pb
SET 
    total_orders = (
        SELECT COUNT(*)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    total_refunded_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded = true
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW();

-- Show the results after fix
SELECT 
    'AFTER FIX - New Batch Totals' as check,
    tp.username,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.total_refunded_amount,
    pb.net_payout_amount,
    pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine', 'elsakurt', 'basrutten', 'jonathanbodnar')
ORDER BY pb.week_start_date DESC, tp.username;

-- Also show individual payouts for verification
SELECT 
    'Individual Payouts for Verification' as check,
    tp.username,
    o.id as order_id,
    o.amount / 100.0 as order_total,
    p.order_amount as base_price,
    p.admin_fee_amount,
    p.payout_amount,
    p.week_start_date,
    p.is_refunded
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
WHERE tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine', 'elsakurt', 'basrutten', 'jonathanbodnar')
ORDER BY p.week_start_date DESC, tp.username, p.created_at;

