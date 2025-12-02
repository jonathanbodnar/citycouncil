-- Manually fix Jonathan's payout from today
-- His order is 720 cents ($7.20 gross)
-- Base price should be $7.20 / 1.029 = $6.998 ≈ $7.00
-- With 0% fee (first order), he should get $7.00

UPDATE payouts p
SET 
    order_amount = (o.amount / 100.0) / 1.029,
    admin_fee_percentage = 0,
    admin_fee_amount = 0,
    payout_amount = (o.amount / 100.0) / 1.029,
    updated_at = NOW()
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE p.order_id = o.id
  AND tp.username = 'jonathanbodnar'
  AND o.created_at::date = CURRENT_DATE;

-- Recalculate Jonathan's batch
UPDATE payout_batches pb
SET 
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
          AND NOT p.is_refunded
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW()
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')
  AND week_start_date = (SELECT DATE_TRUNC('week', CURRENT_DATE)::DATE + 1);

-- Verify
SELECT 
    'AFTER FIX' as status,
    tp.username,
    o.amount as order_cents,
    (o.amount / 100.0) as order_dollars,
    (o.amount / 100.0 / 1.029) as expected_base_price,
    p.order_amount as payout_base_price,
    p.admin_fee_percentage,
    p.payout_amount,
    pb.net_payout_amount as batch_total
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
LEFT JOIN payout_batches pb ON pb.talent_id = o.talent_id AND pb.week_start_date = p.week_start_date
WHERE tp.username = 'jonathanbodnar'
  AND o.created_at::date = CURRENT_DATE;


