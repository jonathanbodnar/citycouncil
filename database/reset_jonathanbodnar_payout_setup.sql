-- Reset jonathanbodnar payout setup for live Moov testing
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
  
  -- 3. Delete Moov accounts record
  DELETE FROM moov_accounts WHERE talent_id = v_talent_id;
  DELETE FROM moov_accounts WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted Moov accounts';
  
  -- 4. Reset talent_profiles payout fields
  UPDATE talent_profiles
  SET 
    moov_account_id = NULL,
    bank_account_linked = FALSE,
    payout_onboarding_step = 1,
    payout_onboarding_completed = FALSE,
    veriff_verified = FALSE,
    veriff_verified_at = NULL
  WHERE id = v_talent_id;
  RAISE NOTICE 'Reset talent_profiles payout fields';
  
  -- 5. Reset payout batches to pending (so they can be processed after setup)
  UPDATE payout_batches
  SET 
    status = 'pending',
    moov_transfer_id = NULL,
    moov_transfer_status = NULL,
    processed_at = NULL,
    updated_at = NOW()
  WHERE talent_id = v_talent_id;
  RAISE NOTICE 'Reset payout batches to pending';
  
  -- 6. Reset individual payouts to pending
  UPDATE payouts
  SET 
    status = 'pending',
    processed_at = NULL,
    updated_at = NOW()
  WHERE talent_id = v_talent_id
    AND status != 'paid';
  RAISE NOTICE 'Reset individual payouts to pending';
  
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

-- Check pending batches
SELECT 
  'payout_batches' as info,
  COUNT(*) as pending_count,
  SUM(net_payout_amount) as total_pending_amount
FROM payout_batches
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar')
  AND status = 'pending';

