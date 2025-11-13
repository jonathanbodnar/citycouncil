-- Check why Jonathan's orders are still showing $720 instead of $7.20

SELECT 
    o.id,
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    o.amount as order_amount,
    o.status,
    o.video_url IS NOT NULL as has_video,
    o.created_at::date as order_date,
    o.updated_at::date as completed_date
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY o.created_at ASC;

-- Check payouts
SELECT 
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.created_at::date as payout_date
FROM payouts p
JOIN orders o ON o.id = p.order_id
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY p.created_at ASC;

