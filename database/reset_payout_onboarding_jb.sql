-- Reset payout onboarding for jb@apollo.inc to test full flow
-- This will allow you to go through all 4 steps again

-- Delete W-9 envelope records
DELETE FROM w9_envelopes 
WHERE talent_id IN (
  SELECT tp.id 
  FROM talent_profiles tp
  JOIN users u ON tp.user_id = u.id
  WHERE u.email = 'jb@apollo.inc'
);

-- Delete W-9 form records
DELETE FROM w9_forms 
WHERE talent_id IN (
  SELECT tp.id 
  FROM talent_profiles tp
  JOIN users u ON tp.user_id = u.id
  WHERE u.email = 'jb@apollo.inc'
);

-- Delete Veriff session records
DELETE FROM veriff_sessions 
WHERE talent_id IN (
  SELECT tp.id 
  FROM talent_profiles tp
  JOIN users u ON tp.user_id = u.id
  WHERE u.email = 'jb@apollo.inc'
);

-- Reset talent profile onboarding status
UPDATE talent_profiles
SET 
  payout_onboarding_step = 1,
  payout_onboarding_completed = FALSE,
  bank_account_linked = FALSE,
  veriff_verified = FALSE,
  veriff_verified_at = NULL,
  moov_account_id = NULL
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'jb@apollo.inc'
);

-- Show the reset talent profile
SELECT 
  tp.id as talent_id,
  u.email,
  u.full_name,
  tp.payout_onboarding_step,
  tp.payout_onboarding_completed,
  tp.bank_account_linked,
  tp.veriff_verified,
  tp.moov_account_id
FROM talent_profiles tp
JOIN users u ON tp.user_id = u.id
WHERE u.email = 'jb@apollo.inc';

