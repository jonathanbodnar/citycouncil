-- Fix Jonathan's 2 orders that show $0.07 instead of $7.00

-- Show current state
SELECT 
    'BEFORE - Jonathan Orders' as check,
    o.id,
    o.amount / 100.0 as amount_dollars,
    p.payout_amount,
    o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'jonathanbodnar'
AND o.amount < 1000  -- Less than $10
ORDER BY o.created_at;

-- Fix the orders to $7.00 (720 cents includes processing fee)
-- If they're test orders for exactly $7.00, that's 720 cents
UPDATE orders 
SET amount = 720, updated_at = NOW() 
WHERE id IN (
    SELECT o.id 
    FROM orders o
    JOIN talent_profiles tp ON tp.id = o.talent_id
    WHERE tp.username = 'jonathanbodnar'
    AND o.amount < 1000
);

-- Recalculate the payouts
DO $$
DECLARE
  v_order RECORD;
  v_base_price DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
BEGIN
  FOR v_order IN 
    SELECT 
        o.id as order_id,
        o.talent_id,
        p.id as payout_id,
        p.week_start_date
    FROM orders o
    JOIN talent_profiles tp ON tp.id = o.talent_id
    JOIN payouts p ON p.order_id = o.id
    WHERE tp.username = 'jonathanbodnar'
    AND o.amount = 720
  LOOP
    -- $7.20 / 1.029 = $7.00 base price
    -- 0% admin fee (promo period)
    -- Payout = $7.00
    v_base_price := 7.00;
    v_payout_amount := 7.00;
    
    UPDATE payouts
    SET 
      order_amount = v_base_price,
      admin_fee_percentage = 0,
      admin_fee_amount = 0,
      payout_amount = v_payout_amount,
      updated_at = NOW()
    WHERE id = v_order.payout_id;
    
    RAISE NOTICE 'Fixed payout for order %: $7.00 payout', v_order.order_id;
  END LOOP;
END $$;

-- Recalculate Jonathan's batches
UPDATE payout_batches pb
SET 
    total_orders = (
        SELECT COUNT(*)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
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
WHERE pb.talent_id IN (
    SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
);

-- Show results
SELECT 
    'AFTER - Jonathan Orders' as check,
    o.id,
    o.amount / 100.0 as amount_dollars,
    p.order_amount as base_price,
    p.payout_amount as talent_gets,
    o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE tp.username = 'jonathanbodnar'
ORDER BY o.created_at DESC;

SELECT 
    'Jonathan Batches After Fix' as check,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username = 'jonathanbodnar'
ORDER BY pb.week_start_date DESC;

