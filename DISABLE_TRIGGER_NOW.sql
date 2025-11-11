-- DISABLE the broken trigger
-- Our frontend will handle user creation instead

ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Verify it's disabled
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

