-- CREATE MARK WALKER'S ORDER
-- Transaction ID: 31f0cbd4d2f5fdd8acea628c
-- Customer: Mark Walker (trainleader21@gmail.com)
-- Talent: Gerald Morgan
-- User ID: 433fe5d6-d7cb-4eaa-bddd-a831adece5c5
-- Talent ID: 1646f429-3e90-493a-ae48-8fb294868e18

-- ⚠️ BEFORE RUNNING: Update REQUEST_DETAILS with what Mark wants in the video
-- Contact Mark at trainleader21@gmail.com and ask for his order details

BEGIN;

-- Check if transaction already exists in an order (safety check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE payment_transaction_id = '31f0cbd4d2f5fdd8acea628c') THEN
    RAISE EXCEPTION '❌ Order with this transaction ID already exists! Aborting to prevent duplicate.';
  END IF;
  RAISE NOTICE '✅ Transaction ID is unique, proceeding with order creation...';
END $$;

-- Insert the order
INSERT INTO orders (
  user_id,
  talent_id,
  request_details,
  amount,
  original_amount,
  discount_amount,
  coupon_id,
  coupon_code,
  admin_fee,
  charity_amount,
  fulfillment_deadline,
  payment_transaction_id,
  payment_transaction_payload,
  is_corporate,
  is_corporate_order,
  approval_status,
  approved_at,
  status,
  allow_promotional_use,
  created_at
) VALUES (
  '433fe5d6-d7cb-4eaa-bddd-a831adece5c5', -- Mark Walker
  '1646f429-3e90-493a-ae48-8fb294868e18', -- Gerald Morgan
  
  -- ⚠️⚠️⚠️ UPDATE THIS WITH MARK''S ACTUAL REQUEST ⚠️⚠️⚠️
  'Order manually created after payment processing issue. Please contact Mark Walker at trainleader21@gmail.com for specific video request details.',
  
  4836, -- $48.36 in cents (Gerald''s $47 + 2.9% processing = $1.36)
  NULL, -- No coupon, so original amount is the same
  NULL, -- No discount
  NULL, -- No coupon ID
  NULL, -- No coupon code
  1175, -- Admin fee: 25% of $47.00 = $11.75 (1175 cents)
  0, -- Gerald has no charity set up
  NOW() + INTERVAL '48 hours', -- Gerald''s fulfillment time is 48 hours
  '31f0cbd4d2f5fdd8acea628c', -- Fortis transaction ID
  jsonb_build_object(
    'note', 'Order manually created due to payment success but DB insert failure',
    'created_by', 'admin',
    'reason', 'Network timeout during original order attempt'
  ),
  false, -- Not corporate
  false, -- Not corporate order
  'approved', -- Personal orders are auto-approved
  NOW(), -- Approved immediately
  'pending', -- Pending fulfillment by Gerald
  true, -- Allow promotional use (default)
  '2025-11-28 05:08:05'::timestamp -- Backdate to match when payment was processed
) RETURNING id, created_at;

-- Store the order ID for notifications
DO $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Get the order we just created
  SELECT id INTO v_order_id
  FROM orders
  WHERE payment_transaction_id = '31f0cbd4d2f5fdd8acea628c';
  
  RAISE NOTICE 'Order created with ID: %', v_order_id;
  
  -- Create notification for Mark Walker (order confirmed)
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    order_id,
    talent_id,
    is_read,
    created_at
  ) VALUES (
    '433fe5d6-d7cb-4eaa-bddd-a831adece5c5', -- Mark
    'order_confirmed',
    'Order Confirmed!',
    'Your ShoutOut from Gerald Morgan has been confirmed. You will be notified when it''s ready!',
    v_order_id,
    '1646f429-3e90-493a-ae48-8fb294868e18',
    false,
    NOW()
  );
  
  RAISE NOTICE '✅ Customer notification created';
  
  -- Create notification for Gerald Morgan (new order)
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    order_id,
    talent_id,
    is_read,
    created_at
  ) VALUES (
    '37210684-9edb-4d93-84a3-d32866461983', -- Gerald''s user_id
    'new_order',
    'New Order Received!',
    'You have a new ShoutOut request from Mark Walker',
    v_order_id,
    '1646f429-3e90-493a-ae48-8fb294868e18',
    false,
    NOW()
  );
  
  RAISE NOTICE '✅ Talent notification created';
END $$;

-- Verify the order
SELECT 
  '✅✅✅ ORDER SUCCESSFULLY CREATED ✅✅✅' as status,
  o.id as order_id,
  o.amount / 100.0 as amount_dollars,
  o.status,
  o.payment_transaction_id,
  o.created_at,
  o.fulfillment_deadline,
  u.email as customer_email,
  u.full_name as customer_name,
  t.temp_full_name as talent_name
FROM orders o
JOIN public.users u ON o.user_id = u.id
JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.payment_transaction_id = '31f0cbd4d2f5fdd8acea628c';

-- Show notifications created
SELECT 
  'NOTIFICATIONS CREATED' as info,
  n.user_id,
  u.email,
  n.type,
  n.title,
  n.created_at
FROM notifications n
JOIN public.users u ON n.user_id = u.id
WHERE n.order_id = (SELECT id FROM orders WHERE payment_transaction_id = '31f0cbd4d2f5fdd8acea628c')
ORDER BY n.created_at;

COMMIT;

-- 📧 NEXT STEPS AFTER RUNNING THIS:
-- 1. Contact Mark Walker (trainleader21@gmail.com) to get his video request details
-- 2. Update the order request_details field with his actual request
-- 3. Send confirmation email to Mark
-- 4. Send notification email to Gerald Morgan
-- 5. Mark can now add his phone number in his profile (we fixed that too!)

