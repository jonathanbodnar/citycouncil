-- Check the current payout trigger function to see if it's dividing by 100
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_payout_on_order_completion';

-- Also check today's orders and their payouts
SELECT 
    o.id as order_id,
    o.amount as order_cents,
    (o.amount / 100.0) as order_dollars,
    o.created_at,
    p.order_amount as payout_order_amount,
    p.payout_amount as payout_payout_amount,
    tp.username as talent
FROM orders o
LEFT JOIN payouts p ON p.order_id = o.id
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.created_at::date = CURRENT_DATE
ORDER BY o.created_at DESC;


