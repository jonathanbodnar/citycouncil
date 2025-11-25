-- EMERGENCY: Restore admin@shoutout.us as admin user

-- Step 1: Check current status
SELECT 
    '1. CURRENT STATUS' AS step,
    id,
    email,
    user_type,
    created_at
FROM 
    users
WHERE 
    email = 'admin@shoutout.us';

-- Step 2: Update to admin if exists
UPDATE users
SET 
    user_type = 'admin',
    updated_at = NOW()
WHERE 
    email = 'admin@shoutout.us';

-- Step 3: Verify the update
SELECT 
    '2. UPDATED STATUS' AS step,
    id,
    email,
    user_type,
    updated_at
FROM 
    users
WHERE 
    email = 'admin@shoutout.us';

-- Step 4: Show all admin users for verification
SELECT 
    '3. ALL ADMIN USERS' AS step,
    id,
    email,
    full_name,
    user_type,
    created_at
FROM 
    users
WHERE 
    user_type = 'admin'
ORDER BY 
    created_at;

SELECT '✅ admin@shoutout.us has been restored as admin!' AS result;

