-- COMPLETE FIX for talent onboarding
-- Run ALL of these in order:

-- 1. Fix the handle_new_user function to respect user_type from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only create user record if it doesn't exist
  -- This allows our frontend to create it first with correct user_type
  INSERT INTO public.users (id, email, full_name, avatar_url, user_type, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'), -- Use metadata if provided
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite if already exists
  
  RETURN NEW;
END;
$function$;

-- 2. Ensure RLS policies allow the trigger to insert
DROP POLICY IF EXISTS "Allow system user creation" ON public.users;

CREATE POLICY "Allow system user creation" ON public.users
FOR INSERT
WITH CHECK (true);

-- 3. Verify the trigger is enabled
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- 4. Check policies
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
AND schemaname = 'public'
ORDER BY policyname;

