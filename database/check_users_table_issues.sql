-- Check for issues with users table that might be forcing user_type='user'

-- =============================================================================
-- Check 1: Are there triggers on the users table?
-- =============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

-- =============================================================================
-- Check 2: What's the default value for user_type?
-- =============================================================================
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND table_schema = 'public'
  AND column_name = 'user_type';

-- =============================================================================
-- Check 3: Are there any CHECK constraints on user_type?
-- =============================================================================
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users'
  AND nsp.nspname = 'public';

-- =============================================================================
-- Check 4: Full table structure
-- =============================================================================
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- SOLUTION 1: Remove any default value forcing user_type='user'
-- =============================================================================
ALTER TABLE public.users 
ALTER COLUMN user_type DROP DEFAULT;

-- =============================================================================
-- SOLUTION 2: If there's a trigger overriding user_type, we need to see it
-- =============================================================================
-- Run Check 1 above to see trigger details, then we can decide how to fix

-- =============================================================================
-- SOLUTION 3: Check if auth.users metadata is overriding it
-- =============================================================================
-- Supabase sometimes syncs user_type from auth.users.raw_user_meta_data
-- Let's check if there's a trigger doing this

-- =============================================================================
-- Test: Can we manually insert with user_type='talent'?
-- =============================================================================
-- Uncomment to test:
/*
INSERT INTO public.users (id, email, user_type, full_name)
VALUES (
  gen_random_uuid(),
  'manual-test-' || floor(random() * 10000) || '@test.com',
  'talent',
  'Manual Test User'
)
RETURNING id, email, user_type;
*/

-- If this works and shows user_type='talent', then RLS is the issue
-- If this shows user_type='user', then there's a trigger or default overriding it

