-- Backfill existing completed orders into the new payout system
-- Creates payout records for all orders that have been delivered

DO $$
DECLARE
  v_order RECORD;
  v_week_start DATE;
  v_week_end DATE;
  v_admin_fee_amount DECIMAL(10,2);
  v_payout_amount DECIMAL(10,2);
  v_admin_fee_pct DECIMAL(5,2);
  v_total_processed INTEGER := 0;
  v_total_refunded INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of existing orders...';
  
  -- Process all completed orders that have a video URL (delivered)
  FOR v_order IN 
    SELECT 
      o.id,
      o.talent_id,
      o.amount,
      o.status,
      o.video_url,
      o.updated_at,
      o.created_at,
      tp.admin_fee_percentage
    FROM orders o
    JOIN talent_profiles tp ON tp.id = o.talent_id
    WHERE o.status IN ('completed', 'refunded')
      AND o.video_url IS NOT NULL -- Only orders with delivered videos
      AND NOT EXISTS (
        SELECT 1 FROM payouts WHERE order_id = o.id
      )
    ORDER BY o.updated_at ASC
  LOOP
    -- Get admin fee percentage
    v_admin_fee_pct := COALESCE(v_order.admin_fee_percentage, 25);
    
    -- Calculate amounts
    v_admin_fee_amount := v_order.amount * (v_admin_fee_pct / 100);
    v_payout_amount := v_order.amount - v_admin_fee_amount;
    
    -- Calculate week dates based on when order was completed/updated
    v_week_start := (v_order.updated_at::DATE - EXTRACT(DOW FROM v_order.updated_at)::INTEGER + 1)::DATE;
    v_week_end := (v_order.updated_at::DATE - EXTRACT(DOW FROM v_order.updated_at)::INTEGER + 7)::DATE;
    
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
      is_refunded,
      refunded_at,
      refund_reason,
      created_at,
      updated_at
    ) VALUES (
      v_order.talent_id,
      v_order.id,
      v_order.amount,
      v_admin_fee_pct,
      v_admin_fee_amount,
      v_payout_amount,
      CASE WHEN v_order.status = 'refunded' THEN 'pending' ELSE 'pending' END,
      v_week_start,
      v_week_end,
      v_order.status = 'refunded',
      CASE WHEN v_order.status = 'refunded' THEN v_order.updated_at ELSE NULL END,
      CASE WHEN v_order.status = 'refunded' THEN 'Order refunded (backfilled)' ELSE NULL END,
      v_order.created_at,
      v_order.updated_at
    );
    
    -- Update talent's total earnings (only if not refunded)
    IF v_order.status != 'refunded' THEN
      UPDATE talent_profiles
      SET 
        total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
        updated_at = NOW()
      WHERE id = v_order.talent_id;
      
      v_total_processed := v_total_processed + 1;
    ELSE
      v_total_refunded := v_total_refunded + 1;
    END IF;
    
    -- Create or update weekly batch
    INSERT INTO payout_batches (
      talent_id,
      week_start_date,
      week_end_date,
      total_orders,
      total_payout_amount,
      total_refunded_amount,
      net_payout_amount,
      created_at,
      updated_at
    ) VALUES (
      v_order.talent_id,
      v_week_start,
      v_week_end,
      1,
      v_payout_amount,
      CASE WHEN v_order.status = 'refunded' THEN v_payout_amount ELSE 0 END,
      CASE WHEN v_order.status = 'refunded' THEN 0 ELSE v_payout_amount END,
      v_order.created_at,
      v_order.updated_at
    )
    ON CONFLICT (talent_id, week_start_date) DO UPDATE SET
      total_orders = payout_batches.total_orders + 1,
      total_payout_amount = payout_batches.total_payout_amount + v_payout_amount,
      total_refunded_amount = payout_batches.total_refunded_amount + 
        CASE WHEN v_order.status = 'refunded' THEN v_payout_amount ELSE 0 END,
      net_payout_amount = payout_batches.total_payout_amount + v_payout_amount - 
        (payout_batches.total_refunded_amount + CASE WHEN v_order.status = 'refunded' THEN v_payout_amount ELSE 0 END),
      updated_at = NOW();
    
  END LOOP;
  
  RAISE NOTICE '✅ Backfill complete!';
  RAISE NOTICE 'Processed orders: %', v_total_processed;
  RAISE NOTICE 'Refunded orders: %', v_total_refunded;
  RAISE NOTICE 'Total: %', v_total_processed + v_total_refunded;
END $$;

-- Show summary
SELECT 
  '📊 Backfill Summary' AS info,
  COUNT(*) as total_payouts,
  COUNT(CASE WHEN is_refunded THEN 1 END) as refunded_payouts,
  COUNT(CASE WHEN NOT is_refunded THEN 1 END) as active_payouts,
  SUM(payout_amount) as total_payout_amount,
  SUM(CASE WHEN is_refunded THEN payout_amount ELSE 0 END) as refunded_amount,
  SUM(CASE WHEN NOT is_refunded THEN payout_amount ELSE 0 END) as net_amount
FROM payouts;

SELECT 
  '📅 Weekly Batches Created' AS info,
  COUNT(*) as total_batches,
  SUM(total_orders) as total_orders,
  SUM(net_payout_amount) as total_net_amount
FROM payout_batches;

