-- Remove ALL admin users except the authorized ones

-- Step 1: Show who will be affected
SELECT 
    'USERS WHO WILL LOSE ADMIN' AS action,
    id,
    email,
    full_name,
    user_type
FROM 
    users
WHERE 
    user_type = 'admin'
    AND email NOT IN (
        'admin@shoutout.us',
        'jb@apollo.inc'
    );

-- Step 2: Remove admin from unauthorized users
UPDATE users
SET 
    user_type = 'user',
    updated_at = NOW()
WHERE 
    user_type = 'admin'
    AND email NOT IN (
        'admin@shoutout.us',
        'jb@apollo.inc'
    );

-- Step 3: Ensure admin@shoutout.us IS admin
UPDATE users
SET 
    user_type = 'admin',
    updated_at = NOW()
WHERE 
    email = 'admin@shoutout.us';

-- Step 4: Show final admin list
SELECT 
    '✅ FINAL ADMIN LIST' AS status,
    id,
    email,
    user_type,
    updated_at
FROM 
    users
WHERE 
    user_type = 'admin'
ORDER BY 
    email;

