-- Check Jonathan's batch in database
SELECT 
    pb.id,
    pb.talent_id,
    tp.username,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    pb.updated_at
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY pb.week_start_date DESC
LIMIT 1;

-- Check all individual payouts in Jonathan's current batch
SELECT 
    p.id,
    p.order_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.payout_amount,
    p.is_refunded,
    p.created_at
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE tp.username = 'jonathanbodnar'
  AND p.week_start_date = (SELECT DATE_TRUNC('week', CURRENT_DATE)::DATE + 1);

-- Force recalculate Jonathan's batch from scratch
UPDATE payout_batches pb
SET 
    total_orders = (
        SELECT COUNT(*)::INTEGER
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
          AND NOT p.is_refunded
    ),
    total_refunded_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
          AND p.is_refunded
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW()
WHERE pb.talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')
  AND pb.week_start_date = (SELECT DATE_TRUNC('week', CURRENT_DATE)::DATE + 1);

-- Verify after recalculation
SELECT 
    'AFTER RECALC' as status,
    pb.net_payout_amount as batch_total,
    pb.total_orders,
    pb.updated_at
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
  AND pb.week_start_date = (SELECT DATE_TRUNC('week', CURRENT_DATE)::DATE + 1);

