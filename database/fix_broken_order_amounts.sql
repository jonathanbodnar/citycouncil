-- Find and fix orders that have suspiciously low amounts
-- These orders seem to have amount stored as dollars instead of cents

-- First, identify problematic orders
SELECT 
    'Problematic Orders (amount < 200 cents = $2)' as check,
    o.id,
    tp.username,
    o.amount as current_amount_cents,
    o.amount / 100.0 as interpreted_as_dollars,
    o.status,
    o.created_at,
    p.payout_amount as talent_payout,
    -- If payout exists and is reasonable, back-calculate what order amount should be
    CASE 
        WHEN p.payout_amount > 0 AND p.admin_fee_percentage > 0 THEN
            -- payout = (order_total / 1.029) * (1 - admin_fee_pct/100)
            -- So: order_total = (payout / (1 - admin_fee_pct/100)) * 1.029
            ROUND((p.payout_amount / (1 - p.admin_fee_percentage/100)) * 1.029 * 100) 
        ELSE NULL
    END as calculated_correct_amount_cents
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.amount < 200  -- Less than $2 (200 cents) is suspicious
AND o.status = 'completed'
ORDER BY o.created_at DESC;

-- Now let's fix them by back-calculating from the payout amount
DO $$
DECLARE
    v_order RECORD;
    v_correct_amount_cents BIGINT;
BEGIN
    RAISE NOTICE '=== Fixing orders with broken amounts ===';
    
    FOR v_order IN 
        SELECT 
            o.id as order_id,
            o.amount as current_amount,
            p.payout_amount,
            p.admin_fee_percentage,
            tp.username
        FROM orders o
        JOIN talent_profiles tp ON tp.id = o.talent_id
        LEFT JOIN payouts p ON p.order_id = o.id
        WHERE o.amount < 200
        AND o.status = 'completed'
        AND p.payout_amount IS NOT NULL
        AND p.payout_amount > 0
    LOOP
        -- Back-calculate the correct order amount from payout
        -- payout = (order_total / 1.029) * (1 - admin_fee_pct/100)
        -- order_total = (payout / (1 - admin_fee_pct/100)) * 1.029
        v_correct_amount_cents := ROUND((v_order.payout_amount / (1 - v_order.admin_fee_percentage/100)) * 1.029 * 100);
        
        RAISE NOTICE 'Fixing order % (talent: %): % cents -> % cents ($%)',
            v_order.order_id, v_order.username,
            v_order.current_amount, v_correct_amount_cents, v_correct_amount_cents / 100.0;
        
        -- Update the order amount
        UPDATE orders
        SET amount = v_correct_amount_cents,
            updated_at = NOW()
        WHERE id = v_order.order_id;
    END LOOP;
    
    RAISE NOTICE '=== Fix complete! ===';
END $$;

-- Verify the fix
SELECT 
    'After Fix - Verified Orders' as check,
    o.id,
    tp.username,
    o.amount as amount_cents,
    o.amount / 100.0 as amount_dollars,
    p.order_amount as payout_base_price,
    p.admin_fee_amount,
    p.payout_amount as talent_gets,
    o.status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine', 'elsakurt', 'basrutten')
AND o.status = 'completed'
ORDER BY o.created_at DESC;

