-- FINAL FIX: Remove first 10 orders promo and fix payout calculations
-- 1. Remove first_orders_promo_active for all talent (except historical data)
-- 2. Fix payout trigger to always use 25% admin fee
-- 3. Fix Phillip G's order for Jeremy Hambly
-- 4. Ensure orders tab shows talent video price

-- =====================================================
-- Step 1: Disable first 10 orders promo for ALL talent
-- =====================================================
UPDATE talent_profiles
SET 
  first_orders_promo_active = false,
  updated_at = NOW();

SELECT 'First 10 orders promo disabled for all talent' as status, COUNT(*) as talent_count FROM talent_profiles;

-- =====================================================
-- Step 2: Update payout trigger - ALWAYS 25% admin fee
-- Talent payout = Talent's video price - 25% admin fee
-- Uses talent's pricing, NOT the order amount (which may be discounted)
-- =====================================================
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2) := 25; -- ALWAYS 25%
  v_talent_pricing DECIMAL(10,2);
  v_needs_review BOOLEAN := FALSE;
  v_review_reason TEXT := NULL;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get talent's current pricing (this is what they get paid on)
    SELECT pricing INTO v_talent_pricing
    FROM talent_profiles 
    WHERE id = NEW.talent_id;
    
    -- Fallback if pricing is null
    IF v_talent_pricing IS NULL OR v_talent_pricing <= 0 THEN
      -- Use order amount as fallback, convert from cents
      v_talent_pricing := (NEW.amount / 100.0) / 1.029;
      RAISE NOTICE 'Warning: Talent pricing was null, using order amount: $%', v_talent_pricing;
    END IF;
    
    -- Calculate admin fee (ALWAYS 25%)
    v_admin_fee_amount := v_talent_pricing * (v_admin_fee_pct / 100);
    
    -- Talent payout = their video price - 25% admin fee
    v_payout_amount := v_talent_pricing - v_admin_fee_amount;
    
    -- SAFEGUARDS: Check for suspicious amounts
    IF v_payout_amount > 1000.00 THEN
      v_needs_review := TRUE;
      v_review_reason := COALESCE(v_review_reason, '') || 'Payout amount exceeds $1000. ';
    END IF;
    
    -- Calculate week start (Monday) and end (Sunday)
    v_week_start := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (NEW.updated_at::DATE - EXTRACT(DOW FROM NEW.updated_at)::INTEGER + 7)::DATE;
    
    -- Insert or update payout record
    INSERT INTO payouts (
      talent_id, order_id, order_amount, admin_fee_percentage,
      admin_fee_amount, payout_amount, status,
      week_start_date, week_end_date, created_at, updated_at
    ) VALUES (
      NEW.talent_id, NEW.id, v_talent_pricing, v_admin_fee_pct,
      v_admin_fee_amount, v_payout_amount, 
      CASE WHEN v_needs_review THEN 'pending_review' ELSE 'pending' END,
      v_week_start, v_week_end, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      order_amount = EXCLUDED.order_amount,
      admin_fee_percentage = EXCLUDED.admin_fee_percentage,
      admin_fee_amount = EXCLUDED.admin_fee_amount,
      payout_amount = EXCLUDED.payout_amount,
      status = EXCLUDED.status,
      updated_at = NOW();
    
    -- Update talent's total earnings (only if not flagged for review)
    IF NOT v_needs_review THEN
      UPDATE talent_profiles
      SET total_earnings = COALESCE(total_earnings, 0) + v_payout_amount, updated_at = NOW()
      WHERE id = NEW.talent_id;
    END IF;
    
    -- Update or create weekly batch
    INSERT INTO payout_batches (
      talent_id, week_start_date, week_end_date,
      total_orders, total_payout_amount, net_payout_amount,
      status, needs_review, review_reason,
      created_at, updated_at
    ) VALUES (
      NEW.talent_id, v_week_start, v_week_end,
      1, v_payout_amount, v_payout_amount, 
      CASE WHEN v_needs_review THEN 'pending_review' ELSE 'pending' END,
      v_needs_review, v_review_reason,
      NOW(), NOW()
    )
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
      total_orders = payout_batches.total_orders + 1,
      total_payout_amount = payout_batches.total_payout_amount + EXCLUDED.total_payout_amount,
      net_payout_amount = payout_batches.net_payout_amount + EXCLUDED.net_payout_amount,
      status = CASE 
        WHEN payout_batches.status = 'pending_review' OR v_needs_review THEN 'pending_review'
        ELSE 'pending'
      END,
      needs_review = payout_batches.needs_review OR v_needs_review,
      review_reason = CASE
        WHEN payout_batches.review_reason IS NULL THEN v_review_reason
        WHEN v_review_reason IS NULL THEN payout_batches.review_reason
        ELSE payout_batches.review_reason || v_review_reason
      END,
      updated_at = NOW();
      
    RAISE NOTICE 'Payout created: Talent price $%, Admin fee $% (25 percent), Talent payout $%', 
      v_talent_pricing, v_admin_fee_amount, v_payout_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make sure trigger is attached
DROP TRIGGER IF EXISTS trigger_create_payout_on_completion ON orders;
CREATE TRIGGER trigger_create_payout_on_completion
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_payout_on_order_completion();

-- =====================================================
-- Step 3: Fix Jeremy Hambly's orders - especially Phillip G
-- Set original_amount to talent's pricing (in cents) for display
-- =====================================================

DO $$
DECLARE
  v_jeremy_talent_id UUID;
  v_jeremy_pricing DECIMAL(10,2);
  v_order RECORD;
  v_correct_payout DECIMAL(10,2);
  v_admin_fee DECIMAL(10,2);
  v_old_payout DECIMAL(10,2);
  v_delta DECIMAL(10,2);
  v_total_delta DECIMAL(10,2) := 0;
BEGIN
  -- Find Jeremy Hambly
  SELECT id, pricing INTO v_jeremy_talent_id, v_jeremy_pricing
  FROM talent_profiles
  WHERE username ILIKE '%hambly%' 
     OR slug ILIKE '%hambly%' 
     OR slug ILIKE '%quartering%'
  LIMIT 1;
  
  IF v_jeremy_talent_id IS NULL THEN
    RAISE EXCEPTION 'Could not find Jeremy Hambly';
  END IF;
  
  RAISE NOTICE 'Found Jeremy: talent_id=%, pricing=$%', v_jeremy_talent_id, v_jeremy_pricing;
  
  -- Fix ALL his orders: set original_amount to his pricing (in cents) for dashboard display
  UPDATE orders
  SET original_amount = ROUND(v_jeremy_pricing * 100 * 1.029) -- pricing + processing fee in cents
  WHERE talent_id = v_jeremy_talent_id
    AND original_amount IS NULL OR original_amount > 100000; -- Fix null or obviously wrong values
  
  -- Now fix his payouts for completed orders
  FOR v_order IN 
    SELECT 
      o.id as order_id,
      o.amount as amount_cents,
      p.id as payout_id,
      p.payout_amount as current_payout,
      p.admin_fee_percentage as current_fee_pct
    FROM orders o
    LEFT JOIN payouts p ON p.order_id = o.id
    WHERE o.talent_id = v_jeremy_talent_id
      AND o.status = 'completed'
      AND p.id IS NOT NULL
  LOOP
    v_old_payout := COALESCE(v_order.current_payout, 0);
    
    -- Correct calculation: talent pricing - 25% admin fee
    -- Use current admin fee if it was 0% (historical promo), otherwise recalculate
    IF v_order.current_fee_pct = 0 THEN
      -- This was a promo order, keep it at 0% fee
      v_admin_fee := 0;
      v_correct_payout := v_jeremy_pricing;
    ELSE
      -- Standard 25% fee
      v_admin_fee := v_jeremy_pricing * 0.25;
      v_correct_payout := v_jeremy_pricing - v_admin_fee;
    END IF;
    
    v_delta := v_old_payout - v_correct_payout;
    v_total_delta := v_total_delta + v_delta;
    
    RAISE NOTICE 'Order %: pricing=$%, admin_fee=$%, correct_payout=$%, was=$%, delta=$%',
      v_order.order_id, v_jeremy_pricing, v_admin_fee, v_correct_payout, v_old_payout, v_delta;
    
    -- Update the payout
    UPDATE payouts
    SET 
      order_amount = v_jeremy_pricing,
      admin_fee_amount = v_admin_fee,
      payout_amount = v_correct_payout,
      updated_at = NOW()
    WHERE id = v_order.payout_id;
    
  END LOOP;
  
  -- Adjust total earnings
  IF v_total_delta != 0 THEN
    UPDATE talent_profiles
    SET 
      total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_total_delta, 0),
      updated_at = NOW()
    WHERE id = v_jeremy_talent_id;
    
    RAISE NOTICE 'Adjusted total_earnings by -$%', v_total_delta;
  END IF;
  
  -- Recalculate batch totals
  UPDATE payout_batches pb
  SET 
    total_payout_amount = (
      SELECT COALESCE(SUM(payout_amount), 0)
      FROM payouts p
      WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND NOT COALESCE(p.is_refunded, false)
    ),
    net_payout_amount = (
      SELECT COALESCE(SUM(payout_amount), 0)
      FROM payouts p
      WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND NOT COALESCE(p.is_refunded, false)
    ),
    updated_at = NOW()
  WHERE pb.talent_id = v_jeremy_talent_id;
  
  RAISE NOTICE 'Jeremy Hambly orders and payouts FIXED!';
END $$;

-- =====================================================
-- Step 4: Verify the fixes
-- =====================================================

-- Check Jeremy's orders now
SELECT 
  'JEREMY ORDERS AFTER FIX' as status,
  o.id::text as order_id,
  o.amount as amount_cents,
  o.original_amount,
  o.coupon_code,
  (o.original_amount / 100.0) as display_price,
  p.order_amount as payout_base,
  p.admin_fee_percentage,
  p.admin_fee_amount,
  p.payout_amount
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
ORDER BY o.created_at DESC
LIMIT 10;

-- Check his total earnings
SELECT 
  'JEREMY EARNINGS' as status,
  username,
  pricing,
  total_earnings,
  first_orders_promo_active
FROM talent_profiles
WHERE username ILIKE '%hambly%' OR slug ILIKE '%hambly%' OR slug ILIKE '%quartering%';

-- Check batch totals
SELECT 
  'JEREMY BATCHES' as status,
  pb.week_start_date,
  pb.total_orders,
  pb.total_payout_amount,
  pb.net_payout_amount,
  pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
ORDER BY pb.week_start_date DESC
LIMIT 5;

