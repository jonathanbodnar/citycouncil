-- Clear phone number 7604209593 from JP Sears (jpsears) talent account
-- JP is trying to register but getting "phone already in use" error
-- This will clear the phone so he can re-register or update it

-- Step 1: Find where this phone number exists
SELECT 
    'Phone found in USERS table' AS location,
    id,
    email,
    full_name,
    phone,
    user_type,
    created_at
FROM 
    users
WHERE 
    phone IN ('7604209593', '+17604209593', '17604209593')
    OR phone LIKE '%7604209593%';

-- Step 2: Check talent_profiles - specifically JP Sears (jpsears)
SELECT 
    'JP Sears Talent Profile' AS location,
    tp.id as talent_id,
    tp.full_name,
    tp.username,
    u.id as user_id,
    u.email,
    u.phone,
    tp.is_active
FROM 
    talent_profiles tp
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    tp.username = 'jpsears'
    OR u.phone IN ('7604209593', '+17604209593', '17604209593')
    OR u.phone LIKE '%7604209593%';

-- Step 3: Check beta_signups
SELECT 
    'Phone found in BETA_SIGNUPS table' AS location,
    id,
    phone_number,
    source,
    created_at
FROM 
    beta_signups
WHERE 
    phone_number IN ('7604209593', '+17604209593', '17604209593')
    OR phone_number LIKE '%7604209593%';

-- Step 4: Check auth.users metadata
SELECT 
    'Phone found in AUTH.USERS metadata' AS location,
    id,
    email,
    raw_user_meta_data->>'phone_number' as metadata_phone,
    created_at
FROM 
    auth.users
WHERE 
    raw_user_meta_data->>'phone_number' IN ('7604209593', '+17604209593', '17604209593')
    OR raw_user_meta_data->>'phone_number' LIKE '%7604209593%';

-- =====================================================================================================
-- CLEANUP: Remove this phone number from all tables
-- =====================================================================================================

-- Step 5: Remove from public.users
UPDATE users
SET 
    phone = NULL,
    sms_subscribed = false,
    updated_at = NOW()
WHERE 
    phone IN ('7604209593', '+17604209593', '17604209593')
    OR phone LIKE '%7604209593%';

-- Step 6: Remove from beta_signups
DELETE FROM beta_signups
WHERE 
    phone_number IN ('7604209593', '+17604209593', '17604209593')
    OR phone_number LIKE '%7604209593%';

-- Step 7: Update auth.users metadata (if phone is stored there)
UPDATE auth.users
SET 
    raw_user_meta_data = raw_user_meta_data - 'phone_number',
    updated_at = NOW()
WHERE 
    raw_user_meta_data->>'phone_number' IN ('7604209593', '+17604209593', '17604209593')
    OR raw_user_meta_data->>'phone_number' LIKE '%7604209593%';

-- =====================================================================================================
-- VERIFICATION
-- =====================================================================================================

-- Step 8: Verify phone is cleared from users
SELECT 
    'Remaining in USERS table' AS verification,
    COUNT(*) as count
FROM 
    users
WHERE 
    phone IN ('7604209593', '+17604209593', '17604209593')
    OR phone LIKE '%7604209593%';

-- Step 9: Verify phone is cleared from beta_signups
SELECT 
    'Remaining in BETA_SIGNUPS table' AS verification,
    COUNT(*) as count
FROM 
    beta_signups
WHERE 
    phone_number IN ('7604209593', '+17604209593', '17604209593')
    OR phone_number LIKE '%7604209593%';

-- Step 10: Verify phone is cleared from auth.users
SELECT 
    'Remaining in AUTH.USERS metadata' AS verification,
    COUNT(*) as count
FROM 
    auth.users
WHERE 
    raw_user_meta_data->>'phone_number' IN ('7604209593', '+17604209593', '17604209593')
    OR raw_user_meta_data->>'phone_number' LIKE '%7604209593%';

SELECT '✅ Phone number 7604209593 cleared from all tables. JP can now register!' AS result;

