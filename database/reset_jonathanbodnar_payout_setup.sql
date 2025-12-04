-- Reset jonathanbodnar payout SETUP for live Moov testing
-- This ONLY clears onboarding data (W-9, Veriff, Moov connection)
-- It does NOT touch payout batches or payout amounts
-- Run this in Supabase SQL Editor

BEGIN;

-- First, get the talent_id and user_id for reference
DO $$
DECLARE
  v_talent_id UUID;
  v_user_id UUID;
BEGIN
  SELECT tp.id, tp.user_id INTO v_talent_id, v_user_id
  FROM talent_profiles tp
  WHERE tp.username = 'jonathanbodnar';
  
  RAISE NOTICE 'Talent ID: %', v_talent_id;
  RAISE NOTICE 'User ID: %', v_user_id;
  
  -- 1. Delete W-9 envelopes (SignNow records)
  DELETE FROM w9_envelopes WHERE talent_id = v_talent_id;
  RAISE NOTICE 'Deleted W-9 envelopes';
  
  -- 2. Delete Veriff sessions
  DELETE FROM veriff_sessions WHERE talent_id = v_talent_id;
  RAISE NOTICE 'Deleted Veriff sessions';
  
  -- 3. Delete Moov accounts record (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moov_accounts') THEN
    DELETE FROM moov_accounts WHERE talent_id = v_talent_id;
    DELETE FROM moov_accounts WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted Moov accounts';
  ELSE
    RAISE NOTICE 'moov_accounts table does not exist - skipping';
  END IF;
  
  -- 4. Reset talent_profiles payout SETUP fields only
  -- Step 0 = intro page, so they see the overview first
  UPDATE talent_profiles
  SET 
    moov_account_id = NULL,
    bank_account_linked = FALSE,
    payout_onboarding_step = 0,
    payout_onboarding_completed = FALSE,
    veriff_verified = FALSE,
    veriff_verified_at = NULL
  WHERE id = v_talent_id;
  RAISE NOTICE 'Reset talent_profiles payout setup fields';
  
  -- NOTE: We intentionally do NOT touch payout_batches or payouts
  -- Those represent real earnings and should remain intact
  
END $$;

COMMIT;

-- Verify the reset
SELECT 
  'talent_profiles' as table_name,
  tp.username,
  tp.moov_account_id,
  tp.bank_account_linked,
  tp.payout_onboarding_step,
  tp.payout_onboarding_completed,
  tp.veriff_verified
FROM talent_profiles tp
WHERE tp.username = 'jonathanbodnar';

-- Show payout batches (unchanged - just for reference)
SELECT 
  'payout_batches (unchanged)' as info,
  status,
  COUNT(*) as count,
  SUM(net_payout_amount) as total_amount
FROM payout_batches
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')
GROUP BY status;

