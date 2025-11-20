-- This query replicates what TalentDashboard.tsx "My Orders" tab displays
-- Lines 113-145: Fetches orders for the talent, joined with user info

-- First, let's get ALL orders for all talent with their display amounts
SELECT 
    o.id as order_id,
    tp.username as talent_username,
    u.full_name as customer_name,
    o.order_type,
    o.status,
    o.amount as amount_cents,
    -- This is what displays on line 818 of TalentDashboard.tsx:
    (o.amount / 100.0) as amount_dollars,
    '$' || (o.amount / 100.0)::numeric(10,2)::text as displayed_amount,
    o.created_at
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = o.user_id
WHERE o.status = 'completed'
ORDER BY o.created_at DESC;

-- Now let's compare this with the payouts table to ensure consistency
SELECT 
    o.id as order_id,
    tp.username as talent_username,
    u.full_name as customer_name,
    -- Orders table amounts:
    o.amount as order_amount_cents,
    (o.amount / 100.0) as order_amount_dollars,
    -- Payouts table amounts:
    p.order_amount as payout_order_amount,
    p.payout_amount as payout_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    -- Check if they match:
    CASE 
        WHEN (o.amount / 100.0) = p.order_amount THEN '✅ MATCH'
        ELSE '❌ MISMATCH: orders.amount=' || (o.amount / 100.0)::text || ' vs payouts.order_amount=' || p.order_amount::text
    END as consistency_check
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.status = 'completed'
ORDER BY o.created_at DESC;

