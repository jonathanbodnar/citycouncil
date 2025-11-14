-- FIX: handle_new_user trigger doesn't save phone_number from metadata
-- This causes users to be created WITHOUT phone, even though it's in auth.users metadata

-- 1. Show current handle_new_user function
SELECT 
  '🔍 CURRENT HANDLE_NEW_USER FUNCTION' as check,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 2. Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Create FIXED handle_new_user function that includes phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use UPSERT with phone_number from metadata
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    user_type,
    phone,  -- ✅ ADD PHONE HERE!
    sms_subscribed,  -- ✅ ADD SMS_SUBSCRIBED!
    sms_subscribed_at,  -- ✅ ADD TIMESTAMP!
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'user'),  -- Get user_type from metadata
    NEW.raw_user_meta_data->>'phone_number',  -- ✅ GET PHONE FROM METADATA!
    CASE 
      WHEN NEW.raw_user_meta_data->>'phone_number' IS NOT NULL 
        AND NEW.raw_user_meta_data->>'phone_number' != '' 
      THEN true 
      ELSE false 
    END,  -- ✅ AUTO-SUBSCRIBE IF PHONE EXISTS!
    CASE 
      WHEN NEW.raw_user_meta_data->>'phone_number' IS NOT NULL 
        AND NEW.raw_user_meta_data->>'phone_number' != '' 
      THEN NOW() 
      ELSE NULL 
    END,  -- ✅ SET TIMESTAMP IF PHONE EXISTS!
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    user_type = COALESCE(EXCLUDED.user_type, public.users.user_type),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),  -- ✅ UPDATE PHONE!
    sms_subscribed = COALESCE(EXCLUDED.sms_subscribed, public.users.sms_subscribed),  -- ✅ UPDATE SMS_SUBSCRIBED!
    sms_subscribed_at = COALESCE(EXCLUDED.sms_subscribed_at, public.users.sms_subscribed_at),  -- ✅ UPDATE TIMESTAMP!
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Verify the new function includes phone
SELECT 
  '✅ NEW HANDLE_NEW_USER FUNCTION (should include phone)' as check,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 6. Backfill existing users: Copy phone from auth.users to public.users
UPDATE public.users pu
SET 
  phone = au.raw_user_meta_data->>'phone_number',
  sms_subscribed = true,
  sms_subscribed_at = COALESCE(pu.sms_subscribed_at, pu.created_at)
FROM auth.users au
WHERE pu.id = au.id
  AND au.raw_user_meta_data->>'phone_number' IS NOT NULL
  AND au.raw_user_meta_data->>'phone_number' != ''
  AND (pu.phone IS NULL OR pu.phone = '');

-- 7. Show users that were just fixed
SELECT 
  '✅ USERS BACKFILLED WITH PHONES' as result,
  pu.id,
  pu.email,
  pu.phone,
  pu.sms_subscribed,
  au.raw_user_meta_data->>'phone_number' as original_phone_in_auth,
  pu.created_at
FROM public.users pu
JOIN auth.users au ON pu.id = au.id
WHERE pu.phone IS NOT NULL
  AND pu.phone != ''
  AND au.raw_user_meta_data->>'phone_number' IS NOT NULL
ORDER BY pu.created_at DESC
LIMIT 20;

-- 8. Verify SMS stats
SELECT 
  '📊 SMS STATS AFTER FIX' as info,
  *
FROM get_sms_stats();

-- 9. Show registered users
SELECT 
  '✅ REGISTERED USERS NOW' as segment,
  email,
  phone_number,
  full_name,
  user_tags
FROM get_users_by_segment('registered')
ORDER BY full_name;

-- 10. Final verification: Show all users with phones
SELECT 
  '📱 ALL USERS WITH PHONES' as final_check,
  id,
  email,
  full_name,
  phone,
  sms_subscribed,
  user_tags,
  created_at
FROM public.users
WHERE phone IS NOT NULL AND phone != ''
ORDER BY created_at DESC;

