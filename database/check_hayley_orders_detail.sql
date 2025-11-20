-- Check the actual order amounts for Hayley's two payouts

SELECT 
    'Hayley Orders Detail' as check,
    o.id,
    o.status,
    o.amount as order_cents,
    o.amount / 100.0 as order_dollars,
    o.admin_fee as admin_fee_cents,
    o.admin_fee / 100.0 as admin_fee_dollars,
    o.created_at,
    p.order_amount as payout_order_amount,
    p.payout_amount as payout_talent_gets
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'hayleycaronia'
AND o.id IN ('3ef66730-105e-44c0-b099-f4c72af0f67d', '22bdf123-35a2-4cb8-be75-225997aeb186')
ORDER BY o.created_at DESC;

