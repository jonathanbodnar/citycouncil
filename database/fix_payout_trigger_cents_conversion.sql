-- Fix payout trigger to properly convert order amounts from cents to dollars
-- Issue: orders.amount is stored in cents, but payout calculations were treating it as dollars
-- This caused payout amounts to be 100x too high

-- Drop and recreate the trigger function with proper cent-to-dollar conversion
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_order_amount_dollars DECIMAL(10,2);
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get admin fee percentage for talent
    SELECT admin_fee_percentage INTO v_admin_fee_pct
    FROM talent_profiles WHERE id = NEW.talent_id;
    
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    
    -- **FIX: Convert cents to dollars** 
    -- orders.amount is stored in cents, so divide by 100
    v_order_amount_dollars := NEW.amount / 100.0;
    
    -- Calculate fees and payout amount based on dollar amount
    v_admin_fee_amount := v_order_amount_dollars * (v_admin_fee_pct / 100);
    v_payout_amount := v_order_amount_dollars - v_admin_fee_amount;
    
    -- Calculate week start (Monday) and end (Sunday)
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
    -- Insert or update payout record
    INSERT INTO payouts (
      talent_id, order_id, order_amount, admin_fee_percentage,
      admin_fee_amount, payout_amount, status,
      week_start_date, week_end_date, created_at, updated_at
    ) VALUES (
      NEW.talent_id, NEW.id, v_order_amount_dollars, v_admin_fee_pct,
      v_admin_fee_amount, v_payout_amount, 'pending',
      v_week_start, v_week_end, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
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
      
    RAISE NOTICE 'Payout created: Order $ % (from % cents) -> Admin fee: % (% %%) -> Talent gets: $ %', 
      v_order_amount_dollars, NEW.amount, v_admin_fee_amount, v_admin_fee_pct, v_payout_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update the refund trigger function
CREATE OR REPLACE FUNCTION handle_order_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_payout_amount DECIMAL(10,2);
  v_week_start DATE;
BEGIN
  IF NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded') THEN
    
    -- Get the payout amount and week
    SELECT payout_amount, week_start_date 
    INTO v_payout_amount, v_week_start
    FROM payouts 
    WHERE order_id = NEW.id;
    
    IF v_payout_amount IS NOT NULL THEN
      -- Mark payout as refunded
      UPDATE payouts 
      SET is_refunded = true, 
          refunded_at = NOW(), 
          refund_reason = NEW.refund_reason
      WHERE order_id = NEW.id;
      
      -- Update talent's total earnings (subtract refunded amount)
      UPDATE talent_profiles
      SET total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_payout_amount, 0), updated_at = NOW()
      WHERE id = NEW.talent_id;
      
      -- Update weekly batch totals
      UPDATE payout_batches
      SET total_refunded_amount = total_refunded_amount + v_payout_amount,
          net_payout_amount = total_payout_amount - (total_refunded_amount + v_payout_amount),
          updated_at = NOW()
      WHERE talent_id = NEW.talent_id AND week_start_date = v_week_start;
      
      RAISE NOTICE 'Payout refunded: Order % - $ % removed from talent earnings', NEW.id, v_payout_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now fix all existing incorrect payout records
-- This will recalculate all payouts where order_amount looks suspiciously high (> $1000)

DO $$
DECLARE
  v_payout RECORD;
  v_order_cents BIGINT;
  v_correct_order_amount DECIMAL(10,2);
  v_correct_admin_fee DECIMAL(10,2);
  v_correct_payout DECIMAL(10,2);
  v_old_payout_amount DECIMAL(10,2);
  v_week_start DATE;
BEGIN
  RAISE NOTICE 'Starting payout amount correction...';
  
  -- Find all payouts with suspiciously high amounts (likely using cents as dollars)
  FOR v_payout IN 
    SELECT p.id, p.order_id, p.talent_id, p.order_amount, p.admin_fee_percentage, 
           p.payout_amount, p.week_start_date, o.amount as order_cents
    FROM payouts p
    JOIN orders o ON o.id = p.order_id
    WHERE p.order_amount > 1000 -- Suspiciously high, likely treating cents as dollars
    AND p.order_amount = o.amount -- Confirm it's using cents directly
  LOOP
    -- Store old values for batch adjustment
    v_old_payout_amount := v_payout.payout_amount;
    v_week_start := v_payout.week_start_date;
    
    -- Calculate correct amounts (convert cents to dollars)
    v_correct_order_amount := v_payout.order_cents / 100.0;
    v_correct_admin_fee := v_correct_order_amount * (v_payout.admin_fee_percentage / 100);
    v_correct_payout := v_correct_order_amount - v_correct_admin_fee;
    
    -- Update the payout record
    UPDATE payouts
    SET 
      order_amount = v_correct_order_amount,
      admin_fee_amount = v_correct_admin_fee,
      payout_amount = v_correct_payout,
      updated_at = NOW()
    WHERE id = v_payout.id;
    
    -- Adjust talent's total earnings (subtract old, add new)
    UPDATE talent_profiles
    SET 
      total_earnings = GREATEST(
        COALESCE(total_earnings, 0) - v_old_payout_amount + v_correct_payout, 
        0
      ),
      updated_at = NOW()
    WHERE id = v_payout.talent_id;
    
    -- Adjust weekly batch totals
    UPDATE payout_batches
    SET 
      total_payout_amount = GREATEST(
        total_payout_amount - v_old_payout_amount + v_correct_payout,
        0
      ),
      net_payout_amount = GREATEST(
        net_payout_amount - v_old_payout_amount + v_correct_payout,
        0
      ),
      updated_at = NOW()
    WHERE talent_id = v_payout.talent_id AND week_start_date = v_week_start;
    
    RAISE NOTICE 'Fixed payout for order %: $ % -> $ %', 
      v_payout.order_id, v_payout.order_amount, v_correct_order_amount;
  END LOOP;
  
  RAISE NOTICE 'Payout amount correction complete!';
END $$;

-- Verify the fixes
SELECT 
    'After Fix - Sample Payouts' as check_type,
    p.order_id,
    o.amount as order_cents,
    p.order_amount as payout_order_dollars,
    p.admin_fee_amount,
    p.payout_amount,
    CASE 
        WHEN p.order_amount = o.amount / 100.0 THEN '✅ CORRECT'
        WHEN p.order_amount = o.amount THEN '❌ STILL WRONG'
        ELSE '❓ UNCLEAR'
    END as status
FROM payouts p
JOIN orders o ON o.id = p.order_id
ORDER BY p.created_at DESC
LIMIT 10;

