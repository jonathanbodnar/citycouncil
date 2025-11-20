-- Debug Hayley's specific order to see what's going wrong

-- First, let's see the raw order data
SELECT 
    'Hayley Order Raw Data' as check,
    o.id,
    o.amount as order_amount_cents,
    o.amount / 100.0 as order_amount_dollars,
    o.admin_fee as stored_admin_fee_cents,
    o.admin_fee / 100.0 as stored_admin_fee_dollars,
    o.discount_amount,
    o.original_amount,
    o.charity_amount,
    o.created_at,
    o.status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'hayleycaronia'
AND o.status = 'completed'
ORDER BY o.created_at DESC
LIMIT 1;

-- Now let's see the current payout data
SELECT 
    'Current Payout Data' as check,
    p.id as payout_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.is_refunded
FROM payouts p
JOIN orders o ON o.id = p.order_id
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'hayleycaronia'
AND o.status = 'completed'
ORDER BY o.created_at DESC
LIMIT 1;

-- Let's manually calculate what it SHOULD be
SELECT 
    'What It Should Be' as check,
    o.amount / 100.0 as order_total_dollars,
    (o.amount / 100.0) / 1.029 as base_price_without_processing_fee,
    CASE 
        WHEN o.admin_fee IS NOT NULL AND o.admin_fee > 0 
        THEN o.admin_fee / 100.0
        ELSE ((o.amount / 100.0) / 1.029) * 0.25
    END as admin_fee_should_be,
    CASE 
        WHEN o.admin_fee IS NOT NULL AND o.admin_fee > 0 
        THEN ((o.amount / 100.0) / 1.029) - (o.admin_fee / 100.0)
        ELSE ((o.amount / 100.0) / 1.029) * 0.75
    END as payout_should_be
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'hayleycaronia'
AND o.status = 'completed'
ORDER BY o.created_at DESC
LIMIT 1;

-- Check talent's admin fee percentage
SELECT 
    'Talent Settings' as check,
    tp.username,
    tp.admin_fee_percentage,
    tp.first_orders_promo_active,
    tp.fulfilled_orders
FROM talent_profiles tp
WHERE tp.username = 'hayleycaronia';

