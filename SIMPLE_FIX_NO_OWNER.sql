-- SIMPLE FIX that doesn't require table ownership
-- Run this as your Supabase admin user (from SQL Editor)

-- 1. Update the trigger function to respect user_type from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert user, respecting metadata user_type
  INSERT INTO public.users (id, email, full_name, avatar_url, user_type, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- 2. Make sure the trigger is enabled
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- That's it! The SECURITY DEFINER on the function means it runs with
-- the privileges of the function owner (usually postgres superuser),
-- so it should bypass RLS automatically.

-- 3. Verify it's working by checking the trigger
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

