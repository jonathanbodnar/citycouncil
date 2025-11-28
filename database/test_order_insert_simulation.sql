-- Simulate Mark Walker's order insert to find the exact failure point
-- This will test the insert without actually committing

BEGIN; -- Start transaction (we'll rollback at the end)

-- Get the IDs we need
DO $$
DECLARE
  v_user_id UUID;
  v_talent_id UUID;
  v_test_order_id UUID;
BEGIN
  -- Get Mark Walker's user_id
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'trainleader21@gmail.com';
  
  RAISE NOTICE 'Mark Walker user_id: %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found!';
  END IF;
  
  -- Get Gerald Morgan's talent_id
  SELECT id INTO v_talent_id
  FROM talent_profiles
  WHERE temp_full_name ILIKE '%gerald%morgan%';
  
  RAISE NOTICE 'Gerald Morgan talent_id: %', v_talent_id;
  
  IF v_talent_id IS NULL THEN
    RAISE EXCEPTION 'Talent not found!';
  END IF;
  
  -- Try to insert a test order (simulating what the app would do)
  BEGIN
    INSERT INTO orders (
      user_id,
      talent_id,
      request_details,
      amount,
      admin_fee,
      charity_amount,
      fulfillment_deadline,
      payment_transaction_id,
      status,
      approval_status,
      approved_at,
      is_corporate,
      is_corporate_order,
      allow_promotional_use
    ) VALUES (
      v_user_id,
      v_talent_id,
      'Test order to diagnose insert failure',
      11576, -- $115.76 in cents
      0,
      0,
      NOW() + INTERVAL '48 hours',
      'TEST_TRANSACTION_' || gen_random_uuid()::text,
      'pending',
      'approved',
      NOW(),
      false,
      false,
      true
    )
    RETURNING id INTO v_test_order_id;
    
    RAISE NOTICE '✅ TEST ORDER INSERTED SUCCESSFULLY! Order ID: %', v_test_order_id;
    RAISE NOTICE 'This means the insert SHOULD work. The issue might be:';
    RAISE NOTICE '1. Frontend timeout before insert completes';
    RAISE NOTICE '2. Transaction rollback due to subsequent error';
    RAISE NOTICE '3. Network issue between frontend and database';
    RAISE NOTICE '4. Frontend error handling redirecting despite failure';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST ORDER INSERT FAILED!';
    RAISE NOTICE 'Error Code: %', SQLSTATE;
    RAISE NOTICE 'Error Message: %', SQLERRM;
    RAISE NOTICE 'Error Detail: %', COALESCE(PG_EXCEPTION_DETAIL, 'No detail');
    RAISE NOTICE 'Error Hint: %', COALESCE(PG_EXCEPTION_HINT, 'No hint');
    RAISE NOTICE 'Error Context: %', COALESCE(PG_EXCEPTION_CONTEXT, 'No context');
  END;
  
END $$;

ROLLBACK; -- Undo the test insert

-- Now check what the RLS policies would allow for this user
SELECT 
  'RLS TEST FOR USER' as test_type,
  id,
  email,
  'Can this user insert orders?' as question,
  CASE 
    WHEN user_type = 'user' THEN '✅ Yes (user_type = user)'
    ELSE '❌ No (user_type = ' || user_type || ')'
  END as rls_check
FROM public.users
WHERE email = 'trainleader21@gmail.com';

