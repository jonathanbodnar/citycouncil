-- RESTORE TO LAST KNOWN WORKING STATE
-- This reverts all trigger changes and uses the simplest version that works

-- Step 1: Drop current trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop current function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Create SIMPLE, WORKING version
-- This is based on FINAL_COMPLETE_FIX.sql which was confirmed working
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Step 4: Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Remove problematic foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_id_fkey' 
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
    RAISE NOTICE '✅ Dropped problematic users_id_fkey constraint';
  END IF;
END $$;

-- Step 6: Verify everything
SELECT '✅ Trigger recreated' AS status;

SELECT 
  tgname AS trigger_name,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END AS status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

