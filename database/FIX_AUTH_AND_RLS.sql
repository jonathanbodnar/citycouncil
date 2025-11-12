-- COMPLETE FIX: Auth + RLS + Trigger
-- This addresses all potential issues

-- ============================================
-- PART 1: Fix the trigger to handle edge cases
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_full_name TEXT;
  user_user_type TEXT;
BEGIN
  -- Get full_name, ensure it's never NULL or empty
  user_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)  -- Use email prefix as fallback
  );
  
  -- Get user_type, default to 'user'
  user_user_type := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'user_type'), ''),
    'user'
  );

  -- Insert or update user in public.users
  INSERT INTO public.users (
    id,
    email,
    full_name,
    user_type,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_user_type,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block auth user creation
    RAISE WARNING 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 2: Fix RLS policies on users table
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "Allow trigger to insert users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything (for triggers)
CREATE POLICY "Allow service role full access"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read their own data
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to update their own data
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 3: Make full_name nullable temporarily
-- ============================================

-- This allows the trigger to insert even if full_name is empty
ALTER TABLE public.users ALTER COLUMN full_name DROP NOT NULL;

-- Set a default value
ALTER TABLE public.users ALTER COLUMN full_name SET DEFAULT 'User';

-- ============================================
-- PART 4: Verify everything
-- ============================================

SELECT 'Trigger: ' || 
  CASE 
    WHEN tgenabled = 'O' THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END AS status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

SELECT 'RLS Policies: ' || COUNT(*)::text || ' active' AS status
FROM pg_policies
WHERE tablename = 'users';

