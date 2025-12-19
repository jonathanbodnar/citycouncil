-- Fix payout calculation to use ORIGINAL video price (before coupon discount)
-- This ensures talent get paid based on full video value minus admin fee
-- regardless of what coupon the customer used

-- Step 1: Update the trigger to use original_amount when available
CREATE OR REPLACE FUNCTION create_payout_on_order_completion()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_fulfilled_orders INTEGER;
  v_first_orders_promo_active BOOLEAN;
  v_base_price DECIMAL(10,2);
  v_talent_pricing DECIMAL(10,2);
  v_needs_review BOOLEAN := FALSE;
  v_review_reason TEXT := NULL;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get talent's current pricing and promo status
    SELECT 
      pricing,
      admin_fee_percentage,
      fulfilled_orders,
      first_orders_promo_active
    INTO 
      v_talent_pricing,
      v_admin_fee_pct,
      v_fulfilled_orders,
      v_first_orders_promo_active
    FROM talent_profiles 
    WHERE id = NEW.talent_id;
    
    v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
    v_fulfilled_orders := COALESCE(v_fulfilled_orders, 0);
    v_first_orders_promo_active := COALESCE(v_first_orders_promo_active, true);
    
    -- IMPORTANT: Use original_amount (full price before coupon) if available
    -- This ensures talent get paid on full video value, not discounted amount
    IF NEW.original_amount IS NOT NULL AND NEW.original_amount > 0 THEN
      -- original_amount is stored in dollars, use it directly
      v_base_price := NEW.original_amount;
      RAISE NOTICE 'Using original_amount (full price): $%', v_base_price;
    ELSE
      -- Fallback: Convert amount from cents to dollars and remove processing fee
      -- amount in cents / 100 / 1.029 to remove 2.9% processing fee
      v_base_price := (NEW.amount / 100.0) / 1.029;
      RAISE NOTICE 'Using calculated base price from amount: $%', v_base_price;
    END IF;
    
    -- Apply 0% admin fee for first 10 orders if promo is active
    IF v_first_orders_promo_active AND v_fulfilled_orders < 10 THEN
      v_admin_fee_pct := 0;
      RAISE NOTICE 'First 10 orders promo active - 0 percent admin fee';
    END IF;
    
    -- Calculate admin fee and payout amount
    v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100);
    v_payout_amount := v_base_price - v_admin_fee_amount;
    
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
      NEW.talent_id, NEW.id, v_base_price, v_admin_fee_pct,
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
      
    RAISE NOTICE 'Payout created: Base price $%, Admin fee $%, Talent payout $%', 
      v_base_price, v_admin_fee_amount, v_payout_amount;
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
-- Step 2: Fix Jeremy Hambly's last 2 orders
-- =====================================================

-- First, let's find Jeremy Hambly's talent_id and recent orders
DO $$
DECLARE
  v_jeremy_talent_id UUID;
  v_order RECORD;
  v_base_price DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_admin_fee_amount DECIMAL(10,2);
  v_correct_payout DECIMAL(10,2);
  v_old_payout DECIMAL(10,2);
  v_delta DECIMAL(10,2);
BEGIN
  -- Find Jeremy Hambly's talent_id
  SELECT id INTO v_jeremy_talent_id
  FROM talent_profiles
  WHERE username ILIKE '%hambly%' 
     OR slug ILIKE '%hambly%' 
     OR slug ILIKE '%quartering%'
  LIMIT 1;
  
  IF v_jeremy_talent_id IS NULL THEN
    RAISE NOTICE 'Could not find Jeremy Hambly talent profile';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found Jeremy Hambly talent_id: %', v_jeremy_talent_id;
  
  -- Get his admin fee percentage
  SELECT admin_fee_percentage INTO v_admin_fee_pct
  FROM talent_profiles WHERE id = v_jeremy_talent_id;
  v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
  
  -- Fix his last 2 completed orders with coupons
  FOR v_order IN 
    SELECT 
      o.id as order_id,
      o.amount,
      o.original_amount,
      o.coupon_code,
      p.id as payout_id,
      p.order_amount as current_order_amount,
      p.payout_amount as current_payout
    FROM orders o
    LEFT JOIN payouts p ON p.order_id = o.id
    WHERE o.talent_id = v_jeremy_talent_id
      AND o.status = 'completed'
    ORDER BY o.created_at DESC
    LIMIT 2
  LOOP
    -- Use original_amount if available, otherwise calculate from amount
    IF v_order.original_amount IS NOT NULL AND v_order.original_amount > 0 THEN
      v_base_price := v_order.original_amount;
    ELSE
      v_base_price := (v_order.amount / 100.0) / 1.029;
    END IF;
    
    v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100);
    v_correct_payout := v_base_price - v_admin_fee_amount;
    v_old_payout := COALESCE(v_order.current_payout, 0);
    v_delta := v_correct_payout - v_old_payout;
    
    RAISE NOTICE 'Order %: original_amount=$%, amount=% cents, base_price=$%, admin_fee=$%, correct_payout=$%, old_payout=$%, delta=$%',
      v_order.order_id, v_order.original_amount, v_order.amount, v_base_price, v_admin_fee_amount, v_correct_payout, v_old_payout, v_delta;
    
    -- Update the payout record
    IF v_order.payout_id IS NOT NULL THEN
      UPDATE payouts
      SET 
        order_amount = v_base_price,
        admin_fee_amount = v_admin_fee_amount,
        payout_amount = v_correct_payout,
        updated_at = NOW()
      WHERE id = v_order.payout_id;
      
      -- Adjust talent's total earnings
      IF ABS(v_delta) > 0.01 THEN
        UPDATE talent_profiles
        SET 
          total_earnings = COALESCE(total_earnings, 0) + v_delta,
          updated_at = NOW()
        WHERE id = v_jeremy_talent_id;
        
        RAISE NOTICE 'Updated payout and adjusted total_earnings by $%', v_delta;
      END IF;
    ELSE
      RAISE NOTICE 'No payout record found for order %, skipping', v_order.order_id;
    END IF;
  END LOOP;
  
  -- Recalculate batch totals for Jeremy
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
  
  RAISE NOTICE 'Jeremy Hambly payouts updated!';
END $$;

-- Verify the fix
SELECT 
  'Jeremy Hambly Orders' as check_type,
  tp.username,
  o.id::text as order_id,
  o.amount as amount_cents,
  o.original_amount,
  o.coupon_code,
  p.order_amount as payout_base_price,
  p.admin_fee_percentage,
  p.admin_fee_amount,
  p.payout_amount
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
  AND o.status = 'completed'
ORDER BY o.created_at DESC
LIMIT 5;

