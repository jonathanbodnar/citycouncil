-- Manually set correct order amounts based on talent pricing
-- This won't divide anything - just sets the correct values

-- First, let's see what we're working with
SELECT 
    tp.username,
    tp.pricing as expected_price,
    o.id as order_id,
    SUBSTRING(o.id::text, 1, 8) as short_id,
    o.amount as current_amount,
    o.created_at::date
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.status = 'completed'
ORDER BY tp.username, o.created_at;

-- For Shawn's orders - set to his actual pricing
-- Order #8e01dd16 should be $110
UPDATE orders o
SET amount = 110.00, updated_at = NOW()
FROM talent_profiles tp
WHERE o.talent_id = tp.id
AND tp.username = 'shawnfarash'
AND o.id::text LIKE '8e01dd16%';

-- Order #30ffb97f should be $137.50
UPDATE orders o
SET amount = 137.50, updated_at = NOW()
FROM talent_profiles tp
WHERE o.talent_id = tp.id
AND tp.username = 'shawnfarash'
AND o.id::text LIKE '30ffb97f%';

-- For Josh - set to $50
UPDATE orders o
SET amount = 50.00, updated_at = NOW()
FROM talent_profiles tp
WHERE o.talent_id = tp.id
AND tp.username = 'joshfirestine'
AND o.status = 'completed';

-- For Jonathan - set to $7.20 each
UPDATE orders o
SET amount = 7.20, updated_at = NOW()
FROM talent_profiles tp
WHERE o.talent_id = tp.id
AND tp.username = 'jonathanbodnar'
AND o.status = 'completed';

-- For Gerald - set to $47
UPDATE orders o
SET amount = 47.00, updated_at = NOW()
FROM talent_profiles tp
WHERE o.talent_id = tp.id
AND tp.username = 'geraldmorgan'
AND o.status = 'completed';

-- Now recalculate payouts with correct amounts
TRUNCATE TABLE payouts CASCADE;
TRUNCATE TABLE payout_batches CASCADE;
UPDATE talent_profiles SET total_earnings = 0;

-- Recalculate using the manual function (must exist from previous script)
DO $$
DECLARE
  v_order RECORD;
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_pct DECIMAL(5,2);
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_fulfilled_orders INTEGER;
  v_first_orders_promo_active BOOLEAN;
BEGIN
  FOR v_order IN 
    SELECT id, talent_id, amount, updated_at
    FROM orders
    WHERE status = 'completed' AND video_url IS NOT NULL AND video_url != ''
    ORDER BY updated_at ASC
  LOOP
    SELECT admin_fee_percentage, fulfilled_orders, first_orders_promo_active
    INTO v_admin_fee_pct, v_fulfilled_orders, v_first_orders_promo_active
    FROM talent_profiles WHERE id = v_order.talent_id;
    
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    v_fulfilled_orders := COALESCE(v_fulfilled_orders, 0);
    v_first_orders_promo_active := COALESCE(v_first_orders_promo_active, true);
    
    IF v_first_orders_promo_active AND v_fulfilled_orders < 10 THEN
      v_admin_fee_pct := 0;
    END IF;
    
    v_admin_fee_amount := v_order.amount * (v_admin_fee_pct / 100);
    v_payout_amount := v_order.amount - v_admin_fee_amount;
    v_week_start := (v_order.updated_at::DATE - EXTRACT(DOW FROM v_order.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (v_order.updated_at::DATE - EXTRACT(DOW FROM v_order.updated_at)::INTEGER + 7)::DATE;
    
    INSERT INTO payouts (
      talent_id, order_id, order_amount, admin_fee_percentage,
      admin_fee_amount, payout_amount, status,
      week_start_date, week_end_date, created_at, updated_at
    ) VALUES (
      v_order.talent_id, v_order.id, v_order.amount, v_admin_fee_pct,
      v_admin_fee_amount, v_payout_amount, 'pending',
      v_week_start, v_week_end, v_order.updated_at, NOW()
    );
    
    UPDATE talent_profiles
    SET total_earnings = COALESCE(total_earnings, 0) + v_payout_amount
    WHERE id = v_order.talent_id;
    
    INSERT INTO payout_batches (
      talent_id, week_start_date, week_end_date,
      total_orders, total_payout_amount, net_payout_amount, created_at, updated_at
    ) VALUES (
      v_order.talent_id, v_week_start, v_week_end,
      1, v_payout_amount, v_payout_amount, v_order.updated_at, NOW()
    )
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
      total_orders = payout_batches.total_orders + 1,
      total_payout_amount = payout_batches.total_payout_amount + v_payout_amount,
      net_payout_amount = payout_batches.total_payout_amount + v_payout_amount - payout_batches.total_refunded_amount,
      updated_at = NOW();
  END LOOP;
END $$;

-- Verify the fix
SELECT 
    tp.username,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
ORDER BY tp.username, pb.week_start_date DESC;

