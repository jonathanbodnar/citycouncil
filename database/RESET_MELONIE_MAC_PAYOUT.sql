-- Reset Melonie Mac's payout setup to step one
-- This will clear all payout onboarding progress and allow her to start fresh

DO $$
DECLARE
  v_talent_id UUID;
  v_user_id UUID;
BEGIN
  -- Get Melonie Mac's talent profile and user ID
  SELECT tp.id, tp.user_id INTO v_talent_id, v_user_id
  FROM talent_profiles tp
  WHERE tp.username = 'meloniemac';
  
  IF v_talent_id IS NULL THEN
    RAISE EXCEPTION 'Melonie Mac talent profile not found';
  END IF;
  
  RAISE NOTICE 'Found Melonie Mac: talent_id=%, user_id=%', v_talent_id, v_user_id;
  
  -- 1. Delete W-9 forms (if any)
  DELETE FROM w9_forms WHERE talent_id = v_talent_id;
  RAISE NOTICE 'Deleted W-9 forms';
  
  -- 2. Delete Moov accounts record (if table exists and has records)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moov_accounts') THEN
    DELETE FROM moov_accounts WHERE talent_id = v_talent_id;
    DELETE FROM moov_accounts WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted Moov accounts';
  ELSE
    RAISE NOTICE 'moov_accounts table does not exist - skipping';
  END IF;
  
  -- 3. Reset all payout onboarding fields in talent_profiles
  UPDATE talent_profiles
  SET 
    moov_account_id = NULL,
    bank_account_linked = FALSE,
    payout_onboarding_step = 0,
    payout_onboarding_completed = FALSE,
    updated_at = NOW()
  WHERE id = v_talent_id;
  
  RAISE NOTICE 'Reset payout onboarding fields';
  
  -- 4. Show current status
  RAISE NOTICE '✅ Melonie Mac payout setup has been reset to step one!';
  
END $$;

-- Show updated status
SELECT 
  'talent_profiles' as table_name,
  tp.username,
  tp.moov_account_id,
  tp.bank_account_linked,
  tp.payout_onboarding_step,
  tp.payout_onboarding_completed
FROM talent_profiles tp
WHERE tp.username = 'meloniemac';

-- Check if W-9 exists (should be 0)
SELECT 
  'w9_forms' as table_name,
  COUNT(*) as count
FROM w9_forms wf
JOIN talent_profiles tp ON wf.talent_id = tp.id
WHERE tp.username = 'meloniemac';

-- Check if Moov account exists (should be 0, if table exists)
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moov_accounts') THEN
    -- Table exists, count records
    SELECT COUNT(*) INTO v_count
    FROM moov_accounts ma
    JOIN talent_profiles tp ON ma.talent_id = tp.id
    WHERE tp.username = 'meloniemac';
    
    RAISE NOTICE 'moov_accounts table: % records found for Melonie Mac', v_count;
  ELSE
    RAISE NOTICE 'moov_accounts table does not exist - skipping check';
  END IF;
END $$;

SELECT '✅ Melonie Mac payout setup reset complete!' as result;
SELECT 'She can now start the payout onboarding process from step one.' as next_steps;
