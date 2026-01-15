-- Comprehensive check of payout system status

-- 1. Check if there are any pending batches
SELECT 
  '🔴 PENDING PAYOUT BATCHES' as section,
  pb.id,
  tp.username as talent,
  tp.display_name,
  pb.week_start_date,
  pb.week_end_date,
  pb.total_orders,
  pb.total_payout_amount,
  pb.net_payout_amount,
  pb.status,
  pb.created_at,
  tp.moov_account_id,
  tp.bank_account_linked,
  tp.payout_onboarding_completed
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending'
ORDER BY pb.created_at DESC;

-- 2. Check platform settings for payouts
SELECT 
  '⚙️ PLATFORM SETTINGS' as section,
  setting_key,
  setting_value,
  CASE 
    WHEN setting_key = 'payouts_enabled' AND setting_value = 'true' THEN '✅ ENABLED'
    WHEN setting_key = 'payouts_enabled' AND setting_value = 'false' THEN '❌ DISABLED'
    ELSE setting_value
  END as status
FROM platform_settings
WHERE setting_key LIKE '%payout%';

-- 3. Check if there's a cron job for payouts
SELECT 
  '⏰ CRON JOBS' as section,
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname LIKE '%payout%';

-- 4. Check recent payout batch processing attempts (if any)
SELECT 
  '📊 RECENT BATCH ACTIVITY' as section,
  pb.id,
  tp.username,
  pb.status,
  pb.moov_transfer_status,
  pb.processed_at,
  pb.updated_at
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
ORDER BY pb.updated_at DESC
LIMIT 10;

-- 5. Check talent readiness for payouts
SELECT 
  '👤 TALENT PAYOUT READINESS' as section,
  tp.username,
  tp.display_name,
  CASE 
    WHEN tp.moov_account_id IS NOT NULL THEN '✅ Has Moov Account'
    ELSE '❌ No Moov Account'
  END as moov_status,
  CASE 
    WHEN tp.bank_account_linked THEN '✅ Bank Linked'
    ELSE '❌ Bank Not Linked'
  END as bank_status,
  CASE 
    WHEN tp.payout_onboarding_completed THEN '✅ Onboarding Complete'
    ELSE '❌ Onboarding Incomplete'
  END as onboarding_status,
  COUNT(pb.id) as pending_batches,
  COALESCE(SUM(pb.net_payout_amount), 0) as total_pending_amount
FROM talent_profiles tp
LEFT JOIN payout_batches pb ON pb.talent_id = tp.id AND pb.status = 'pending'
WHERE tp.moov_account_id IS NOT NULL
GROUP BY tp.id, tp.username, tp.display_name, tp.moov_account_id, tp.bank_account_linked, tp.payout_onboarding_completed
ORDER BY pending_batches DESC;

-- 6. Summary with action items
DO $$
DECLARE
  v_pending_batches INT;
  v_total_pending_amount DECIMAL;
  v_payouts_enabled BOOLEAN;
  v_cron_exists BOOLEAN;
  v_ready_talent INT;
BEGIN
  -- Count pending batches
  SELECT COUNT(*), COALESCE(SUM(net_payout_amount), 0)
  INTO v_pending_batches, v_total_pending_amount
  FROM payout_batches
  WHERE status = 'pending';
  
  -- Check if payouts are enabled
  SELECT setting_value::BOOLEAN INTO v_payouts_enabled
  FROM platform_settings
  WHERE setting_key = 'payouts_enabled';
  
  -- Check if cron exists
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname LIKE '%payout%'
  ) INTO v_cron_exists;
  
  -- Count talent ready for payouts
  SELECT COUNT(*) INTO v_ready_talent
  FROM talent_profiles
  WHERE moov_account_id IS NOT NULL
    AND bank_account_linked = true
    AND payout_onboarding_completed = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '💰 PAYOUT SYSTEM STATUS SUMMARY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Pending Batches: %', v_pending_batches;
  RAISE NOTICE 'Total Pending Amount: $%', v_total_pending_amount;
  RAISE NOTICE 'Payouts Enabled: %', CASE WHEN v_payouts_enabled THEN 'YES ✅' ELSE 'NO ❌' END;
  RAISE NOTICE 'Automatic Cron Job: %', CASE WHEN v_cron_exists THEN 'YES ✅' ELSE 'NO ❌' END;
  RAISE NOTICE 'Talent Ready for Payouts: %', v_ready_talent;
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔧 ACTION ITEMS:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  
  IF NOT v_payouts_enabled THEN
    RAISE NOTICE '❌ CRITICAL: Payouts are DISABLED in platform settings!';
    RAISE NOTICE '   Solution: Enable payouts in admin panel or run:';
    RAISE NOTICE '   UPDATE platform_settings SET setting_value = ''true'' WHERE setting_key = ''payouts_enabled'';';
    RAISE NOTICE '';
  END IF;
  
  IF NOT v_cron_exists THEN
    RAISE NOTICE '❌ CRITICAL: No automatic payout processing cron job exists!';
    RAISE NOTICE '   Solution: Run database/SETUP_PAYOUT_CRON.sql to create automatic processing';
    RAISE NOTICE '';
  END IF;
  
  IF v_pending_batches > 0 THEN
    RAISE NOTICE '⚠️  WARNING: % pending batch(es) totaling $% waiting to be processed', v_pending_batches, v_total_pending_amount;
    RAISE NOTICE '   Solution: Process them manually via admin panel or wait for cron job';
    RAISE NOTICE '';
  END IF;
  
  IF v_payouts_enabled AND v_cron_exists AND v_pending_batches = 0 THEN
    RAISE NOTICE '✅ Everything looks good! No pending batches to process.';
  END IF;
  
  RAISE NOTICE '';
END $$;
