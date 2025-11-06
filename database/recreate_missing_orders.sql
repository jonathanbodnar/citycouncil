-- EMERGENCY: Recreate missing orders from Fortis payments
-- Run this AFTER getting the Fortis transaction details

-- Step 1: First, let's see what we have
-- Find the one existing order for this user
SELECT 
  o.*,
  u.email,
  u.full_name,
  tp.username as talent_username,
  tp.id as talent_id
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE u.email = 'REPLACE_WITH_USER_EMAIL'  -- Replace with actual user email
ORDER BY o.created_at DESC;

-- Step 2: Check if there are any failed insert attempts in logs
-- (This depends on if you have logging enabled)

-- Step 3: MANUAL ORDER RECREATION
-- You'll need to gather from Fortis for each missing payment:
-- - Transaction ID
-- - Amount paid
-- - Timestamp
-- - Which talent they ordered from

-- Template for recreating each missing order:
-- COPY THIS FOR EACH MISSING ORDER AND FILL IN THE VALUES

/*
INSERT INTO orders (
  user_id,              -- Get from existing order: '<USER_ID_HERE>'
  talent_id,            -- Get talent ID: '<TALENT_ID_HERE>' 
  request_details,      -- Get from user: 'User's request message'
  amount,               -- From Fortis: 299.99 (or whatever they paid)
  admin_fee,            -- Calculate: amount * 0.15 (or current admin fee %)
  charity_amount,       -- Usually: amount * 0.05 (5%)
  status,               -- Set to: 'pending'
  approval_status,      -- Set to: 'approved' (assuming personal orders)
  approved_at,          -- Set to: NOW()
  is_corporate_order,   -- Set to: false (assuming personal)
  payment_transaction_id, -- FROM FORTIS: 'fortis_txn_id_here'
  fulfillment_deadline, -- Calculate: NOW() + talent's fulfillment_time_hours
  created_at,           -- FROM FORTIS: '2025-11-06 20:30:00' (actual payment time)
  updated_at,           -- Same as created_at
  allow_promotional_use -- Set to: true (default)
)
VALUES (
  '<USER_ID>',          -- From step 1 query above
  '<TALENT_ID>',        -- Look up by username
  'Missing order - please contact talent for details',  -- Placeholder
  299.99,               -- Replace with actual amount from Fortis
  44.99,                -- Replace with actual admin fee (15% of amount)
  15.00,                -- Replace with actual charity (5% of amount)
  'pending',
  'approved',
  NOW(),
  false,
  'FORTIS_TRANSACTION_ID_HERE',  -- CRITICAL: Get from Fortis
  NOW() + INTERVAL '48 hours',   -- Adjust based on talent's fulfillment time
  '2025-11-06 20:30:00',          -- Replace with actual Fortis payment time
  '2025-11-06 20:30:00',          -- Same as above
  true
)
RETURNING *;
*/

-- Step 4: After recreating orders, send notifications
-- You'll need to manually trigger these or run from app:
-- - Email to talent (new order notification)
-- - Email to user (order confirmation)
-- - In-app notification to talent
-- - In-app notification to user

-- Step 5: Verify all orders are now visible
SELECT 
  o.id,
  o.created_at,
  o.amount,
  o.status,
  o.payment_transaction_id,
  tp.username as talent,
  u.email as user_email
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE u.email = 'REPLACE_WITH_USER_EMAIL'
ORDER BY o.created_at ASC;

-- Expected: 4 rows (one per talent)

