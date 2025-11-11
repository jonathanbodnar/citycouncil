-- TEMPORARY WORKAROUND: Disable the problematic trigger
-- This will stop the automatic user creation that's failing
-- Our frontend code will handle creating the user record instead

-- Disable the trigger on auth.users
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Verify it's disabled
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    action_statement,
    trigger_schema
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Now signUp() should work without trying to create public.users
-- Our frontend code will create the public.users record instead

