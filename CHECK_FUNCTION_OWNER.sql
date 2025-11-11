-- Check who owns the handle_new_user function
-- SECURITY DEFINER runs with owner's privileges
SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as is_security_definer,
    p.provolatile,
    p.proisstrict
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user'
AND n.nspname = 'public';

-- Also check if there are any other triggers or constraints on public.users
-- that might be causing the function to fail

SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass;

