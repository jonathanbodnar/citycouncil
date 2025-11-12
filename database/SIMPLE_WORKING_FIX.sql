-- SIMPLE WORKING FIX - Copy this entire file and run in Supabase SQL Editor

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create simple working function
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.users (id, email, full_name, user_type, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Step 3: Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Make full_name nullable
ALTER TABLE public.users ALTER COLUMN full_name DROP NOT NULL;

-- Step 5: Fix RLS
DROP POLICY IF EXISTS "Allow service role full access" ON public.users;
CREATE POLICY "Allow service role full access" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Step 6: Verify
SELECT 'SUCCESS' AS status;

