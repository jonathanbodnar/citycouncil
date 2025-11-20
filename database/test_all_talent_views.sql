-- ==================================================
-- COMPREHENSIVE TEST: What Talent Actually See
-- ==================================================

-- 1. TALENT "MY ORDERS" TAB (TalentDashboard.tsx line 818)
--    Shows: Base video price (excluding processing fee)
-- ==================================================
SELECT 
    '1. MY ORDERS TAB' as section,
    tp.username as talent,
    u.full_name as customer,
    o.id as order_id,
    o.amount as raw_cents,
    -- What they see: (amount / 100 / 1.029)
    '$' || ((o.amount / 100.0 / 1.029)::numeric(10,2))::text as displayed_amount,
    o.created_at::date as order_date
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = o.user_id
WHERE o.status = 'completed'
ORDER BY tp.username, o.created_at DESC;

-- 2. TALENT "PAYOUTS" TAB - WEEKLY BATCHES (IntegratedPayoutsDashboard.tsx line 473)
--    Shows: Net payout amount per week
-- ==================================================
SELECT 
    '2. PAYOUTS TAB - WEEKLY BATCHES' as section,
    tp.username as talent,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders as orders_count,
    -- What they see: batch.net_payout_amount
    '$' || pb.net_payout_amount::numeric(10,2)::text as displayed_weekly_total,
    pb.status
FROM payout_batches pb
LEFT JOIN talent_profiles tp ON tp.id = pb.talent_id
ORDER BY tp.username, pb.week_start_date DESC;

-- 3. TALENT "PAYOUTS" TAB - INDIVIDUAL PAYOUTS (IntegratedPayoutsDashboard.tsx lines 530-534)
--    Shows when you expand a week: Individual order payouts
-- ==================================================
SELECT 
    '3. PAYOUTS TAB - INDIVIDUAL ORDERS' as section,
    tp.username as talent,
    p.order_id,
    p.week_start_date,
    -- What they see: payout.order_amount (line 533)
    '$' || p.order_amount::numeric(10,2)::text as order_amount_shown,
    -- What they see: payout.admin_fee_percentage (line 533)
    p.admin_fee_percentage::text || '%' as fee_shown,
    -- What they see: payout.payout_amount (line 530)
    '$' || p.payout_amount::numeric(10,2)::text as payout_amount_shown,
    p.is_refunded,
    p.status
FROM payouts p
LEFT JOIN talent_profiles tp ON tp.id = p.talent_id
ORDER BY tp.username, p.created_at DESC;

-- 4. TALENT TOTAL EARNINGS (IntegratedPayoutsDashboard.tsx line 417)
--    Shows: Sum of all non-refunded payouts
-- ==================================================
SELECT 
    '4. TOTAL EARNINGS SUMMARY' as section,
    tp.username as talent,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE p.is_refunded) as refunded_orders,
    COUNT(*) FILTER (WHERE NOT p.is_refunded) as paid_orders,
    -- What they see: totalEarnings (sum of payout_amount where not refunded)
    '$' || SUM(p.payout_amount) FILTER (WHERE NOT p.is_refunded)::numeric(10,2)::text as total_earned_displayed
FROM payouts p
LEFT JOIN talent_profiles tp ON tp.id = p.talent_id
GROUP BY tp.username
ORDER BY tp.username;

-- 5. CONSISTENCY CHECK: Compare all three views
-- ==================================================
SELECT 
    '5. CONSISTENCY CHECK' as section,
    tp.username as talent,
    o.id as order_id,
    -- My Orders tab shows:
    '$' || ((o.amount / 100.0 / 1.029)::numeric(10,2))::text as my_orders_shows,
    -- Payouts tab shows (order_amount):
    '$' || p.order_amount::numeric(10,2)::text as payouts_order_amount_shows,
    -- Payouts tab shows (payout after fee):
    '$' || p.payout_amount::numeric(10,2)::text as payouts_payout_shows,
    -- Do they match?
    CASE 
        WHEN ABS((o.amount / 100.0 / 1.029) - p.order_amount) < 0.01 THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as consistency
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.status = 'completed'
ORDER BY tp.username, o.created_at DESC;

