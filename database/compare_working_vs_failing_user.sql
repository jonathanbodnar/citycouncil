-- Compare Working User vs Failing User
-- john@example.com works, jonathanbagwell23@gmail.com fails

-- =============================================================================
-- COMPARE THE TWO USERS
-- =============================================================================

-- Working user (john@example.com)
SELECT 
  'WORKING USER: john@example.com' as comparison,
  id,
  email,
  user_type,
  full_name,
  phone,
  avatar_url,
  created_at,
  LENGTH(full_name) as name_length,
  LENGTH(email) as email_length,
  CASE WHEN phone IS NULL THEN '⚠️ No phone' ELSE '✅ Phone: ' || phone END as phone_status,
  CASE WHEN full_name IS NULL OR full_name = '' THEN '❌ No name' ELSE '✅ Name: ' || full_name END as name_status,
  CASE WHEN full_name = email THEN '⚠️ Name = Email (may be issue)' ELSE '✅ Unique name' END as name_check
FROM public.users
WHERE email = 'john@example.com';

-- Failing user (jonathanbagwell23@gmail.com)
SELECT 
  'FAILING USER: jonathanbagwell23@gmail.com' as comparison,
  id,
  email,
  user_type,
  full_name,
  phone,
  avatar_url,
  created_at,
  LENGTH(full_name) as name_length,
  LENGTH(email) as email_length,
  CASE WHEN phone IS NULL THEN '⚠️ No phone' ELSE '✅ Phone: ' || phone END as phone_status,
  CASE WHEN full_name IS NULL OR full_name = '' THEN '❌ No name' ELSE '✅ Name: ' || full_name END as name_status,
  CASE WHEN full_name = email THEN '⚠️ Name = Email (may be issue)' ELSE '✅ Unique name' END as name_check
FROM public.users
WHERE email = 'jonathanbagwell23@gmail.com';

-- =============================================================================
-- SIDE-BY-SIDE COMPARISON
-- =============================================================================

SELECT 
  'SIDE BY SIDE COMPARISON' as check_name,
  u1.email as working_email,
  u2.email as failing_email,
  u1.full_name as working_name,
  u2.full_name as failing_name,
  u1.phone as working_phone,
  u2.phone as failing_phone,
  u1.user_type as working_user_type,
  u2.user_type as failing_user_type,
  CASE 
    WHEN u1.full_name != u2.full_name THEN '⚠️ Different names'
    ELSE '✅ Same name pattern'
  END as name_diff,
  CASE 
    WHEN (u1.phone IS NULL AND u2.phone IS NOT NULL) OR (u1.phone IS NOT NULL AND u2.phone IS NULL) THEN '⚠️ Phone difference'
    ELSE '✅ Same phone status'
  END as phone_diff
FROM public.users u1
CROSS JOIN public.users u2
WHERE u1.email = 'john@example.com'
  AND u2.email = 'jonathanbagwell23@gmail.com';

-- =============================================================================
-- CHECK IF FULL_NAME IS CAUSING ISSUE
-- =============================================================================

-- Fortis might reject if full_name is just the email or too short
SELECT 
  'FULL_NAME VALIDATION' as check_name,
  email,
  full_name,
  CASE 
    WHEN full_name IS NULL THEN '❌ NULL (Fortis may reject)'
    WHEN full_name = '' THEN '❌ Empty (Fortis may reject)'
    WHEN full_name = email THEN '⚠️ Name = Email (Fortis may reject)'
    WHEN LENGTH(full_name) < 3 THEN '⚠️ Too short (Fortis may reject)'
    WHEN full_name NOT LIKE '% %' THEN '⚠️ No space (first/last name?) (Fortis may prefer First Last)'
    ELSE '✅ Looks good'
  END as validation_result
FROM public.users
WHERE email IN ('john@example.com', 'jonathanbagwell23@gmail.com');

-- =============================================================================
-- POSSIBLE ISSUE: full_name format
-- =============================================================================

-- If jonathanbagwell23's full_name is just "jonathanbagwell23@gmail.com",
-- Fortis might reject it as invalid

-- Quick fix if that's the case:
-- UPDATE public.users 
-- SET full_name = 'Jonathan Bagwell'
-- WHERE email = 'jonathanbagwell23@gmail.com';

