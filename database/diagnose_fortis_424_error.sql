-- DIAGNOSE: Why is Fortis Still Returning 424 Error?
-- Even after fixing user_type, Fortis still rejects transactions

-- =============================================================================
-- STEP 1: Check if user_type fix was actually applied
-- =============================================================================

-- Check the user who's trying to order (jonathanbagwell123@gmail.com)
SELECT 
  '1. USER TYPE CHECK' as step,
  id,
  email,
  user_type,
  full_name,
  phone,
  created_at,
  CASE 
    WHEN user_type IS NULL THEN '❌ NULL (BAD)'
    WHEN user_type = 'user' THEN '✅ user (GOOD)'
    ELSE '⚠️ Other: ' || user_type
  END as user_type_status,
  CASE 
    WHEN full_name IS NULL OR full_name = '' THEN '❌ No name'
    ELSE '✅ Has name: ' || full_name
  END as name_status,
  CASE
    WHEN email IS NULL OR email = '' THEN '❌ No email'
    ELSE '✅ Has email'
  END as email_status
FROM public.users
WHERE email = 'jonathanbagwell123@gmail.com';

-- =============================================================================
-- STEP 2: Check if DEFAULT was set correctly
-- =============================================================================

SELECT 
  '2. DEFAULT VALUE CHECK' as step,
  column_name,
  column_default,
  is_nullable,
  CASE 
    WHEN column_default LIKE '%user%' THEN '✅ Default = user'
    WHEN column_default IS NULL THEN '❌ No default'
    ELSE '⚠️ Other: ' || column_default
  END as default_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'user_type';

-- =============================================================================
-- STEP 3: Check what Fortis is actually receiving
-- =============================================================================

-- Show recent failed Fortis attempts (if logged)
SELECT 
  '3. RECENT ORDERS (FAILED)' as step,
  id,
  user_id,
  talent_id,
  amount,
  status,
  payment_transaction_id,
  created_at,
  CASE 
    WHEN payment_transaction_id IS NULL THEN '❌ No transaction ID (failed before Fortis)'
    WHEN payment_transaction_id IS NOT NULL AND status = 'pending' THEN '⚠️ Has transaction but pending'
    ELSE '✅ Transaction ID exists'
  END as fortis_status
FROM orders
WHERE user_id IN (SELECT id FROM public.users WHERE email = 'jonathanbagwell123@gmail.com')
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- STEP 4: Compare working user vs failing user
-- =============================================================================

-- Your old test account (WORKS)
SELECT 
  '4A. WORKING USER' as step,
  id,
  email,
  user_type,
  full_name,
  phone,
  created_at
FROM public.users
WHERE email = 'jonathanbagwell123@gmail.com'
LIMIT 1;

-- New user who's failing (if exists)
SELECT 
  '4B. FAILING USER' as step,
  id,
  email,
  user_type,
  full_name,
  phone,
  created_at
FROM public.users
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND email != 'jonathanbagwell123@gmail.com'
ORDER BY created_at DESC
LIMIT 3;

-- =============================================================================
-- STEP 5: Check Fortis Edge Function environment variables
-- =============================================================================

-- We can't directly check Edge Function env vars from SQL,
-- but we can check if credentials are set in Supabase Dashboard
-- Go to: Edge Functions → fortis-intention → Settings → Environment Variables

SELECT 
  '5. FORTIS CREDENTIALS CHECK' as step,
  'Check Supabase Dashboard → Edge Functions → fortis-intention' as action,
  'Verify these exist: FORTIS_DEVELOPER_ID, FORTIS_USER_ID, FORTIS_USER_API_KEY' as required_vars;

-- =============================================================================
-- STEP 6: Check if issue is specific to "Bodnar" talent
-- =============================================================================

-- Show the talent profile (Bodnar)
SELECT 
  '6. BODNAR TALENT PROFILE' as step,
  id,
  user_id,
  temp_full_name,
  username,
  pricing,
  corporate_pricing,
  fulfillment_time_hours,
  is_active,
  onboarding_completed,
  CASE 
    WHEN pricing IS NULL OR pricing = 0 THEN '❌ NULL/0 pricing'
    ELSE '✅ Has pricing: $' || (pricing / 100.0)
  END as pricing_status,
  CASE
    WHEN fulfillment_time_hours IS NULL OR fulfillment_time_hours = 0 THEN '❌ NULL/0 fulfillment'
    ELSE '✅ Has fulfillment: ' || fulfillment_time_hours || 'h'
  END as fulfillment_status,
  CASE
    WHEN is_active = false THEN '❌ Inactive'
    ELSE '✅ Active'
  END as active_status
FROM talent_profiles
WHERE temp_full_name ILIKE '%bodnar%'
  OR username ILIKE '%bodnar%';

-- =============================================================================
-- STEP 7: Test if Fortis credentials are valid
-- =============================================================================

-- This can't be tested from SQL, but check Fortis dashboard at:
-- https://api.fortis.tech/
-- Login and verify:
-- 1. API keys are active
-- 2. Location ID is correct
-- 3. No IP restrictions blocking requests

SELECT 
  '7. FORTIS API CHECK' as step,
  'Login to Fortis Dashboard' as action,
  'Verify API keys are active and working' as instruction;

-- =============================================================================
-- POSSIBLE CAUSES (if user_type is NOT NULL):
-- =============================================================================

-- A. Fortis requires additional user data we're not sending
--    - Phone number (optional but might be required)
--    - Billing address
--    - Customer metadata
--
-- B. Fortis location/environment mismatch
--    - Using production keys in sandbox
--    - Or sandbox keys in production
--
-- C. Fortis transaction amount validation
--    - Amount too low (minimum $0.50?)
--    - Amount format wrong (should be in cents)
--
-- D. Specific talent profile issue
--    - Only happens with Bodnar
--    - Something about his profile breaks Fortis
--
-- E. Rate limiting
--    - Too many failed attempts from same IP
--    - Fortis blocking requests temporarily

-- =============================================================================
-- NEXT STEPS:
-- =============================================================================

SELECT '
🔍 DIAGNOSIS STEPS:

1. Run this entire script
2. Check output for ❌ red flags
3. Specifically look for:
   - user_type still NULL?
   - full_name missing?
   - pricing = 0?
   - fulfillment_time_hours = 0?

4. If ALL green ✅:
   - Issue is NOT in database
   - Issue is with Fortis API call itself
   - Need to check Edge Function logs
   
5. Check Supabase Edge Function Logs:
   - Dashboard → Edge Functions → fortis-intention
   - Look for recent logs showing the 424 error
   - See what payload was sent to Fortis
   
6. Check Fortis Dashboard Logs:
   - Login to Fortis Commerce
   - Check transaction logs
   - See why transaction was rejected

🎯 LIKELY CAUSE:
If user_type = ''user'' now, the 424 error is probably:
- Missing required field Fortis needs
- Invalid Fortis credentials/environment
- Fortis blocking our requests (rate limit)

' as next_steps;

