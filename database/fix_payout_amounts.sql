-- Fix payout amounts that are 100x too high
-- Root cause: Some orders have amounts stored 100x too high (e.g., $11000 instead of $110)

-- First, let's identify payouts that are suspiciously high (over $1000)
SELECT 
    p.id as payout_id,
    o.id as order_id,
    tp.username,
    p.order_amount as current_order_amount,
    p.payout_amount as current_payout_amount,
    ROUND(p.order_amount / 100, 2) as corrected_order_amount,
    ROUND(p.payout_amount / 100, 2) as corrected_payout_amount,
    p.week_start_date,
    p.created_at
FROM payouts p
JOIN orders o ON o.id = p.order_id
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE p.order_amount > 1000 -- Suspiciously high (over $1000)
ORDER BY p.order_amount DESC;

-- Now fix the payouts table - divide by 100 for amounts over $1000
UPDATE payouts
SET 
    order_amount = ROUND(order_amount / 100, 2),
    admin_fee_amount = ROUND(admin_fee_amount / 100, 2),
    payout_amount = ROUND(payout_amount / 100, 2),
    updated_at = NOW()
WHERE order_amount > 1000;

-- Fix the payout_batches table - recalculate totals from actual payouts
UPDATE payout_batches pb
SET 
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded = false
    ),
    total_refunded_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded = true
    ),
    updated_at = NOW();

-- Recalculate net_payout_amount based on updated totals
UPDATE payout_batches
SET 
    net_payout_amount = total_payout_amount - total_refunded_amount,
    updated_at = NOW();

-- Fix talent total_earnings - recalculate from actual non-refunded payouts
UPDATE talent_profiles tp
SET 
    total_earnings = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = tp.id
        AND p.is_refunded = false
    ),
    updated_at = NOW();

-- Verify the fixes for Shawn and Josh
SELECT 
    tp.username,
    tp.temp_full_name,
    tp.total_earnings,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    pb.status
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE tp.username IN ('shawnfarash', 'joshfirestine')
ORDER BY tp.username, pb.week_start_date DESC;

-- Show individual payouts for verification
SELECT 
    tp.username,
    o.id as order_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.is_refunded,
    p.week_start_date
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
WHERE tp.username IN ('shawnfarash', 'joshfirestine')
ORDER BY tp.username, p.created_at DESC;

