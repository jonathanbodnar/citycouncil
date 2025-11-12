-- Check what the current trigger looks like
-- This will show us what's actually in the database right now

-- 1. Check trigger status
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  CASE 
    WHEN tgenabled = 'D' THEN '❌ DISABLED'
    WHEN tgenabled = 'O' THEN '✅ ENABLED'
    ELSE 'UNKNOWN'
  END AS status,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 2. Check function definition
SELECT 
  proname AS function_name,
  prosrc AS function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 3. Check if users table has phone column
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name IN ('id', 'email', 'full_name', 'phone', 'user_type', 'avatar_url')
ORDER BY ordinal_position;

-- 4. Check users table foreign key constraints
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND contype = 'f'
ORDER BY conname;

