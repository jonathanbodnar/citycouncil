-- Diagnostic script to check payout amount discrepancies
-- This will help identify if orders.amount is in cents but payouts are treating it as dollars

-- 1. Check a few recent orders to see the amount format
SELECT 
    'Order Amounts (should be in cents)' as check_type,
    o.id as order_id,
    o.amount as stored_amount,
    o.amount / 100 as amount_in_dollars,
    o.status,
    o.created_at
FROM orders o
ORDER BY o.created_at DESC
LIMIT 10;

-- 2. Check payouts for those same orders
SELECT 
    'Payout Amounts' as check_type,
    p.order_id,
    p.order_amount as payout_order_amount,
    p.admin_fee_amount,
    p.payout_amount as talent_payout,
    p.created_at,
    CASE 
        WHEN p.order_amount > 1000 THEN '⚠️  Likely incorrect (treating cents as dollars)'
        WHEN p.order_amount < 100 THEN '✅ Likely correct (in dollars)'
        ELSE '❓ Unclear'
    END as diagnosis
FROM payouts p
ORDER BY p.created_at DESC
LIMIT 10;

-- 3. Compare orders vs payouts side-by-side
SELECT 
    'Comparison' as check_type,
    o.id as order_id,
    o.amount as order_amount_stored,
    o.amount / 100 as order_amount_dollars,
    p.order_amount as payout_order_amount,
    p.payout_amount,
    CASE
        WHEN p.order_amount = o.amount THEN '❌ WRONG: Payout using cents as dollars'
        WHEN p.order_amount = o.amount / 100 THEN '✅ CORRECT: Payout properly converted to dollars'
        ELSE '❓ Unknown mismatch'
    END as status
FROM orders o
JOIN payouts p ON p.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 15;

-- 4. Check batch totals
SELECT 
    'Batch Totals' as check_type,
    pb.id,
    pb.talent_id,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    CASE 
        WHEN pb.total_payout_amount > 10000 THEN '⚠️  Suspiciously high (likely incorrect)'
        ELSE '✅ Reasonable amount'
    END as diagnosis
FROM payout_batches pb
ORDER BY pb.created_at DESC
LIMIT 10;

