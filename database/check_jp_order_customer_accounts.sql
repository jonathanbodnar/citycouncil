-- Check the customer accounts for JP Sears' pending orders
-- Issues with customer accounts might affect order processing

-- 1. Get all pending orders for JP Sears with customer details
SELECT 
  'PENDING ORDERS WITH CUSTOMER INFO' as check_type,
  o.id as order_id,
  o.status,
  o.created_at,
  o.video_url,
  u.id as customer_user_id,
  u.email as customer_email,
  u.full_name as customer_name,
  u.user_type as customer_type,
  u.phone as customer_phone,
  u.created_at as customer_joined,
  CASE 
    WHEN u.id IS NULL THEN '❌ Customer account DELETED'
    WHEN u.user_type != 'user' THEN '⚠️ Customer is not user type: ' || u.user_type
    WHEN u.email IS NULL THEN '⚠️ Customer has no email'
    ELSE '✅ Customer account OK'
  END as customer_status
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC;

-- 2. Check if customer exists in auth.users
SELECT 
  'CUSTOMER AUTH STATUS' as check_type,
  o.id as order_id,
  au.id as auth_user_id,
  au.email,
  au.email_confirmed_at,
  au.last_sign_in_at,
  au.created_at,
  CASE 
    WHEN au.id IS NULL THEN '❌ Customer not in auth.users!'
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed'
    ELSE '✅ Auth OK'
  END as auth_status
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN auth.users au ON au.id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC;

-- 3. Check for orphaned orders (customer deleted)
SELECT 
  'ORPHANED ORDERS CHECK' as check_type,
  o.id as order_id,
  o.user_id as customer_id,
  o.created_at,
  o.status,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = o.user_id) THEN '❌ ORPHANED - Customer deleted!'
    WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE id = o.user_id) THEN '❌ ORPHANED - Customer not in auth!'
    ELSE '✅ Customer exists'
  END as status
FROM orders o
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC;

-- 4. Check customer metadata
SELECT 
  'CUSTOMER METADATA' as check_type,
  o.id as order_id,
  au.id as customer_id,
  au.email,
  au.raw_user_meta_data,
  au.raw_app_meta_data,
  CASE 
    WHEN au.raw_user_meta_data IS NULL THEN '⚠️ No user metadata'
    WHEN au.raw_user_meta_data->>'user_type' != 'user' THEN '⚠️ Wrong user_type in metadata'
    ELSE '✅ Metadata OK'
  END as metadata_status
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN auth.users au ON au.id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC;

-- 5. Summary of issues
SELECT 
  'SUMMARY' as info,
  COUNT(*) as total_pending_orders,
  COUNT(CASE WHEN u.id IS NULL THEN 1 END) as orders_with_deleted_customers,
  COUNT(CASE WHEN u.user_type != 'user' THEN 1 END) as orders_with_wrong_user_type,
  COUNT(CASE WHEN au.id IS NULL THEN 1 END) as orders_missing_from_auth
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN auth.users au ON au.id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending';

