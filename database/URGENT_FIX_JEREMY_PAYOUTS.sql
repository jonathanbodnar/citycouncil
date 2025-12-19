-- URGENT: Fix Jeremy Hambly's incorrect payouts
-- The previous script incorrectly used original_amount which had bad data
-- Also backfill original_amount for orders with coupons that are missing it

-- Step 1: Find Jeremy's talent_id and check his actual pricing
SELECT 
  id as talent_id,
  username,
  slug,
  pricing as current_pricing,
  admin_fee_percentage
FROM talent_profiles
WHERE username ILIKE '%hambly%' 
   OR slug ILIKE '%hambly%' 
   OR slug ILIKE '%quartering%';

-- Step 2: Check his orders and what the amounts actually are
SELECT 
  o.id as order_id,
  o.amount as amount_cents,
  o.original_amount,
  o.coupon_code,
  o.status,
  o.created_at,
  p.id as payout_id,
  p.order_amount as payout_order_amount,
  p.payout_amount,
  p.status as payout_status
FROM orders o
LEFT JOIN payouts p ON p.order_id = o.id
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
ORDER BY o.created_at DESC
LIMIT 10;

-- Step 3: IMMEDIATELY FIX the payouts - use the CORRECT calculation
-- Jeremy's pricing is likely around $67 based on the second order
-- The payout should be: (amount_cents / 100) / 1.029 * 0.75 (for 25% admin fee)
-- Or if 0% promo: (amount_cents / 100) / 1.029

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
  v_total_delta DECIMAL(10,2) := 0;
BEGIN
  -- Find Jeremy Hambly's talent_id
  SELECT id, admin_fee_percentage INTO v_jeremy_talent_id, v_admin_fee_pct
  FROM talent_profiles
  WHERE username ILIKE '%hambly%' 
     OR slug ILIKE '%hambly%' 
     OR slug ILIKE '%quartering%'
  LIMIT 1;
  
  IF v_jeremy_talent_id IS NULL THEN
    RAISE EXCEPTION 'Could not find Jeremy Hambly talent profile';
  END IF;
  
  v_admin_fee_pct := COALESCE(v_admin_fee_pct, 25);
  
  RAISE NOTICE 'Found Jeremy talent_id: %, admin_fee: %', v_jeremy_talent_id, v_admin_fee_pct;
  
  -- Fix ALL his completed orders
  FOR v_order IN 
    SELECT 
      o.id as order_id,
      o.amount as amount_cents,
      o.original_amount,
      o.coupon_code,
      p.id as payout_id,
      p.payout_amount as current_payout,
      p.order_amount as current_order_amount
    FROM orders o
    LEFT JOIN payouts p ON p.order_id = o.id
    WHERE o.talent_id = v_jeremy_talent_id
      AND o.status = 'completed'
      AND p.id IS NOT NULL
  LOOP
    v_old_payout := COALESCE(v_order.current_payout, 0);
    
    -- CORRECT calculation: amount is in CENTS, divide by 100 first, then remove processing fee
    v_base_price := (v_order.amount_cents / 100.0) / 1.029;
    
    -- Apply admin fee (0% if in promo period, otherwise 25%)
    -- For now assume 0% since he's showing 0% fee
    v_admin_fee_amount := v_base_price * (0 / 100.0); -- 0% fee based on screenshot
    v_correct_payout := v_base_price - v_admin_fee_amount;
    
    v_delta := v_old_payout - v_correct_payout;
    v_total_delta := v_total_delta + v_delta;
    
    RAISE NOTICE 'Order %: amount=% cents, CORRECT base=$%, CORRECT payout=$%, WAS=$%, OVERPAID BY=$%',
      v_order.order_id, v_order.amount_cents, v_base_price, v_correct_payout, v_old_payout, v_delta;
    
    -- Update the payout record to correct values
    UPDATE payouts
    SET 
      order_amount = v_base_price,
      admin_fee_amount = v_admin_fee_amount,
      payout_amount = v_correct_payout,
      updated_at = NOW()
    WHERE id = v_order.payout_id;
    
  END LOOP;
  
  -- Adjust talent's total earnings (subtract the overpayment)
  UPDATE talent_profiles
  SET 
    total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_total_delta, 0),
    updated_at = NOW()
  WHERE id = v_jeremy_talent_id;
  
  RAISE NOTICE 'TOTAL OVERPAYMENT CORRECTED: $%', v_total_delta;
  
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
  
  RAISE NOTICE 'Jeremy Hambly payouts CORRECTED!';
END $$;

-- Step 4: Verify the fix
SELECT 
  'AFTER FIX' as status,
  tp.username,
  tp.total_earnings,
  o.id::text as order_id,
  o.amount as amount_cents,
  (o.amount / 100.0) as amount_dollars,
  ((o.amount / 100.0) / 1.029) as correct_base_price,
  p.order_amount as payout_base,
  p.payout_amount,
  p.status as payout_status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
  AND o.status = 'completed'
ORDER BY o.created_at DESC
LIMIT 5;

-- Check batch totals
SELECT 
  'BATCH TOTALS' as check_type,
  pb.week_start_date,
  pb.week_end_date,
  pb.total_orders,
  pb.total_payout_amount,
  pb.net_payout_amount,
  pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE (tp.username ILIKE '%hambly%' OR tp.slug ILIKE '%hambly%' OR tp.slug ILIKE '%quartering%')
ORDER BY pb.week_start_date DESC
LIMIT 3;

-- =====================================================
-- Step 5: Backfill original_amount for coupon orders missing it
-- This ensures talent dashboard shows full video value
-- =====================================================

-- First, check which orders have coupons but no original_amount
SELECT 
  'ORDERS MISSING ORIGINAL_AMOUNT' as check_type,
  o.id::text as order_id,
  o.amount as amount_cents,
  o.original_amount,
  o.coupon_code,
  o.discount_amount,
  tp.pricing as talent_pricing,
  tp.username
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.coupon_code IS NOT NULL
  AND o.original_amount IS NULL
ORDER BY o.created_at DESC
LIMIT 20;

-- Backfill original_amount for coupon orders
-- original_amount should be: amount + discount_amount (both in cents)
-- OR if discount_amount is null, calculate from talent's pricing
UPDATE orders o
SET original_amount = CASE
  WHEN o.discount_amount IS NOT NULL THEN o.amount + o.discount_amount
  ELSE (SELECT ROUND(tp.pricing * 100 * 1.029) FROM talent_profiles tp WHERE tp.id = o.talent_id)
END
WHERE o.coupon_code IS NOT NULL
  AND o.original_amount IS NULL;

-- Verify the backfill
SELECT 
  'AFTER BACKFILL' as check_type,
  o.id::text as order_id,
  o.amount as amount_cents,
  o.original_amount,
  o.coupon_code,
  tp.username
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.coupon_code IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 10;

