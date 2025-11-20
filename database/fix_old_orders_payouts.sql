-- Debug and fix old order payouts that are showing incorrect amounts
-- These orders seem to have much lower payout amounts than expected

-- First, let's see what's actually in the database for these orders
SELECT 
    'Old Orders - Current State' as check_type,
    tp.username as talent_username,
    u.full_name as talent_name,
    o.id as order_id,
    o.amount as order_amount_cents,
    o.amount / 100.0 as order_amount_dollars,
    o.admin_fee as stored_admin_fee_cents,
    o.admin_fee / 100.0 as stored_admin_fee_dollars,
    o.created_at,
    p.order_amount as payout_order_amount,
    p.admin_fee_percentage as payout_admin_fee_pct,
    p.admin_fee_amount as payout_admin_fee,
    p.payout_amount as payout_talent_gets,
    pb.net_payout_amount as batch_net_total
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN payouts p ON p.order_id = o.id
LEFT JOIN payout_batches pb ON pb.talent_id = o.talent_id AND pb.week_start_date = p.week_start_date
WHERE o.status = 'completed'
AND tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine')
ORDER BY o.created_at DESC;

-- Check if orders have the admin_fee field populated
SELECT 
    'Orders Admin Fee Check' as check_type,
    COUNT(*) as total_completed_orders,
    COUNT(CASE WHEN admin_fee IS NOT NULL AND admin_fee > 0 THEN 1 END) as orders_with_admin_fee,
    COUNT(CASE WHEN admin_fee IS NULL OR admin_fee = 0 THEN 1 END) as orders_without_admin_fee
FROM orders
WHERE status = 'completed';

-- Now let's recalculate using BOTH the stored admin_fee AND the talent's admin_fee_percentage
DO $$
DECLARE
  v_order RECORD;
  v_order_total_dollars DECIMAL(10,2);
  v_base_price DECIMAL(10,2);
  v_processing_fee DECIMAL(10,2);
  v_admin_fee_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_old_payout_amount DECIMAL(10,2);
BEGIN
  RAISE NOTICE '=== Fixing Old Order Payouts ===';
  
  FOR v_order IN 
    SELECT 
        o.id as order_id,
        o.talent_id,
        o.amount as order_cents,
        o.admin_fee as stored_admin_fee_cents,
        tp.admin_fee_percentage as talent_admin_fee_pct,
        p.id as payout_id,
        p.payout_amount as old_payout_amount,
        p.week_start_date
    FROM orders o
    JOIN talent_profiles tp ON tp.id = o.talent_id
    LEFT JOIN payouts p ON p.order_id = o.id
    WHERE o.status = 'completed'
    AND p.id IS NOT NULL  -- Only fix orders that have payouts
  LOOP
    v_old_payout_amount := v_order.old_payout_amount;
    
    -- Convert order amount from cents to dollars
    v_order_total_dollars := v_order.order_cents / 100.0;
    
    -- Back-calculate base price by removing 2.9% processing fee
    v_base_price := v_order_total_dollars / 1.029;
    v_processing_fee := v_order_total_dollars - v_base_price;
    
    -- Use stored admin_fee if it exists, otherwise calculate from percentage
    IF v_order.stored_admin_fee_cents IS NOT NULL AND v_order.stored_admin_fee_cents > 0 THEN
      -- Use the admin fee that was stored at order time
      v_admin_fee_amount := v_order.stored_admin_fee_cents / 100.0;
      -- Calculate the percentage for display, but cap it at 100 to avoid overflow
      v_admin_fee_pct := LEAST((v_admin_fee_amount / NULLIF(v_base_price, 0)) * 100, 100);
    ELSE
      -- Calculate admin fee from talent's current percentage
      v_admin_fee_pct := COALESCE(v_order.talent_admin_fee_pct, 25);
      v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100);
    END IF;
    
    -- Safety check: if calculations seem wrong, use talent's percentage instead
    IF v_admin_fee_pct > 100 OR v_admin_fee_amount > v_base_price THEN
      v_admin_fee_pct := COALESCE(v_order.talent_admin_fee_pct, 25);
      v_admin_fee_amount := v_base_price * (v_admin_fee_pct / 100);
      RAISE NOTICE 'WARNING: Order % had invalid admin fee, using talent percentage instead', v_order.order_id;
    END IF;
    
    -- Talent gets: base price minus admin fee
    v_payout_amount := v_base_price - v_admin_fee_amount;
    
    -- Update the payout record
    UPDATE payouts
    SET 
      order_amount = v_base_price,
      admin_fee_percentage = v_admin_fee_pct,
      admin_fee_amount = v_admin_fee_amount,
      payout_amount = v_payout_amount,
      updated_at = NOW()
    WHERE id = v_order.payout_id;
    
    -- Adjust talent's total earnings
    UPDATE talent_profiles
    SET 
      total_earnings = GREATEST(
        COALESCE(total_earnings, 0) - v_old_payout_amount + v_payout_amount,
        0
      ),
      updated_at = NOW()
    WHERE id = v_order.talent_id;
    
    IF ABS(v_old_payout_amount - v_payout_amount) > 0.01 THEN
      RAISE NOTICE 'Order %: $% -> Base $% | Admin: $% (% pct) | Payout: $% -> $%',
        v_order.order_id, v_order_total_dollars, v_base_price, 
        v_admin_fee_amount, v_admin_fee_pct,
        v_old_payout_amount, v_payout_amount;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== Recalculating batch totals ===';
  
  -- Recalculate all batch totals from actual payouts
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
    net_payout_amount = (
      SELECT COALESCE(SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END), 0)
      FROM payouts p
      WHERE p.talent_id = pb.talent_id
      AND p.week_start_date = pb.week_start_date
    ),
    updated_at = NOW();
  
  RAISE NOTICE '=== Fix complete! ===';
END $$;

-- Verify the results
SELECT 
    'After Fix - Problem Orders' as check_type,
    tp.username as talent,
    u.full_name as name,
    o.amount / 100.0 as order_total,
    p.order_amount as base_price,
    p.admin_fee_amount as admin_fee,
    p.admin_fee_percentage as admin_fee_pct,
    p.payout_amount as talent_payout,
    pb.net_payout_amount as batch_net
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
JOIN payouts p ON p.order_id = o.id
LEFT JOIN payout_batches pb ON pb.talent_id = o.talent_id AND pb.week_start_date = p.week_start_date
WHERE o.status = 'completed'
AND tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine')
ORDER BY o.created_at DESC;

-- Show batch totals
SELECT 
    'Batch Totals After Fix' as check_type,
    tp.username as talent,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE tp.username IN ('hayleycaronia', 'shawnfarash', 'nickdipaolo', 'geraldmorgan', 'joshfirestine')
ORDER BY pb.week_start_date DESC, tp.username;

