-- Reset Melonie Mac's Payout Onboarding
-- Run this in Supabase SQL editor

-- Find Melonie Mac's talent profile
SELECT 
  id,
  username,
  temp_full_name,
  moov_account_id,
  bank_account_linked,
  payout_onboarding_completed,
  payout_onboarding_step
FROM talent_profiles
WHERE username ILIKE '%melonie%' OR temp_full_name ILIKE '%melonie%';

-- Reset her payout onboarding completely
UPDATE talent_profiles
SET 
  moov_account_id = NULL,
  bank_account_linked = false,
  payout_onboarding_completed = false,
  payout_onboarding_step = 1,
  updated_at = NOW()
WHERE username ILIKE '%melonie%' OR temp_full_name ILIKE '%melonie%';

-- Verify the reset
SELECT 
  id,
  username,
  temp_full_name,
  moov_account_id,
  bank_account_linked,
  payout_onboarding_completed,
  payout_onboarding_step
FROM talent_profiles
WHERE username ILIKE '%melonie%' OR temp_full_name ILIKE '%melonie%';

-- Output confirmation
SELECT 'Melonie Mac payout onboarding has been reset. She can now start fresh at /dashboard/payouts' as message;
