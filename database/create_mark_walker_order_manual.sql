-- Manually create Mark Walker's order for Gerald Morgan
-- After getting Fortis transaction ID from dashboard

-- ⚠️ IMPORTANT: Replace these values before running:
-- 1. TRANSACTION_ID_HERE - Get from Fortis dashboard
-- 2. ACTUAL_AMOUNT - Get exact amount from Fortis (in cents)
-- 3. REQUEST_DETAILS - Get from Mark or estimate

-- Variables needed:
-- Mark Walker user_id: 433fe5d6-d7cb-4eaa-bddd-a831adece5c5
-- Gerald Morgan talent_id: 1646f429-3e90-493a-ae48-8fb294868e18
-- Gerald Morgan pricing: $47.00

BEGIN;

-- 1. Calculate the actual order details based on Gerald's pricing
-- Base price: $47.00
-- Processing fee (2.9%): $1.36
-- Total: $48.36 (4836 cents)

-- 2. Insert the order
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
  'PLACEHOLDER - Get actual request from Mark Walker or ask him to provide details', -- ⚠️ UPDATE THIS
  4836, -- $48.36 in cents (47 + 2.9% processing fee) -- ⚠️ VERIFY WITH FORTIS AMOUNT
  NULL, -- No discount applied
  NULL, -- No discount
  NULL, -- No coupon
  NULL, -- No coupon code
  1175, -- 25% admin fee of $47 = $11.75 (1175 cents)
  0, -- No charity (Gerald doesn't have charity set up)
  NOW() + INTERVAL '48 hours', -- 48 hour deadline (Gerald's default)
  'TRANSACTION_ID_HERE', -- ⚠️ GET FROM FORTIS DASHBOARD
  NULL, -- No payload available
  false, -- Not corporate
  false, -- Not corporate
  'approved', -- Personal orders auto-approved
  NOW(), -- Approved now
  'pending', -- Status pending (waiting for Gerald to fulfill)
  true, -- Allow promotional use
  NOW() -- Created now (but could backdate if needed)
) RETURNING id, created_at;

-- 3. Verify the order was created
SELECT 
  'Order Created!' as result,
  o.id as order_id,
  o.amount / 100.0 as amount_dollars,
  o.status,
  o.payment_transaction_id,
  o.created_at,
  u.email as customer_email,
  t.temp_full_name as talent_name
FROM orders o
JOIN public.users u ON o.user_id = u.id
JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.user_id = '433fe5d6-d7cb-4eaa-bddd-a831adece5c5'
  AND o.talent_id = '1646f429-3e90-493a-ae48-8fb294868e18'
ORDER BY o.created_at DESC
LIMIT 1;

-- 4. Create notification for Mark (order confirmed)
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  order_id,
  talent_id,
  is_read,
  created_at
)
SELECT 
  '433fe5d6-d7cb-4eaa-bddd-a831adece5c5',
  'order_confirmed',
  'Order Confirmed!',
  'Your ShoutOut from Gerald Morgan has been confirmed. You will be notified when it''s ready!',
  o.id,
  '1646f429-3e90-493a-ae48-8fb294868e18',
  false,
  NOW()
FROM orders o
WHERE o.user_id = '433fe5d6-d7cb-4eaa-bddd-a831adece5c5'
  AND o.talent_id = '1646f429-3e90-493a-ae48-8fb294868e18'
ORDER BY o.created_at DESC
LIMIT 1;

-- 5. Create notification for Gerald (new order)
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  order_id,
  talent_id,
  is_read,
  created_at
)
SELECT 
  '37210684-9edb-4d93-84a3-d32866461983', -- Gerald's user_id
  'new_order',
  'New Order Received!',
  'You have a new ShoutOut request from ' || (SELECT full_name FROM public.users WHERE id = '433fe5d6-d7cb-4eaa-bddd-a831adece5c5'),
  o.id,
  '1646f429-3e90-493a-ae48-8fb294868e18',
  false,
  NOW()
FROM orders o
WHERE o.user_id = '433fe5d6-d7cb-4eaa-bddd-a831adece5c5'
  AND o.talent_id = '1646f429-3e90-493a-ae48-8fb294868e18'
ORDER BY o.created_at DESC
LIMIT 1;

-- 6. Show summary
SELECT 
  '✅ ORDER MANUALLY CREATED' as status,
  'Send confirmation email to Mark Walker' as todo_1,
  'Notify Gerald Morgan via email/SMS' as todo_2,
  'Verify Fortis transaction matches' as todo_3;

COMMIT;

-- ⚠️ BEFORE RUNNING THIS SCRIPT:
-- 1. Get Fortis transaction ID from dashboard
-- 2. Verify the exact amount charged
-- 3. Get the order request details from Mark (what does he want in the video?)
-- 4. Update TRANSACTION_ID_HERE and REQUEST_DETAILS above
-- 5. Consider sending manual confirmation emails to both Mark and Gerald

