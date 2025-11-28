-- UPDATE MARK WALKER'S ORDER WITH ACTUAL REQUEST DETAILS
-- Run this AFTER getting the details from Mark Walker

-- Transaction ID: 31f0cbd4d2f5fdd8acea628c

-- ⚠️ Replace this with Mark's actual request:
UPDATE orders
SET request_details = 'REPLACE THIS WITH MARK''S ACTUAL VIDEO REQUEST

Example format:
Hi Gerald! This video is for [recipient name]. 
[Occasion/reason for the video]
Please mention [specific things Mark wants you to say]
[Any special instructions]

Thanks!'
WHERE payment_transaction_id = '31f0cbd4d2f5fdd8acea628c';

-- Verify the update
SELECT 
  'Request details updated!' as status,
  id,
  user_id,
  talent_id,
  request_details,
  amount / 100.0 as amount_dollars,
  created_at
FROM orders
WHERE payment_transaction_id = '31f0cbd4d2f5fdd8acea628c';

