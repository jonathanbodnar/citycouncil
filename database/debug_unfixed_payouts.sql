-- Debug why some payouts weren't fixed
-- Let's look at the specific high-value payouts

-- 1. Check the actual values in both tables
SELECT 
    'Unfixed Payouts Details' as check_type,
    p.id as payout_id,
    p.order_id,
    p.order_amount as payout_order_amount,
    o.amount as order_amount_in_cents,
    p.payout_amount,
    CASE 
        WHEN p.order_amount = o.amount THEN '❌ Payout equals cents (should be fixed!)'
        WHEN p.order_amount = o.amount / 100.0 THEN '✅ Already correct'
        WHEN p.order_amount * 100 = o.amount THEN '✅ Already correct (stored as dollars)'
        ELSE '❓ Other mismatch'
    END as status,
    p.created_at,
    p.updated_at
FROM payouts p
JOIN orders o ON o.id = p.order_id
WHERE p.payout_amount > 10000  -- Focus on the suspiciously high ones
ORDER BY p.payout_amount DESC;

-- 2. Check if these orders exist
SELECT 
    'Orders Check' as check_type,
    o.id,
    o.amount,
    o.amount / 100.0 as amount_in_dollars,
    o.status,
    o.talent_id
FROM orders o
WHERE o.id IN (
    SELECT p.order_id 
    FROM payouts p 
    WHERE p.payout_amount > 10000
);

-- 3. Let's manually fix them
DO $$
DECLARE
  v_payout RECORD;
  v_order_cents BIGINT;
  v_correct_order_amount DECIMAL(10,2);
  v_correct_admin_fee DECIMAL(10,2);
  v_correct_payout DECIMAL(10,2);
  v_old_payout_amount DECIMAL(10,2);
  v_payout_delta DECIMAL(10,2);
BEGIN
  RAISE NOTICE '=== Manual Fix for Remaining High Payouts ===';
  
  -- Find all payouts with amounts over $10,000 (definitely wrong)
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
    WHERE p.payout_amount > 10000  -- Suspiciously high
  LOOP
    v_old_payout_amount := v_payout.payout_amount;
    
    -- Calculate correct amounts
    v_correct_order_amount := v_payout.order_cents / 100.0;
    v_correct_admin_fee := v_correct_order_amount * (v_payout.admin_fee_percentage / 100);
    v_correct_payout := v_correct_order_amount - v_correct_admin_fee;
    v_payout_delta := v_old_payout_amount - v_correct_payout;
    
    RAISE NOTICE 'Fixing payout %: $% -> $% (delta: $%)', 
      v_payout.id, v_old_payout_amount, v_correct_payout, v_payout_delta;
    
    -- Update the payout record
    UPDATE payouts
    SET 
      order_amount = v_correct_order_amount,
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
    
    -- Adjust weekly batch totals
    UPDATE payout_batches
    SET 
      total_payout_amount = GREATEST(
        total_payout_amount - v_payout_delta,
        0
      ),
      net_payout_amount = GREATEST(
        net_payout_amount - v_payout_delta,
        0
      ),
      updated_at = NOW()
    WHERE talent_id = v_payout.talent_id AND week_start_date = v_payout.week_start_date;
    
  END LOOP;
  
  RAISE NOTICE '=== Manual fix complete! ===';
END $$;

-- 4. Verify after manual fix
SELECT 
    'After Manual Fix' as check_type,
    pb.talent_id,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount,
    CASE 
        WHEN pb.total_payout_amount > 10000 THEN '⚠️ Still high!'
        ELSE '✅ Fixed'
    END as status
FROM payout_batches pb
ORDER BY pb.total_payout_amount DESC
LIMIT 15;

