-- Diagnose JP Sears video upload issue
-- Check for RLS issues, pending orders, and upload permissions

-- 1. Find JP Sears' user ID and talent profile
SELECT 
  'JP SEARS ACCOUNT INFO' as check_type,
  tp.id as talent_id,
  tp.user_id,
  tp.temp_full_name,
  tp.is_active,
  u.email,
  u.user_type
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id
WHERE tp.temp_full_name ILIKE '%jp%sears%'
   OR tp.temp_full_name ILIKE '%sears%';

-- 2. Check for pending orders for JP Sears
SELECT 
  'PENDING ORDERS FOR JP SEARS' as check_type,
  o.id,
  o.status,
  o.created_at,
  o.fulfillment_deadline,
  o.video_url,
  u.email as customer_email,
  u.full_name as customer_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC;

-- 3. Check RLS policies on orders table (UPDATE permission)
SELECT 
  'RLS POLICIES - ORDERS UPDATE' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'orders'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- 4. Check if orders table RLS is enabled
SELECT 
  'RLS STATUS ON ORDERS TABLE' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'orders';

-- 5. Test if JP can update his own orders
DO $$
DECLARE
  v_jp_user_id UUID;
  v_jp_talent_id UUID;
  v_test_order_id UUID;
BEGIN
  -- Get JP's IDs
  SELECT user_id, id INTO v_jp_user_id, v_jp_talent_id
  FROM talent_profiles
  WHERE temp_full_name ILIKE '%jp%sears%'
  LIMIT 1;
  
  RAISE NOTICE 'JP Sears user_id: %, talent_id: %', v_jp_user_id, v_jp_talent_id;
  
  -- Get a pending order for JP
  SELECT id INTO v_test_order_id
  FROM orders
  WHERE talent_id = v_jp_talent_id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_test_order_id IS NULL THEN
    RAISE NOTICE '⚠️ No pending orders found for JP Sears';
  ELSE
    RAISE NOTICE 'Found pending order: %', v_test_order_id;
    
    -- Check if the order can be read
    IF EXISTS (SELECT 1 FROM orders WHERE id = v_test_order_id) THEN
      RAISE NOTICE '✅ Can read order %', v_test_order_id;
    ELSE
      RAISE NOTICE '❌ Cannot read order %', v_test_order_id;
    END IF;
  END IF;
END $$;

-- 6. Check storage bucket permissions
SELECT 
  'STORAGE BUCKET POLICIES' as check_type,
  name as bucket_name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name IN ('talent-videos', 'shoutout-videos', 'videos');

-- 7. Check for recent upload attempts in logs (if any errors were logged)
SELECT 
  'RECENT ORDERS UPDATED BY JP' as check_type,
  o.id,
  o.status,
  o.video_url,
  o.updated_at,
  o.created_at
FROM orders o
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
ORDER BY o.updated_at DESC
LIMIT 10;

-- 8. Check video upload size limits and constraints
SELECT 
  'TABLE CONSTRAINTS FOR VIDEO_URL' as check_type,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'video_url';

