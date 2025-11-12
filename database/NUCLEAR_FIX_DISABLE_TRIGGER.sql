-- NUCLEAR FIX: Disable the trigger temporarily to allow signup
-- This will allow users to sign up, then we can fix the trigger properly

-- 1. DISABLE THE TRIGGER (don't drop it, just disable)
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- 2. Verify it's disabled
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  CASE 
    WHEN tgenabled = 'D' THEN 'DISABLED'
    WHEN tgenabled = 'O' THEN 'ENABLED'
    ELSE 'UNKNOWN'
  END AS status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 3. Check what's in the current handle_new_user function
SELECT 
  proname AS function_name,
  prosrc AS function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- TEMPORARY: This disables automatic user creation in public.users
-- You'll need to manually create users in public.users after they sign up
-- OR fix the trigger function and re-enable it

-- To re-enable later:
-- ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

