-- COMPLETE PAYOUT FIX - Process pending payouts AND set up automation
-- This script does EVERYTHING needed to fix payouts

BEGIN;

-- ============================================================================
-- STEP 1: Enable the http extension (needed to call edge functions)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================================
-- STEP 2: Enable payouts in platform settings
-- ============================================================================
INSERT INTO platform_settings (setting_key, setting_value, updated_at)
VALUES ('payouts_enabled', 'true', NOW())
ON CONFLICT (setting_key) 
DO UPDATE SET setting_value = 'true', updated_at = NOW();

-- ============================================================================
-- STEP 3: Create/recreate invoke_process_payouts function with CORRECT key
-- ============================================================================
DROP FUNCTION IF EXISTS invoke_process_payouts();

CREATE OR REPLACE FUNCTION invoke_process_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg2ODMwMCwiZXhwIjoyMDc1NDQ0MzAwfQ.bmjLfmsX3_wYxjyHZzFoVhZ4XxJvqbH8DIfpHTXVrKQ';
  v_function_url TEXT := 'https://utafetamgwukkbrlezev.supabase.co/functions/v1/moov-process-pending-batches';
  v_response http_response;
  v_talent_id UUID;
  v_processed INT := 0;
  v_failed INT := 0;
BEGIN
  RAISE NOTICE '🚀 Starting payout processing...';
  RAISE NOTICE '';
  
  -- Process each distinct talent_id with pending batches
  FOR v_talent_id IN
    SELECT DISTINCT pb.talent_id
    FROM payout_batches pb
    JOIN talent_profiles tp ON tp.id = pb.talent_id
    WHERE pb.status = 'pending'
      AND pb.net_payout_amount > 0
      AND tp.moov_account_id IS NOT NULL
      AND tp.bank_account_linked = true
      AND tp.payout_onboarding_completed = true
      AND (pb.needs_review = false OR pb.needs_review IS NULL)
  LOOP
    -- Call the edge function for each talent
    BEGIN
      v_response := http((
        'POST',
        v_function_url,
        ARRAY[
          http_header('Authorization', 'Bearer ' || v_service_role_key),
          http_header('Content-Type', 'application/json')
        ],
        'application/json',
        json_build_object('talentId', v_talent_id)::text
      )::http_request);
      
      IF v_response.status = 200 THEN
        v_processed := v_processed + 1;
        RAISE NOTICE '✅ Processed talent: %', v_talent_id;
      ELSE
        v_failed := v_failed + 1;
        RAISE NOTICE '❌ Failed talent: % (Status: %, Response: %)', v_talent_id, v_response.status, v_response.content;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE NOTICE '❌ Error processing talent %: %', v_talent_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Processed: %', v_processed;
  RAISE NOTICE '❌ Failed: %', v_failed;
  RAISE NOTICE '';
END;
$$;

-- ============================================================================
-- STEP 4: Set up automatic cron job (runs every hour)
-- ============================================================================

-- First, remove any old payout cron jobs
DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN 
    SELECT jobid FROM cron.job WHERE jobname LIKE '%payout%'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
    RAISE NOTICE 'Removed old cron job: %', v_job.jobid;
  END LOOP;
END $$;

-- Create new cron job to run every hour
SELECT cron.schedule(
  'auto-process-payouts',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT invoke_process_payouts();$$
);

COMMIT;

-- ============================================================================
-- STEP 5: Process pending payouts NOW
-- ============================================================================

DO $$
DECLARE
  v_before_count INT;
  v_after_count INT;
  v_before_amount DECIMAL;
  v_after_amount DECIMAL;
BEGIN
  -- Count ready batches before
  SELECT 
    COUNT(*),
    COALESCE(SUM(pb.net_payout_amount), 0)
  INTO v_before_count, v_before_amount
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.status = 'pending'
    AND tp.moov_account_id IS NOT NULL
    AND tp.bank_account_linked = true
    AND tp.payout_onboarding_completed = true
    AND (pb.needs_review = false OR pb.needs_review IS NULL);
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '💰 PROCESSING PENDING PAYOUTS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready batches BEFORE: % ($%)', v_before_count, v_before_amount;
  RAISE NOTICE '';
  
  IF v_before_count = 0 THEN
    RAISE NOTICE '⚠️  No ready batches to process.';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE 'Calling invoke_process_payouts()...';
    RAISE NOTICE '';
    
    -- Call the function
    PERFORM invoke_process_payouts();
    
    -- Wait a moment for processing
    RAISE NOTICE '';
    RAISE NOTICE 'Waiting for edge function to complete...';
    PERFORM pg_sleep(3);
    
    -- Count ready batches after
    SELECT 
      COUNT(*),
      COALESCE(SUM(pb.net_payout_amount), 0)
    INTO v_after_count, v_after_amount
    FROM payout_batches pb
    JOIN talent_profiles tp ON tp.id = pb.talent_id
    WHERE pb.status = 'pending'
      AND tp.moov_account_id IS NOT NULL
      AND tp.bank_account_linked = true
      AND tp.payout_onboarding_completed = true
      AND (pb.needs_review = false OR pb.needs_review IS NULL);
    
    RAISE NOTICE '';
    RAISE NOTICE 'Ready batches AFTER: % ($%)', v_after_count, v_after_amount;
    RAISE NOTICE '';
    
    IF v_after_count < v_before_count THEN
      RAISE NOTICE '✅ SUCCESS! Processed % batch(es) totaling $%', 
        v_before_count - v_after_count, 
        v_before_amount - v_after_amount;
    ELSE
      RAISE NOTICE '❌ FAILED! Batches are still pending.';
      RAISE NOTICE '';
      RAISE NOTICE 'Possible reasons:';
      RAISE NOTICE '  1. Edge function moov-process-pending-batches has errors';
      RAISE NOTICE '  2. Moov API is down or returning errors';
      RAISE NOTICE '  3. Network connectivity issue';
      RAISE NOTICE '';
      RAISE NOTICE 'Check Railway logs for edge function errors.';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 6: Verify everything is set up correctly
-- ============================================================================

-- Show platform settings
SELECT 
  '⚙️ PLATFORM SETTINGS' as section,
  setting_key,
  setting_value,
  CASE 
    WHEN setting_value = 'true' THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as status
FROM platform_settings
WHERE setting_key = 'payouts_enabled';

-- Show cron job
SELECT 
  '⏰ CRON JOB' as section,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ ACTIVE - will run every hour'
    ELSE '❌ INACTIVE'
  END as status
FROM cron.job
WHERE jobname = 'auto-process-payouts';

-- Show remaining pending batches
SELECT 
  '📊 REMAINING PENDING BATCHES' as section,
  COUNT(*) as total_pending,
  COALESCE(SUM(net_payout_amount), 0) as total_amount,
  COUNT(*) FILTER (WHERE tp.moov_account_id IS NULL) as no_moov_account,
  COUNT(*) FILTER (
    WHERE tp.moov_account_id IS NOT NULL 
    AND tp.bank_account_linked = true 
    AND tp.payout_onboarding_completed = true
    AND (pb.needs_review = false OR pb.needs_review IS NULL)
  ) as still_ready
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending';

-- Final summary
DO $$
DECLARE
  v_payouts_enabled BOOLEAN;
  v_cron_active BOOLEAN;
  v_ready_pending INT;
  v_no_moov INT;
BEGIN
  SELECT setting_value::BOOLEAN INTO v_payouts_enabled
  FROM platform_settings
  WHERE setting_key = 'payouts_enabled';
  
  SELECT active INTO v_cron_active
  FROM cron.job
  WHERE jobname = 'auto-process-payouts';
  
  SELECT 
    COUNT(*) FILTER (
      WHERE tp.moov_account_id IS NOT NULL 
      AND tp.bank_account_linked = true 
      AND tp.payout_onboarding_completed = true
      AND (pb.needs_review = false OR pb.needs_review IS NULL)
    ),
    COUNT(*) FILTER (WHERE tp.moov_account_id IS NULL)
  INTO v_ready_pending, v_no_moov
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.status = 'pending';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🎯 FINAL STATUS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Payouts Enabled: %', CASE WHEN v_payouts_enabled THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '2. Cron Job Active: %', CASE WHEN v_cron_active THEN '✅ YES (runs hourly)' ELSE '❌ NO' END;
  RAISE NOTICE '3. Ready batches still pending: %', v_ready_pending;
  RAISE NOTICE '4. Talent without Moov: %', v_no_moov;
  RAISE NOTICE '';
  
  IF v_payouts_enabled AND v_cron_active THEN
    IF v_ready_pending = 0 THEN
      RAISE NOTICE '✅ SUCCESS! All ready payouts have been processed!';
      RAISE NOTICE '';
      IF v_no_moov > 0 THEN
        RAISE NOTICE '⚠️  Note: % talent still need to complete Moov setup', v_no_moov;
        RAISE NOTICE '   Run TALENT_NEED_PAYOUT_SETUP.sql to see who needs to be contacted.';
      END IF;
    ELSE
      RAISE NOTICE '⚠️  % ready batches are still pending', v_ready_pending;
      RAISE NOTICE '';
      RAISE NOTICE 'This means the edge function is failing.';
      RAISE NOTICE 'Next steps:';
      RAISE NOTICE '  1. Check Railway logs for moov-process-pending-batches errors';
      RAISE NOTICE '  2. Verify Moov API credentials are correct';
      RAISE NOTICE '  3. Try processing manually in admin panel';
    END IF;
  ELSE
    RAISE NOTICE '❌ Setup incomplete!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '💡 Automatic payouts will now run every hour at minute 0';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;
