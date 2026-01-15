-- Check if review columns exist and add them if needed
-- This enables the $1000 approval workflow

-- 1. Check current columns in payout_batches
SELECT 
  '📋 CURRENT PAYOUT_BATCHES COLUMNS' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'payout_batches'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Add review columns if they don't exist
DO $$ 
BEGIN
  -- Add needs_review column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_batches' 
    AND column_name = 'needs_review'
  ) THEN
    ALTER TABLE public.payout_batches 
    ADD COLUMN needs_review BOOLEAN DEFAULT FALSE;
    
    RAISE NOTICE '✅ Added needs_review column';
  ELSE
    RAISE NOTICE '✓ needs_review column already exists';
  END IF;
  
  -- Add review_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_batches' 
    AND column_name = 'review_reason'
  ) THEN
    ALTER TABLE public.payout_batches 
    ADD COLUMN review_reason TEXT;
    
    RAISE NOTICE '✅ Added review_reason column';
  ELSE
    RAISE NOTICE '✓ review_reason column already exists';
  END IF;
END $$;

-- 3. Update the payout trigger to include $1000 review logic
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
    
    -- SAFEGUARD: Check if payout exceeds $1000
    IF v_payout_amount > 1000.00 THEN
      v_needs_review := TRUE;
      v_review_reason := 'Payout amount exceeds $1000. ';
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
        ELSE payout_batches.status
      END,
      needs_review = payout_batches.needs_review OR v_needs_review,
      review_reason = CASE
        WHEN payout_batches.review_reason IS NULL THEN v_review_reason
        WHEN v_review_reason IS NULL THEN payout_batches.review_reason
        ELSE payout_batches.review_reason || v_review_reason
      END,
      updated_at = NOW();
      
    RAISE NOTICE 'Payout created: Talent price $%, Admin fee $% (25%%), Talent payout $%, Needs review: %', 
      v_talent_pricing, v_admin_fee_amount, v_payout_amount, v_needs_review;
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

-- 4. Verify everything is set up
SELECT 
  '✅ SETUP COMPLETE' as section,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_batches' AND column_name = 'needs_review')
    THEN '✅ needs_review column exists'
    ELSE '❌ needs_review column missing'
  END as review_column,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_batches' AND column_name = 'review_reason')
    THEN '✅ review_reason column exists'
    ELSE '❌ review_reason column missing'
  END as reason_column,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_payout_on_completion')
    THEN '✅ Payout trigger active'
    ELSE '❌ Payout trigger missing'
  END as trigger_status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'auto-process-payouts')
    THEN '✅ Cron job active'
    ELSE '❌ Cron job missing'
  END as cron_status;

-- 5. Show any batches that need admin approval
SELECT 
  '⚠️ BATCHES NEEDING APPROVAL' as section,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  pb.week_start_date,
  pb.net_payout_amount,
  pb.review_reason,
  pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.needs_review = true
  OR pb.status = 'pending_review'
ORDER BY pb.created_at DESC;

-- Summary
DO $$
DECLARE
  v_has_review_cols BOOLEAN;
  v_has_trigger BOOLEAN;
  v_has_cron BOOLEAN;
  v_pending_review_count INT;
BEGIN
  -- Check components
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_batches' 
    AND column_name = 'needs_review'
  ) INTO v_has_review_cols;
  
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_create_payout_on_completion'
  ) INTO v_has_trigger;
  
  SELECT EXISTS(
    SELECT 1 FROM cron.job 
    WHERE jobname = 'auto-process-payouts'
  ) INTO v_has_cron;
  
  SELECT COUNT(*) INTO v_pending_review_count
  FROM payout_batches
  WHERE status = 'pending_review' OR needs_review = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '💰 PAYOUT SYSTEM WITH $1000 APPROVAL - STATUS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Components:';
  RAISE NOTICE '  • Review Columns: %', CASE WHEN v_has_review_cols THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '  • Payout Trigger: %', CASE WHEN v_has_trigger THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '  • Cron Job: %', CASE WHEN v_has_cron THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Approval Queue:';
  RAISE NOTICE '  • Batches Needing Approval: %', v_pending_review_count;
  RAISE NOTICE '';
  
  IF v_has_review_cols AND v_has_trigger AND v_has_cron THEN
    RAISE NOTICE '✅ SUCCESS: Full payout system is operational!';
    RAISE NOTICE '';
    RAISE NOTICE 'How it works:';
    RAISE NOTICE '  1. Orders complete → Payouts created automatically';
    RAISE NOTICE '  2. Payouts under $1000 → Status: pending (auto-process)';
    RAISE NOTICE '  3. Payouts over $1000 → Status: pending_review (manual approval)';
    RAISE NOTICE '  4. Cron runs hourly → Processes pending batches';
    RAISE NOTICE '  5. Pending_review batches → Wait for admin approval';
  ELSE
    RAISE NOTICE '❌ ERROR: System not fully configured';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;
