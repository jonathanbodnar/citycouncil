-- Fix payouts for ALL talent in their promotional period (first 10 orders = 0% admin fee)
-- Currently they're being charged 25% when they should be charged 0%

-- First, identify all talent in promo period with incorrect payouts
SELECT 
    'Talent in Promo Period with Wrong Fees' as check,
    tp.username,
    tp.fulfilled_orders,
    tp.first_orders_promo_active,
    COUNT(p.id) as payout_count,
    SUM(p.admin_fee_amount) as total_fees_charged,
    SUM(p.payout_amount) as current_total_payout,
    SUM(p.order_amount) as should_be_total_payout
FROM talent_profiles tp
JOIN payouts p ON p.talent_id = tp.id
WHERE tp.first_orders_promo_active = true
AND tp.fulfilled_orders < 10
AND p.admin_fee_percentage > 0  -- They're being charged a fee when they shouldn't
AND NOT p.is_refunded
GROUP BY tp.id, tp.username, tp.fulfilled_orders, tp.first_orders_promo_active
ORDER BY tp.username;

-- Fix ALL payouts for talent in promo period
DO $$
DECLARE
  v_payout RECORD;
  v_old_payout DECIMAL(10,2);
  v_new_payout DECIMAL(10,2);
  v_payout_delta DECIMAL(10,2);
BEGIN
  RAISE NOTICE '=== Fixing payouts for talent in promotional period ===';
  
  FOR v_payout IN 
    SELECT 
        p.id as payout_id,
        p.talent_id,
        p.order_amount as base_price,
        p.admin_fee_amount as old_admin_fee,
        p.payout_amount as old_payout,
        p.week_start_date,
        tp.username
    FROM payouts p
    JOIN talent_profiles tp ON tp.id = p.talent_id
    WHERE tp.first_orders_promo_active = true
    AND tp.fulfilled_orders < 10
    AND p.admin_fee_percentage > 0
    AND NOT p.is_refunded
  LOOP
    v_old_payout := v_payout.old_payout;
    
    -- In promo period: payout = base price (no admin fee)
    v_new_payout := v_payout.base_price;
    v_payout_delta := v_new_payout - v_old_payout;
    
    -- Update the payout
    UPDATE payouts
    SET 
      admin_fee_percentage = 0,
      admin_fee_amount = 0,
      payout_amount = v_new_payout,
      updated_at = NOW()
    WHERE id = v_payout.payout_id;
    
    -- Update talent earnings
    UPDATE talent_profiles
    SET 
      total_earnings = COALESCE(total_earnings, 0) + v_payout_delta,
      updated_at = NOW()
    WHERE id = v_payout.talent_id;
    
    RAISE NOTICE 'Fixed % (talent %): Removed $% admin fee | Payout: $% -> $%',
      v_payout.payout_id, v_payout.username, v_payout.old_admin_fee, v_old_payout, v_new_payout;
  END LOOP;
  
  RAISE NOTICE '=== Recalculating all batch totals ===';
  
  -- Recalculate all affected batch totals
  UPDATE payout_batches pb
  SET 
    total_orders = (
        SELECT COUNT(*)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    total_payout_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    total_refunded_amount = (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded = true
    ),
    net_payout_amount = (
        SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
        FROM payouts p
        WHERE p.talent_id = pb.talent_id
        AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW()
  WHERE pb.talent_id IN (
    SELECT DISTINCT tp.id
    FROM talent_profiles tp
    WHERE tp.first_orders_promo_active = true
    AND tp.fulfilled_orders < 10
  );
  
  RAISE NOTICE '=== Fix complete! ===';
END $$;

-- Show corrected payouts
SELECT 
    'AFTER FIX - Corrected Payouts' as check,
    tp.username,
    o.amount / 100.0 as order_total,
    p.order_amount as base_price,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount as talent_gets,
    pb.net_payout_amount as batch_total
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
LEFT JOIN payout_batches pb ON pb.talent_id = p.talent_id AND pb.week_start_date = p.week_start_date
WHERE tp.first_orders_promo_active = true
AND tp.fulfilled_orders < 10
AND NOT p.is_refunded
ORDER BY p.week_start_date DESC, tp.username, p.created_at;

-- Show batch totals for promo talent
SELECT 
    'Batch Totals for Promo Talent' as check,
    tp.username,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.first_orders_promo_active = true
AND tp.fulfilled_orders < 10
ORDER BY pb.week_start_date DESC, tp.username;

