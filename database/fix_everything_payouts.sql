-- COMPLETE FIX: Order amounts + Payout calculation with first 10 orders promo
-- This combines both fixes into one script

-- STEP 1: Update trigger function to respect first 10 orders promo
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_fulfilled_orders INTEGER;
  v_first_orders_promo_active BOOLEAN;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    SELECT 
      admin_fee_percentage,
      fulfilled_orders,
      first_orders_promo_active
    INTO 
      v_admin_fee_pct,
      v_fulfilled_orders,
      v_first_orders_promo_active
    FROM talent_profiles
    WHERE id = NEW.talent_id;
    
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    v_fulfilled_orders := COALESCE(v_fulfilled_orders, 0);
    v_first_orders_promo_active := COALESCE(v_first_orders_promo_active, true);
    
    -- First 10 orders get 0% admin fee
    IF v_first_orders_promo_active AND v_fulfilled_orders < 10 THEN
      v_admin_fee_pct := 0;
    END IF;
    
    v_admin_fee_amount := NEW.amount * (v_admin_fee_pct / 100);
    v_payout_amount := NEW.amount - v_admin_fee_amount;
    
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
    INSERT INTO payouts (
      talent_id, order_id, order_amount, admin_fee_percentage,
      admin_fee_amount, payout_amount, status,
      week_start_date, week_end_date, created_at, updated_at
    ) VALUES (
      NEW.talent_id, NEW.id, NEW.amount, v_admin_fee_pct,
      v_admin_fee_amount, v_payout_amount, 'pending',
      v_week_start, v_week_end, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
      admin_fee_percentage = EXCLUDED.admin_fee_percentage,
      admin_fee_amount = EXCLUDED.admin_fee_amount,
      payout_amount = EXCLUDED.payout_amount,
      updated_at = NOW();
    
    UPDATE talent_profiles
    SET total_earnings = COALESCE(total_earnings, 0) + v_payout_amount, updated_at = NOW()
    WHERE id = NEW.talent_id;
    
    INSERT INTO payout_batches (
      talent_id, week_start_date, week_end_date,
      total_orders, total_payout_amount, net_payout_amount, created_at, updated_at
    ) VALUES (
      NEW.talent_id, v_week_start, v_week_end,
      1, v_payout_amount, v_payout_amount, NOW(), NOW()
    )
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
      total_orders = payout_batches.total_orders + 1,
      total_payout_amount = payout_batches.total_payout_amount + v_payout_amount,
      net_payout_amount = payout_batches.total_payout_amount + v_payout_amount - payout_batches.total_refunded_amount,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_completed_create_payout ON public.orders;
CREATE TRIGGER on_order_completed_create_payout
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION create_payout_on_order_completion();

-- STEP 2: Fix order amounts (divide by 100 if over $100)
-- Most talent orders should be $25-$300, so anything over $100 is likely 100x too high
UPDATE orders
SET amount = ROUND(amount / 100, 2), updated_at = NOW()
WHERE amount > 100;

-- STEP 3: Clear and recalculate all payouts
TRUNCATE TABLE payouts CASCADE;
TRUNCATE TABLE payout_batches CASCADE;
UPDATE talent_profiles SET total_earnings = 0;

-- STEP 4: Manually recalculate each completed order
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

-- STEP 5: Verify results
SELECT 
    tp.username,
    tp.fulfilled_orders,
    tp.first_orders_promo_active,
    tp.total_earnings,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
ORDER BY tp.username, pb.week_start_date DESC;

