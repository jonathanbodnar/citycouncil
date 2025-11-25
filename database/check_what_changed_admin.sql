-- Investigate what might have changed admin@shoutout.us user_type

-- 1. Check if there are any triggers on the users table
SELECT 
    '1. TRIGGERS ON USERS TABLE' AS section,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM 
    information_schema.triggers
WHERE 
    event_object_table = 'users';

-- 2. Check the actual trigger functions
SELECT 
    '2. TRIGGER FUNCTIONS' AS section,
    proname AS function_name,
    prosrc AS function_code
FROM 
    pg_proc
WHERE 
    proname LIKE '%user%'
    AND proname NOT LIKE 'pg_%'
ORDER BY 
    proname;

-- 3. Check recent activity on admin user (if audit log exists)
-- This might not return anything if you don't have audit logging
SELECT 
    '3. CURRENT ADMIN USER STATUS' AS section,
    id,
    email,
    user_type,
    full_name,
    created_at,
    updated_at
FROM 
    users
WHERE 
    email = 'admin@shoutout.us';

-- 4. Check if there are any scheduled jobs or functions that modify user_type
SELECT 
    '4. FUNCTIONS THAT UPDATE USERS' AS section,
    proname AS function_name,
    prosrc AS function_source
FROM 
    pg_proc
WHERE 
    prosrc ILIKE '%UPDATE users%'
    AND prosrc ILIKE '%user_type%';

-- 5. Show all admin users to see if there's a pattern
SELECT 
    '5. ALL ADMIN USERS' AS section,
    email,
    user_type,
    created_at,
    updated_at
FROM 
    users
WHERE 
    user_type = 'admin'
ORDER BY 
    email;

SELECT '✅ Investigation complete - check results above for clues.' AS status;

