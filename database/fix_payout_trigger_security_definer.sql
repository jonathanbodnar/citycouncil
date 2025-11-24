-- Fix the payout trigger function to use SECURITY DEFINER
-- This allows it to bypass RLS when inserting payout records

-- Drop and recreate the trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER 
SECURITY DEFINER  -- This is the critical fix!
SET search_path = public
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
BEGIN
  -- Only process when:
  -- 1. Order status is 'completed'
  -- 2. Video URL is now set (video was just delivered)
  -- 3. We haven't already created a payout for this order
  IF NEW.status = 'completed' 
     AND NEW.video_url IS NOT NULL 
     AND (OLD.video_url IS NULL OR OLD.video_url = '')
     AND NOT EXISTS (SELECT 1 FROM payouts WHERE order_id = NEW.id)
  THEN
    
    -- Get talent's admin fee percentage
    SELECT admin_fee_percentage INTO v_admin_fee_pct
    FROM talent_profiles
    WHERE id = NEW.talent_id;
    
    -- Default to 25% if not set
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    
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
    
    RAISE NOTICE '✅ Payout created for order % - talent earns $%', NEW.id, v_payout_amount;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function now has SECURITY DEFINER
SELECT 
    '✅ FUNCTION UPDATED' AS status,
    proname AS function_name,
    prosecdef AS is_security_definer
FROM pg_proc
WHERE proname = 'create_payout_on_order_completion';

SELECT '✅ Trigger function now has SECURITY DEFINER - RLS will be bypassed!' AS result;

