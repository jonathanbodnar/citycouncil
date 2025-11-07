-- Sync Shawn's Phone Number to Users Table for Comms Center

-- =============================================================================
-- STEP 1: Find Shawn's profile and check phone numbers
-- =============================================================================

SELECT 
  '1. FIND SHAWN' as step,
  tp.id as talent_id,
  tp.temp_full_name,
  tp.username,
  tp.user_id,
  u.phone as phone_in_users_table,
  u.email
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE tp.temp_full_name ILIKE '%shawn%'
   OR tp.username ILIKE '%shawn%'
   OR tp.full_name ILIKE '%shawn%'
ORDER BY tp.created_at DESC;

-- =============================================================================
-- STEP 2: Check if Shawn has a phone in talent_profiles (if column exists)
-- =============================================================================

-- Note: talent_profiles typically doesn't have a phone column
-- But let's check what columns it has
SELECT 
  '2. TALENT_PROFILES COLUMNS' as step,
  column_name
FROM information_schema.columns
WHERE table_name = 'talent_profiles'
  AND table_schema = 'public'
  AND column_name LIKE '%phone%'
ORDER BY column_name;

-- =============================================================================
-- STEP 3: Update Shawn's phone in users table manually
-- =============================================================================

-- Replace 'PHONE_NUMBER_HERE' with Shawn's actual phone (numbers only, no formatting)
-- Example: If phone is +1 (555) 123-4567, enter: 15551234567

-- First, let's see what we're about to update
SELECT 
  '3. SHAWN BEFORE UPDATE' as step,
  u.id as user_id,
  u.email,
  u.phone as current_phone,
  tp.temp_full_name as talent_name
FROM users u
INNER JOIN talent_profiles tp ON tp.user_id = u.id
WHERE tp.temp_full_name ILIKE '%shawn%'
   OR tp.username ILIKE '%shawn%'
   OR tp.full_name ILIKE '%shawn%';

-- Uncomment and run this UPDATE after confirming Shawn's user_id above
/*
UPDATE users 
SET phone = 'PHONE_NUMBER_HERE'  -- Replace with actual phone (numbers only: 15551234567)
WHERE id = (
  SELECT user_id 
  FROM talent_profiles 
  WHERE temp_full_name ILIKE '%shawn%'
     OR username ILIKE '%shawn%'
     OR full_name ILIKE '%shawn%'
  LIMIT 1
);
*/

-- =============================================================================
-- STEP 4: Verify Shawn now appears in Comms Center
-- =============================================================================

SELECT 
  '4. VERIFY COMMS CENTER' as step,
  tp.temp_full_name as talent_name,
  tp.username,
  u.phone,
  CASE 
    WHEN u.phone IS NOT NULL THEN '✅ Will appear in Comms Center'
    ELSE '❌ Still missing phone'
  END as comms_status
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE tp.temp_full_name ILIKE '%shawn%'
   OR tp.username ILIKE '%shawn%'
   OR tp.full_name ILIKE '%shawn%';

-- =============================================================================
-- STEP 5: Show all talent in Comms Center (for reference)
-- =============================================================================

SELECT 
  '5. ALL COMMS CENTER TALENT' as step,
  tp.temp_full_name as talent_name,
  tp.username,
  u.phone
FROM talent_profiles tp
INNER JOIN users u ON tp.user_id = u.id
WHERE u.phone IS NOT NULL
ORDER BY tp.temp_full_name;

-- =============================================================================
-- INSTRUCTIONS
-- =============================================================================

SELECT '
📱 HOW TO ADD SHAWN TO COMMS CENTER

STEP 1: Run this script (STEP 1-2) to find Shawn
STEP 2: Note Shawns user_id and current phone status
STEP 3: Get Shawns phone number (numbers only, no spaces/dashes)
        Example: If phone is +1 (614) 555-1234
        Enter as: 16145551234
STEP 4: Uncomment the UPDATE query in STEP 3
STEP 5: Replace PHONE_NUMBER_HERE with actual number
STEP 6: Run the UPDATE
STEP 7: Run STEP 4 to verify
STEP 8: Refresh Comms Center page

Alternative: Use the populate_comms_center_phones.sql script
to automatically sync ALL talent phone numbers from MFA/auth.

' as instructions;

