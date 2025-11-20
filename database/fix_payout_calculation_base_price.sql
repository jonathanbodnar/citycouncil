-- Fix payout calculation to use base video price (excluding processing fees)
-- Currently: order.amount includes processing fees
-- Should be: payout based on video price only, minus admin fee after first 10 orders

-- The issue: orders.amount = (video_price + processing_fee) in cents
-- We need to back-calculate the video price by removing the processing fee

CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_order_amount_dollars DECIMAL(10,2);
  v_base_price DECIMAL(10,2);
  v_processing_fee DECIMAL(10,2);
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get admin fee percentage for talent
    SELECT admin_fee_percentage INTO v_admin_fee_pct
    FROM talent_profiles WHERE id = NEW.talent_id;
    
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    
    -- Convert cents to dollars
    v_order_amount_dollars := NEW.amount / 100.0;
    
    -- Back-calculate base price by removing 2.9% processing fee
    -- If total = base + (base * 0.029), then base = total / 1.029
    v_base_price := v_order_amount_dollars / 1.029;
    v_processing_fee := v_order_amount_dollars - v_base_price;
    
    -- Calculate admin fee on BASE PRICE only (not including processing fee)
    v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100);
    
    -- Talent gets: base price minus admin fee
    -- Processing fee is not included in payout calculation
    v_payout_amount := v_base_price - v_admin_fee_amount;
    
    -- Calculate week start (Monday) and end (Sunday)
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
    -- Insert or update payout record
    -- Store base_price (not total order amount) as order_amount
    INSERT INTO payouts (
      talent_id, order_id, order_amount, admin_fee_percentage,
      admin_fee_amount, payout_amount, status,
      week_start_date, week_end_date, created_at, updated_at
    ) VALUES (
      NEW.talent_id, NEW.id, v_base_price, v_admin_fee_pct,
      v_admin_fee_amount, v_payout_amount, 'pending',
      v_week_start, v_week_end, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
      admin_fee_amount = EXCLUDED.admin_fee_amount,
      payout_amount = EXCLUDED.payout_amount,
      updated_at = NOW();
    
    -- Update talent's total earnings
    UPDATE talent_profiles
    SET total_earnings = COALESCE(total_earnings, 0) + v_payout_amount, updated_at = NOW()
    WHERE id = NEW.talent_id;
    
    -- Update or create weekly batch
    INSERT INTO payout_batches (
      talent_id, week_start_date, week_end_date,
      total_orders, total_payout_amount, net_payout_amount,
      created_at, updated_at
    ) VALUES (
      NEW.talent_id, v_week_start, v_week_end,
      1, v_payout_amount, v_payout_amount, NOW(), NOW()
    )
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
      total_orders = payout_batches.total_orders + 1,
      total_payout_amount = payout_batches.total_payout_amount + v_payout_amount,
      net_payout_amount = payout_batches.total_payout_amount + v_payout_amount - payout_batches.total_refunded_amount,
      updated_at = NOW();
      
    RAISE NOTICE 'Payout created: Total $% -> Base $% (minus $% processing fee) -> Admin fee: $% (%%) -> Talent gets: $%', 
      v_order_amount_dollars, v_base_price, v_processing_fee, v_admin_fee_amount, v_admin_fee_pct, v_payout_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now recalculate ALL existing payouts with the new logic
DO $$
DECLARE
  v_payout RECORD;
  v_order_cents BIGINT;
  v_order_total_dollars DECIMAL(10,2);
  v_base_price DECIMAL(10,2);
  v_processing_fee DECIMAL(10,2);
  v_correct_admin_fee DECIMAL(10,2);
  v_correct_payout DECIMAL(10,2);
  v_old_payout_amount DECIMAL(10,2);
  v_payout_delta DECIMAL(10,2);
BEGIN
  RAISE NOTICE '=== Recalculating ALL payouts with base price logic ===';
  
  FOR v_payout IN 
    SELECT 
        p.id, 
        p.order_id, 
        p.talent_id, 
        p.order_amount, 
        p.admin_fee_percentage, 
        p.payout_amount, 
        p.week_start_date, 
        o.amount as order_cents
    FROM payouts p
    JOIN orders o ON o.id = p.order_id
    WHERE NOT p.is_refunded  -- Only fix non-refunded payouts
  LOOP
    v_old_payout_amount := v_payout.payout_amount;
    
    -- Convert cents to dollars
    v_order_total_dollars := v_payout.order_cents / 100.0;
    
    -- Back-calculate base price (remove processing fee)
    v_base_price := v_order_total_dollars / 1.029;
    v_processing_fee := v_order_total_dollars - v_base_price;
    
    -- Calculate admin fee on base price only
    v_correct_admin_fee := v_base_price * (v_payout.admin_fee_percentage / 100);
    
    -- Talent gets base price minus admin fee
    v_correct_payout := v_base_price - v_correct_admin_fee;
    v_payout_delta := v_old_payout_amount - v_correct_payout;
    
    -- Update the payout record
    UPDATE payouts
    SET 
      order_amount = v_base_price,
      admin_fee_amount = v_correct_admin_fee,
      payout_amount = v_correct_payout,
      updated_at = NOW()
    WHERE id = v_payout.id;
    
    -- Adjust talent's total earnings
    UPDATE talent_profiles
    SET 
      total_earnings = GREATEST(
        COALESCE(total_earnings, 0) - v_payout_delta,
        0
      ),
      updated_at = NOW()
    WHERE id = v_payout.talent_id;
    
    IF ABS(v_payout_delta) > 0.01 THEN  -- Only log if significant change
      RAISE NOTICE 'Payout %: Order total $% -> Base $% (-%$ fee) -> Talent $% (was $%)',
        v_payout.order_id::text, v_order_total_dollars, v_base_price, v_processing_fee, v_correct_payout, v_old_payout_amount;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== Recalculation complete! Now recalculating batch totals... ===';
  
  -- Recalculate all batch totals
  FOR v_payout IN 
    SELECT DISTINCT talent_id, week_start_date
    FROM payout_batches
  LOOP
    UPDATE payout_batches pb
    SET 
      total_orders = (
        SELECT COUNT(*)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
      ),
      total_payout_amount = (
        SELECT COALESCE(SUM(payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
      ),
      total_refunded_amount = (
        SELECT COALESCE(SUM(payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded = true
      ),
      updated_at = NOW()
    WHERE pb.talent_id = v_payout.talent_id
    AND pb.week_start_date = v_payout.week_start_date;
    
    -- Recalculate net
    UPDATE payout_batches
    SET net_payout_amount = total_payout_amount - total_refunded_amount
    WHERE talent_id = v_payout.talent_id
    AND week_start_date = v_payout.week_start_date;
  END LOOP;
  
  RAISE NOTICE '=== All payouts and batches recalculated! ===';
END $$;

-- Verify the results
SELECT 
    'Verification - Sample Orders' as check_type,
    o.id::text as order_id,
    o.amount as order_cents,
    (o.amount / 100.0) as order_total_dollars,
    ((o.amount / 100.0) / 1.029) as base_price_calculated,
    p.order_amount as payout_order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount
FROM orders o
JOIN payouts p ON p.order_id = o.id
WHERE NOT p.is_refunded
ORDER BY o.created_at DESC
LIMIT 10;

