-- Manually fix specific orders with known correct amounts
-- These orders have corrupted amount values and need to be set to the correct gross amounts

-- First, show current state of these specific orders
SELECT 
    'BEFORE FIX - Broken Orders' as check,
    o.id,
    tp.username,
    o.amount as current_cents,
    o.amount / 100.0 as current_dollars,
    o.created_at,
    p.payout_amount as current_payout
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.id IN (
    'b93e5dce-b55d-426e-9408-f36fd017f18a',  -- joshfirestine
    '488eb505-481a-47df-b2a7-11394bb9ed0d',  -- nickdipaolo (1st order)
    '402b98c8-4e55-4548-aac5-c52644d24bd2',  -- geraldmorgan
    '8e01dd16-90df-44c7-a440-1919ce26acf4',  -- shawnfarash (2nd video)
    '30ffb97f-f1e3-417a-9a7d-285ea69b019c'   -- shawnfarash (1st video)
)
ORDER BY o.created_at;

-- Fix the orders with correct gross amounts (in cents)
UPDATE orders SET amount = 5000, updated_at = NOW() WHERE id = 'b93e5dce-b55d-426e-9408-f36fd017f18a';  -- Josh: $50
UPDATE orders SET amount = 12500, updated_at = NOW() WHERE id = '488eb505-481a-47df-b2a7-11394bb9ed0d'; -- Nick: $125
UPDATE orders SET amount = 4700, updated_at = NOW() WHERE id = '402b98c8-4e55-4548-aac5-c52644d24bd2';  -- Gerald: $47
UPDATE orders SET amount = 11000, updated_at = NOW() WHERE id = '8e01dd16-90df-44c7-a440-1919ce26acf4'; -- Shawn 2nd: $110
UPDATE orders SET amount = 13700, updated_at = NOW() WHERE id = '30ffb97f-f1e3-417a-9a7d-285ea69b019c'; -- Shawn 1st: $137

-- Now recalculate the payouts for these orders using the corrected amounts
DO $$
DECLARE
  v_order RECORD;
  v_order_total_dollars DECIMAL(10,2);
  v_base_price DECIMAL(10,2);
  v_processing_fee DECIMAL(10,2);
  v_admin_fee_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
BEGIN
  RAISE NOTICE '=== Recalculating payouts for fixed orders ===';
  
  FOR v_order IN 
    SELECT 
        o.id as order_id,
        o.talent_id,
        o.amount as order_cents,
        o.admin_fee as stored_admin_fee_cents,
        tp.admin_fee_percentage as talent_admin_fee_pct,
        p.id as payout_id,
        p.week_start_date,
        tp.username
    FROM orders o
    JOIN talent_profiles tp ON tp.id = o.talent_id
    JOIN payouts p ON p.order_id = o.id
    WHERE o.id IN (
        'b93e5dce-b55d-426e-9408-f36fd017f18a',
        '488eb505-481a-47df-b2a7-11394bb9ed0d',
        '402b98c8-4e55-4548-aac5-c52644d24bd2',
        '8e01dd16-90df-44c7-a440-1919ce26acf4',
        '30ffb97f-f1e3-417a-9a7d-285ea69b019c'
    )
  LOOP
    -- Convert to dollars
    v_order_total_dollars := v_order.order_cents / 100.0;
    
    -- Remove processing fee to get base price
    v_base_price := v_order_total_dollars / 1.029;
    v_processing_fee := v_order_total_dollars - v_base_price;
    
    -- Use stored admin fee if available
    IF v_order.stored_admin_fee_cents IS NOT NULL AND v_order.stored_admin_fee_cents > 0 THEN
      v_admin_fee_amount := v_order.stored_admin_fee_cents / 100.0;
      v_admin_fee_pct := LEAST((v_admin_fee_amount / NULLIF(v_base_price, 0)) * 100, 100);
    ELSE
      v_admin_fee_pct := COALESCE(v_order.talent_admin_fee_pct, 25);
      v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100);
    END IF;
    
    -- Calculate payout
    v_payout_amount := v_base_price - v_admin_fee_amount;
    
    -- Update payout
    UPDATE payouts
    SET 
      order_amount = v_base_price,
      admin_fee_percentage = v_admin_fee_pct,
      admin_fee_amount = v_admin_fee_amount,
      payout_amount = v_payout_amount,
      updated_at = NOW()
    WHERE id = v_order.payout_id;
    
    RAISE NOTICE 'Fixed % (talent %): Order $% -> Base $% | Admin $% (% pct) | Payout $%',
      v_order.order_id, v_order.username, v_order_total_dollars, v_base_price, 
      v_admin_fee_amount, v_admin_fee_pct, v_payout_amount;
  END LOOP;
  
  RAISE NOTICE '=== Done! Now recalculating affected batches ===';
END $$;

-- Recalculate the affected batch totals
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
    total_refunded_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded = true
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW()
WHERE pb.talent_id IN (
    SELECT DISTINCT o.talent_id 
    FROM orders o 
    WHERE o.id IN (
        'b93e5dce-b55d-426e-9408-f36fd017f18a',
        '488eb505-481a-47df-b2a7-11394bb9ed0d',
        '402b98c8-4e55-4548-aac5-c52644d24bd2',
        '8e01dd16-90df-44c7-a440-1919ce26acf4',
        '30ffb97f-f1e3-417a-9a7d-285ea69b019c'
    )
);

-- Show the results
SELECT 
    'AFTER FIX - Corrected Orders' as check,
    o.id,
    tp.username,
    o.amount as amount_cents,
    o.amount / 100.0 as amount_dollars,
    p.order_amount as base_price,
    p.admin_fee_amount,
    p.payout_amount as talent_gets,
    o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.id IN (
    'b93e5dce-b55d-426e-9408-f36fd017f18a',
    '488eb505-481a-47df-b2a7-11394bb9ed0d',
    '402b98c8-4e55-4548-aac5-c52644d24bd2',
    '8e01dd16-90df-44c7-a440-1919ce26acf4',
    '30ffb97f-f1e3-417a-9a7d-285ea69b019c'
)
ORDER BY o.created_at;

-- Show updated batch totals
SELECT 
    'Updated Batch Totals' as check,
    tp.username,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username IN ('joshfirestine', 'nickdipaolo', 'geraldmorgan', 'shawnfarash')
ORDER BY pb.week_start_date DESC, tp.username;

