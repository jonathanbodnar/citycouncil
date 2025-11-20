-- Fix Hayley's second order
-- First, let's see what orders Hayley has

SELECT 
    'Hayley Orders' as check,
    o.id,
    o.amount as amount_cents,
    o.amount / 100.0 as amount_dollars,
    o.created_at,
    p.payout_amount,
    o.status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'hayleycaronia'
ORDER BY o.created_at DESC;

