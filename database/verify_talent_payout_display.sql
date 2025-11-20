-- This query replicates EXACTLY what IntegratedPayoutsDashboard.tsx displays
-- Lines 115-130: Fetches batches ordered by week_start_date DESC

SELECT 
    pb.id,
    pb.talent_id,
    tp.username,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.total_refunded_amount,
    pb.net_payout_amount,
    pb.status,
    pb.created_at,
    pb.updated_at,
    -- This is what displays in the UI (line 473):
    '{"formatted_amount": "$' || pb.net_payout_amount::text || '", "orders_count": ' || pb.total_orders::text || '}' as ui_display
FROM payout_batches pb
LEFT JOIN talent_profiles tp ON tp.id = pb.talent_id
ORDER BY pb.week_start_date DESC;

-- Also show the underlying payouts for each batch (lines 496-540)
-- This is what shows when you expand a week
SELECT 
    p.id,
    p.talent_id,
    tp.username,
    p.order_id,
    p.week_start_date,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.is_refunded,
    p.refund_reason,
    p.status,
    p.created_at,
    -- This is what displays for each payout (line 530-534):
    '{"payout_display": "$' || p.payout_amount::text || '", "order_display": "$' || p.order_amount::text || ' - ' || p.admin_fee_percentage::text || '% fee"}' as ui_detail
FROM payouts p
LEFT JOIN talent_profiles tp ON tp.id = p.talent_id
ORDER BY p.created_at DESC;

