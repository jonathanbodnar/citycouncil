-- SECURITY AUDIT: Check for unauthorized admins and suspicious activity

-- 1. Show ALL admin users
SELECT 
    '1. ALL ADMIN USERS' AS section,
    id,
    email,
    full_name,
    user_type,
    created_at,
    last_login,
    updated_at
FROM 
    users
WHERE 
    user_type = 'admin'
ORDER BY 
    created_at;

-- 2. Show users who were RECENTLY changed to admin (last 7 days)
SELECT 
    '2. RECENTLY CREATED/UPDATED ADMINS (Last 7 days)' AS section,
    id,
    email,
    full_name,
    user_type,
    created_at,
    updated_at,
    CASE 
        WHEN updated_at > created_at THEN '⚠️ USER TYPE WAS MODIFIED'
        ELSE 'Created as admin'
    END as status
FROM 
    users
WHERE 
    user_type = 'admin'
    AND (created_at > NOW() - INTERVAL '7 days' OR updated_at > NOW() - INTERVAL '7 days')
ORDER BY 
    updated_at DESC;

-- 3. Show users with suspicious email patterns
SELECT 
    '3. SUSPICIOUS ADMIN EMAILS' AS section,
    id,
    email,
    full_name,
    created_at,
    last_login
FROM 
    users
WHERE 
    user_type = 'admin'
    AND (
        email NOT LIKE '%@shoutout.us' 
        AND email NOT LIKE '%@shoutout.com'
        AND email != 'jb@apollo.inc'
    )
ORDER BY 
    created_at DESC;

-- 4. Count total admins
SELECT 
    '4. ADMIN COUNT' AS section,
    COUNT(*) as total_admins,
    COUNT(*) FILTER (WHERE email LIKE '%@shoutout.us' OR email LIKE '%@shoutout.com') as legitimate_admins,
    COUNT(*) FILTER (WHERE email NOT LIKE '%@shoutout.us' AND email NOT LIKE '%@shoutout.com' AND email != 'jb@apollo.inc') as suspicious_admins
FROM 
    users
WHERE 
    user_type = 'admin';

-- 5. Show all users (admin or not) with @shoutout domain
SELECT 
    '5. ALL @SHOUTOUT DOMAIN USERS' AS section,
    id,
    email,
    user_type,
    full_name,
    created_at,
    last_login
FROM 
    users
WHERE 
    email LIKE '%@shoutout.us' OR email LIKE '%@shoutout.com'
ORDER BY 
    email;

-- 6. Check for users created in the last 24 hours (potential hack attempt)
SELECT 
    '6. USERS CREATED IN LAST 24 HOURS' AS section,
    id,
    email,
    user_type,
    full_name,
    created_at
FROM 
    users
WHERE 
    created_at > NOW() - INTERVAL '24 hours'
ORDER BY 
    created_at DESC;

-- 7. Check auth.users table for mismatches
SELECT 
    '7. AUTH VS PUBLIC USER MISMATCHES' AS section,
    au.id,
    au.email,
    au.raw_user_meta_data->>'user_type' as auth_user_type,
    pu.user_type::text as public_user_type,
    CASE 
        WHEN au.raw_user_meta_data->>'user_type' != pu.user_type::text THEN '⚠️ MISMATCH'
        ELSE '✓ Match'
    END as status
FROM 
    auth.users au
LEFT JOIN 
    public.users pu ON au.id = pu.id
WHERE 
    pu.user_type::text = 'admin' OR au.raw_user_meta_data->>'user_type' = 'admin';

SELECT '✅ Security audit complete. Review results above for unauthorized access.' AS status;

-- =====================================================================================================
-- EMERGENCY: REMOVE ALL UNAUTHORIZED ADMINS
-- =====================================================================================================
-- ONLY UNCOMMENT THIS IF YOU FOUND UNAUTHORIZED ADMINS ABOVE

-- Remove admin privileges from users NOT in the authorized list
-- UPDATE users
-- SET 
--     user_type = 'user',
--     updated_at = NOW()
-- WHERE 
--     user_type = 'admin'
--     AND email NOT IN (
--         'admin@shoutout.us',
--         'jb@apollo.inc'
--         -- Add any other legitimate admin emails here
--     );

-- Verify cleanup
-- SELECT 
--     '✅ CLEANUP VERIFICATION' AS status,
--     email,
--     user_type
-- FROM 
--     users
-- WHERE 
--     user_type = 'admin'
-- ORDER BY 
--     email;

