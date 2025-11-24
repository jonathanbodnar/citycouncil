-- Show EVERY payout for Jonathan to see what's adding up to $540
SELECT 
    p.id,
    p.order_id,
    o.created_at as order_created,
    p.week_start_date,
    o.amount as order_cents,
    p.order_amount as payout_order_amount,
    p.admin_fee_percentage,
    p.payout_amount,
    p.is_refunded,
    CASE 
        WHEN p.payout_amount > 100 THEN '❌ TOO HIGH (not divided by 100?)'
        ELSE '✅ Correct'
    END as status
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
LEFT JOIN orders o ON o.id = p.order_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY p.created_at DESC;

-- Show the sum
SELECT 
    'TOTAL OF ALL PAYOUTS' as label,
    COUNT(*) as num_payouts,
    SUM(p.payout_amount) as sum_of_payouts,
    SUM(CASE WHEN NOT p.is_refunded THEN p.payout_amount ELSE 0 END) as sum_non_refunded
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE tp.username = 'jonathanbodnar';

-- Delete any duplicate payouts if they exist
WITH duplicates AS (
    SELECT 
        p.id,
        p.order_id,
        ROW_NUMBER() OVER (PARTITION BY p.order_id ORDER BY p.created_at DESC) as rn
    FROM payouts p
    JOIN talent_profiles tp ON tp.id = p.talent_id
    WHERE tp.username = 'jonathanbodnar'
)
DELETE FROM payouts
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Fix ALL of Jonathan's payouts (in case there are old broken ones)
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
  AND p.payout_amount > 100; -- Only fix broken ones

-- Recalculate batch
UPDATE payout_batches pb
SET 
    total_orders = (
        SELECT COUNT(*)::INTEGER
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
          AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW()
WHERE pb.talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar');

-- Final verification
SELECT 
    'FINAL CHECK' as status,
    pb.week_start_date,
    pb.total_orders,
    pb.net_payout_amount as batch_total,
    (SELECT SUM(p.payout_amount) FROM payouts p WHERE p.talent_id = pb.talent_id AND p.week_start_date = pb.week_start_date) as sum_check
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY pb.week_start_date DESC;

