-- Debug Josh Firestine Order Issue
-- Error: "Edge Function returned a non-2xx status code"
-- Happening on fortis-verify Edge Function

-- =============================================================================
-- STEP 1: Find Josh Firestine's talent profile
-- =============================================================================

SELECT 
  'JOSH FIRESTINE PROFILE' as check_name,
  id,
  user_id,
  temp_full_name,
  username,
  category,
  pricing,
  corporate_pricing,
  fulfillment_time_hours,
  is_active,
  onboarding_completed,
  first_orders_promo_active,
  fulfilled_orders
FROM talent_profiles
WHERE 
  temp_full_name ILIKE '%josh%firestine%' 
  OR temp_full_name ILIKE '%firestine%'
  OR username ILIKE '%josh%'
  OR username ILIKE '%firestine%';

-- =============================================================================
-- STEP 2: Check if there are any orders for Josh Firestine
-- =============================================================================

SELECT 
  'JOSH FIRESTINE ORDERS' as check_name,
  o.id,
  o.created_at,
  o.amount,
  o.status,
  o.payment_transaction_id,
  u.email as customer_email,
  u.full_name as customer_name
FROM orders o
INNER JOIN users u ON o.user_id = u.id
INNER JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE 
  tp.temp_full_name ILIKE '%josh%firestine%' 
  OR tp.temp_full_name ILIKE '%firestine%'
  OR tp.username ILIKE '%josh%'
  OR tp.username ILIKE '%firestine%'
ORDER BY o.created_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: Check Jonathan Bodnar's profile (working comparison)
-- =============================================================================

SELECT 
  'JONATHAN BODNAR PROFILE' as check_name,
  id,
  user_id,
  temp_full_name,
  username,
  category,
  pricing,
  corporate_pricing,
  fulfillment_time_hours,
  is_active,
  onboarding_completed,
  first_orders_promo_active,
  fulfilled_orders
FROM talent_profiles
WHERE 
  temp_full_name ILIKE '%jonathan%bodnar%'
  OR temp_full_name ILIKE '%bodnar%'
  OR username ILIKE '%jonathan%'
ORDER BY created_at DESC
LIMIT 1;

-- =============================================================================
-- STEP 4: Compare recent orders between Josh and Jonathan
-- =============================================================================

-- Jonathan's recent order (should work)
SELECT 
  'JONATHAN RECENT ORDER (WORKING)' as comparison,
  o.id,
  o.created_at,
  o.amount,
  o.status,
  o.payment_transaction_id,
  LENGTH(o.payment_transaction_id) as txn_id_length,
  u.email as customer_email
FROM orders o
INNER JOIN users u ON o.user_id = u.id
INNER JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE 
  tp.temp_full_name ILIKE '%jonathan%bodnar%'
ORDER BY o.created_at DESC
LIMIT 1;

-- =============================================================================
-- STEP 5: Check if Josh's talent profile has any issues
-- =============================================================================

SELECT 
  'JOSH PROFILE VALIDATION' as check_name,
  CASE WHEN tp.temp_full_name IS NULL OR tp.temp_full_name = '' THEN '❌ Missing name' ELSE '✅ Has name' END as name_status,
  CASE WHEN tp.pricing IS NULL OR tp.pricing = 0 THEN '❌ Missing pricing' ELSE '✅ Has pricing' END as pricing_status,
  CASE WHEN tp.fulfillment_time_hours IS NULL OR tp.fulfillment_time_hours = 0 THEN '❌ Missing fulfillment time' ELSE '✅ Has fulfillment time' END as fulfillment_status,
  CASE WHEN tp.is_active = true THEN '✅ Active' ELSE '❌ Inactive' END as active_status,
  CASE WHEN tp.onboarding_completed = true THEN '✅ Onboarding complete' ELSE '⚠️ Onboarding incomplete' END as onboarding_status,
  CASE WHEN tp.user_id IS NULL THEN '❌ No user_id' ELSE '✅ Has user_id' END as user_id_status,
  tp.*
FROM talent_profiles tp
WHERE 
  tp.temp_full_name ILIKE '%josh%firestine%' 
  OR tp.temp_full_name ILIKE '%firestine%';

-- =============================================================================
-- STEP 6: Check for NULL or invalid values that might cause issues
-- =============================================================================

SELECT 
  'POTENTIAL ISSUES' as check_name,
  COUNT(*) FILTER (WHERE temp_full_name IS NULL OR temp_full_name = '') as missing_names,
  COUNT(*) FILTER (WHERE pricing IS NULL OR pricing = 0) as missing_pricing,
  COUNT(*) FILTER (WHERE fulfillment_time_hours IS NULL OR fulfillment_time_hours = 0) as missing_fulfillment,
  COUNT(*) FILTER (WHERE user_id IS NULL) as missing_user_id,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_profiles
FROM talent_profiles
WHERE 
  temp_full_name ILIKE '%josh%firestine%' 
  OR temp_full_name ILIKE '%firestine%';

-- =============================================================================
-- DIAGNOSIS NOTES:
-- =============================================================================
-- 
-- The error "Edge Function returned a non-2xx status code" from fortis-verify
-- means one of these:
--
-- 1. Fortis API rejected the transaction_id lookup (404 or 400)
--    - Transaction ID might be malformed
--    - Transaction ID might not exist in Fortis
--
-- 2. Fortis credentials issue (401 or 403)
--    - But this would affect ALL orders, not just Josh's
--
-- 3. Transaction is in a state Fortis can't verify
--    - Already refunded?
--    - Already captured?
--
-- Since Jonathan's order works but Josh's doesn't, the issue is likely
-- specific to Josh's talent profile or how the order is being created.
--
-- Look for:
-- - NULL or 0 values in required fields
-- - Different pricing structure
-- - Different fulfillment time
-- - Corporate vs personal order differences
--
-- =============================================================================

