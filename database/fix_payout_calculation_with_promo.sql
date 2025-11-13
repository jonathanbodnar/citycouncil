-- Fix payout calculation to respect first 10 orders promo (0% admin fee)
-- Talent should get 100% of their order price for first 10 orders, then 25% fee starts

-- 1. Update the payout creation function to check fulfilled_orders count
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
  -- Only process when order status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get talent's admin fee percentage, fulfilled orders count, and promo status
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
    
    -- Default to 25% if not set
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    v_fulfilled_orders := COALESCE(v_fulfilled_orders, 0);
    v_first_orders_promo_active := COALESCE(v_first_orders_promo_active, true);
    
    -- Check if talent is in first 10 orders promo period
    -- If promo is active AND fulfilled_orders < 10, set admin fee to 0%
    IF v_first_orders_promo_active AND v_fulfilled_orders < 10 THEN
      v_admin_fee_pct := 0;
    END IF;
    
    -- Calculate amounts
    v_admin_fee_amount := NEW.amount * (v_admin_fee_pct / 100);
    v_payout_amount := NEW.amount - v_admin_fee_amount;
    
    -- Calculate week dates for this order (Monday-Sunday)
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
    -- Create payout record
    INSERT INTO payouts (
      talent_id,
      order_id,
      order_amount,
      admin_fee_percentage,
      admin_fee_amount,
      payout_amount,
      status,
      week_start_date,
      week_end_date,
      created_at,
      updated_at
    ) VALUES (
      NEW.talent_id,
      NEW.id,
      NEW.amount,
      v_admin_fee_pct,
      v_admin_fee_amount,
      v_payout_amount,
      'pending',
      v_week_start,
      v_week_end,
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
      admin_fee_percentage = EXCLUDED.admin_fee_percentage,
      admin_fee_amount = EXCLUDED.admin_fee_amount,
      payout_amount = EXCLUDED.payout_amount,
      updated_at = NOW();
    
    -- Update talent's total earnings
    UPDATE talent_profiles
    SET 
      total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
      updated_at = NOW()
    WHERE id = NEW.talent_id;
    
    -- Create or update weekly batch
    INSERT INTO payout_batches (
      talent_id,
      week_start_date,
      week_end_date,
      total_orders,
      total_payout_amount,
      net_payout_amount,
      created_at,
      updated_at
    ) VALUES (
      NEW.talent_id,
      v_week_start,
      v_week_end,
      1,
      v_payout_amount,
      v_payout_amount,
      NOW(),
      NOW()
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

-- 2. Recreate the trigger
DROP TRIGGER IF EXISTS on_order_completed_create_payout ON public.orders;
CREATE TRIGGER on_order_completed_create_payout
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION create_payout_on_order_completion();

-- 3. Now recalculate ALL existing payouts with correct admin fee logic
-- This will fix payouts that were calculated with wrong fee percentage

-- Clear existing payouts and batches to recalculate from scratch
TRUNCATE TABLE payouts CASCADE;
TRUNCATE TABLE payout_batches CASCADE;

-- Reset total_earnings for all talent
UPDATE talent_profiles
SET total_earnings = 0;

-- Re-trigger payout creation for all completed orders with videos
-- This will use the updated logic with first 10 orders promo
DO $$
DECLARE
  order_record RECORD;
BEGIN
  FOR order_record IN 
    SELECT id, talent_id, amount, status, updated_at, video_url
    FROM orders
    WHERE status = 'completed'
    AND video_url IS NOT NULL
    AND video_url != ''
    ORDER BY updated_at ASC -- Process in chronological order
  LOOP
    -- Manually trigger the payout creation by simulating the update
    -- We need to manually call the function since we can't re-trigger updates
    PERFORM create_payout_on_order_completion_manual(
      order_record.id,
      order_record.talent_id,
      order_record.amount,
      order_record.updated_at
    );
  END LOOP;
END $$;

-- 4. Create manual payout creation helper function
CREATE OR REPLACE FUNCTION create_payout_on_order_completion_manual(
  p_order_id UUID,
  p_talent_id UUID,
  p_amount DECIMAL(10,2),
  p_updated_at TIMESTAMP WITH TIME ZONE
)
RETURNS VOID AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_fulfilled_orders INTEGER;
  v_first_orders_promo_active BOOLEAN;
BEGIN
  -- Get talent's admin fee percentage, fulfilled orders count, and promo status
  SELECT 
    admin_fee_percentage,
    fulfilled_orders,
    first_orders_promo_active
  INTO 
    v_admin_fee_pct,
    v_fulfilled_orders,
    v_first_orders_promo_active
  FROM talent_profiles
  WHERE id = p_talent_id;
  
  -- Default to 25% if not set
  v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
  v_fulfilled_orders := COALESCE(v_fulfilled_orders, 0);
  v_first_orders_promo_active := COALESCE(v_first_orders_promo_active, true);
  
  -- Check if talent is in first 10 orders promo period
  -- If promo is active AND fulfilled_orders < 10, set admin fee to 0%
  IF v_first_orders_promo_active AND v_fulfilled_orders < 10 THEN
    v_admin_fee_pct := 0;
  END IF;
  
  -- Calculate amounts
  v_admin_fee_amount := p_amount * (v_admin_fee_pct / 100);
  v_payout_amount := p_amount - v_admin_fee_amount;
  
  -- Calculate week dates for this order (Monday-Sunday)
  v_week_start := (p_updated_at::DATE - EXTRACT(DOW FROM p_updated_at)::INTEGER + 1)::DATE;
  v_week_end := (p_updated_at::DATE - EXTRACT(DOW FROM p_updated_at)::INTEGER + 7)::DATE;
  
  -- Create payout record
  INSERT INTO payouts (
    talent_id,
    order_id,
    order_amount,
    admin_fee_percentage,
    admin_fee_amount,
    payout_amount,
    status,
    week_start_date,
    week_end_date,
    created_at,
    updated_at
  ) VALUES (
    p_talent_id,
    p_order_id,
    p_amount,
    v_admin_fee_pct,
    v_admin_fee_amount,
    v_payout_amount,
    'pending',
    v_week_start,
    v_week_end,
    p_updated_at,
    NOW()
  );
  
  -- Update talent's total earnings
  UPDATE talent_profiles
  SET 
    total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
    updated_at = NOW()
  WHERE id = p_talent_id;
  
  -- Create or update weekly batch
  INSERT INTO payout_batches (
    talent_id,
    week_start_date,
    week_end_date,
    total_orders,
    total_payout_amount,
    net_payout_amount,
    created_at,
    updated_at
  ) VALUES (
    p_talent_id,
    v_week_start,
    v_week_end,
    1,
    v_payout_amount,
    v_payout_amount,
    p_updated_at,
    NOW()
  )
  ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
    total_orders = payout_batches.total_orders + 1,
    total_payout_amount = payout_batches.total_payout_amount + v_payout_amount,
    net_payout_amount = payout_batches.total_payout_amount + v_payout_amount - payout_batches.total_refunded_amount,
    updated_at = NOW();
    
END;
$$ LANGUAGE plpgsql;

-- 5. Actually run the manual recalculation
DO $$
DECLARE
  order_record RECORD;
BEGIN
  FOR order_record IN 
    SELECT id, talent_id, amount, status, updated_at, video_url
    FROM orders
    WHERE status = 'completed'
    AND video_url IS NOT NULL
    AND video_url != ''
    ORDER BY updated_at ASC -- Process in chronological order so fulfilled_orders increments correctly
  LOOP
    PERFORM create_payout_on_order_completion_manual(
      order_record.id,
      order_record.talent_id,
      order_record.amount,
      order_record.updated_at
    );
  END LOOP;
END $$;

-- 6. Verify the results for ALL talent with payouts
SELECT 
    tp.username,
    tp.temp_full_name,
    tp.fulfilled_orders,
    tp.first_orders_promo_active,
    tp.admin_fee_percentage,
    tp.total_earnings,
    COUNT(DISTINCT pb.id) as total_batches,
    COALESCE(SUM(pb.total_orders), 0) as total_orders_in_batches,
    COALESCE(SUM(pb.total_payout_amount), 0) as total_payout_amount
FROM talent_profiles tp
LEFT JOIN payout_batches pb ON pb.talent_id = tp.id
GROUP BY tp.id, tp.username, tp.temp_full_name, tp.fulfilled_orders, tp.first_orders_promo_active, tp.admin_fee_percentage, tp.total_earnings
HAVING COUNT(DISTINCT pb.id) > 0 -- Only show talent with payouts
ORDER BY tp.username;

-- Show weekly batches for all talent
SELECT 
    tp.username,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders as orders_in_batch,
    pb.total_payout_amount,
    pb.net_payout_amount,
    pb.status
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
ORDER BY tp.username, pb.week_start_date DESC;

-- Show individual payouts with admin fee details for all talent
SELECT 
    tp.username,
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.is_refunded,
    p.week_start_date,
    p.created_at::date as payout_date
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
ORDER BY tp.username, p.created_at ASC;

