-- Debug: Let's check step by step what's happening

-- Step 1: How many talent have NO Moov account at all?
SELECT 
  'Step 1: Talent without Moov accounts' as check_name,
  COUNT(*) as count
FROM talent_profiles
WHERE moov_account_id IS NULL;

-- Step 2: How many pending batches exist?
SELECT 
  'Step 2: Pending batches' as check_name,
  COUNT(*) as count,
  SUM(net_payout_amount) as total_amount
FROM payout_batches
WHERE status = 'pending';

-- Step 3: List ALL talent without Moov (no join yet)
SELECT 
  'Step 3: All talent without Moov' as section,
  username,
  COALESCE(temp_full_name, username) as name,
  user_id,
  payout_onboarding_step
FROM talent_profiles
WHERE moov_account_id IS NULL
ORDER BY username;

-- Step 4: Which talent have BOTH pending batches AND no Moov?
SELECT 
  'Step 4: Talent with pending $ but no Moov' as section,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as name,
  COUNT(pb.id) as pending_batches,
  SUM(pb.net_payout_amount) as amount_owed
FROM talent_profiles tp
INNER JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE tp.moov_account_id IS NULL
  AND pb.status = 'pending'
GROUP BY tp.id, tp.username, tp.temp_full_name
ORDER BY amount_owed DESC;

-- Step 5: Try to get user info for those talent
SELECT 
  'Step 5: With user emails' as section,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as name,
  u.email,
  u.phone,
  (SELECT COUNT(*) FROM payout_batches WHERE talent_id = tp.id AND status = 'pending') as pending_batches
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
WHERE tp.moov_account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM payout_batches pb 
    WHERE pb.talent_id = tp.id 
    AND pb.status = 'pending'
  )
ORDER BY tp.username;
