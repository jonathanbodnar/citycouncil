-- Fix batch totals by recalculating them from actual payouts
-- The issue: batch totals are still high even though individual payouts are fixed

-- First, let's see what's in these problem batches
SELECT 
    'Problem Batches - Individual Payouts' as check_type,
    pb.id as batch_id,
    pb.talent_id,
    pb.week_start_date,
    pb.total_orders as batch_total_orders,
    pb.total_payout_amount as batch_total,
    pb.net_payout_amount as batch_net,
    (
        SELECT COUNT(*) 
        FROM payouts p 
        WHERE p.talent_id = pb.talent_id 
        AND p.week_start_date = pb.week_start_date
    ) as actual_order_count,
    (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p 
        WHERE p.talent_id = pb.talent_id 
        AND p.week_start_date = pb.week_start_date
        AND NOT p.is_refunded
    ) as actual_payout_total,
    (
        SELECT COALESCE(SUM(p.payout_amount), 0)
        FROM payouts p 
        WHERE p.talent_id = pb.talent_id 
        AND p.week_start_date = pb.week_start_date
        AND p.is_refunded
    ) as actual_refunded_total
FROM payout_batches pb
WHERE pb.total_payout_amount > 10000
ORDER BY pb.total_payout_amount DESC;

-- Now recalculate ALL batch totals from scratch
DO $$
DECLARE
  v_batch RECORD;
  v_actual_orders INTEGER;
  v_actual_total DECIMAL(10,2);
  v_actual_refunded DECIMAL(10,2);
  v_actual_net DECIMAL(10,2);
BEGIN
  RAISE NOTICE '=== Recalculating All Batch Totals ===';
  
  -- For each batch, recalculate from actual payouts
  FOR v_batch IN 
    SELECT 
        id,
        talent_id,
        week_start_date,
        total_payout_amount as old_total,
        net_payout_amount as old_net
    FROM payout_batches
  LOOP
    -- Count actual orders
    SELECT COUNT(*)
    INTO v_actual_orders
    FROM payouts
    WHERE talent_id = v_batch.talent_id
    AND week_start_date = v_batch.week_start_date;
    
    -- Sum actual payout amounts
    SELECT COALESCE(SUM(payout_amount), 0)
    INTO v_actual_total
    FROM payouts
    WHERE talent_id = v_batch.talent_id
    AND week_start_date = v_batch.week_start_date;
    
    -- Sum refunded amounts
    SELECT COALESCE(SUM(payout_amount), 0)
    INTO v_actual_refunded
    FROM payouts
    WHERE talent_id = v_batch.talent_id
    AND week_start_date = v_batch.week_start_date
    AND is_refunded = true;
    
    -- Calculate net
    v_actual_net := v_actual_total - v_actual_refunded;
    
    -- Update the batch
    UPDATE payout_batches
    SET 
        total_orders = v_actual_orders,
        total_payout_amount = v_actual_total,
        total_refunded_amount = v_actual_refunded,
        net_payout_amount = v_actual_net,
        updated_at = NOW()
    WHERE id = v_batch.id;
    
    IF v_batch.old_total != v_actual_total THEN
        RAISE NOTICE 'Fixed batch % for week %: $% -> $% (net: $% -> $%)',
            v_batch.id, v_batch.week_start_date, 
            v_batch.old_total, v_actual_total,
            v_batch.old_net, v_actual_net;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== Batch recalculation complete! ===';
END $$;

-- Verify the fix
SELECT 
    'After Batch Recalculation' as check_type,
    pb.talent_id,
    pb.week_start_date,
    pb.total_orders,
    pb.total_payout_amount,
    pb.total_refunded_amount,
    pb.net_payout_amount,
    CASE 
        WHEN pb.total_payout_amount > 10000 THEN '⚠️ Still high!'
        WHEN pb.total_payout_amount > 1000 THEN '⚠️ High but might be legitimate'
        ELSE '✅ Reasonable'
    END as status
FROM payout_batches pb
ORDER BY pb.total_payout_amount DESC
LIMIT 15;

-- Also check individual payouts in those batches
SELECT 
    'Individual Payouts in High Batches' as check_type,
    p.order_id,
    p.talent_id,
    p.week_start_date,
    p.order_amount,
    p.admin_fee_amount,
    p.payout_amount,
    p.is_refunded,
    o.amount as order_cents,
    CASE 
        WHEN p.order_amount = o.amount / 100.0 THEN '✅ Correct'
        WHEN p.order_amount = o.amount THEN '❌ Using cents as dollars'
        ELSE '❓ Unknown'
    END as payout_status
FROM payouts p
JOIN orders o ON o.id = p.order_id
WHERE p.talent_id IN (
    SELECT talent_id 
    FROM payout_batches 
    WHERE total_payout_amount > 10000
)
AND p.week_start_date IN (
    SELECT week_start_date 
    FROM payout_batches 
    WHERE total_payout_amount > 10000
)
ORDER BY p.week_start_date DESC, p.payout_amount DESC;

