# 🚨 EMERGENCY: Recover Missing Orders

## Situation
- User paid for **4 orders** through Fortis ✅
- Only **1 order** created in database ❌
- **3 orders missing** - payments taken but no order record

## Root Cause Analysis

The order creation likely failed silently for 3 of the 4 payments due to:
1. **Race condition** - User checked out multiple talents quickly
2. **Transaction ID conflict** - Fortis might have grouped transactions
3. **Database constraint** - Unique constraint violation
4. **Network error** - Insert failed but payment succeeded
5. **Session expired** - User auth dropped between payments

## Recovery Steps

### STEP 1: Gather Fortis Transaction Data

Log into Fortis Dashboard and find all 4 transactions for this user.

For each transaction, collect:
```
Transaction 1:
- Transaction ID: _______________
- Amount: $_______
- Timestamp: _______________
- Status: _______________

Transaction 2:
- Transaction ID: _______________
- Amount: $_______
- Timestamp: _______________
- Status: _______________

Transaction 3:
- Transaction ID: _______________
- Amount: $_______
- Timestamp: _______________
- Status: _______________

Transaction 4:
- Transaction ID: _______________
- Amount: $_______
- Timestamp: _______________
- Status: _______________
```

### STEP 2: Identify Which Talents They Ordered From

Ask the user or check Fortis transaction descriptions to determine which 4 talents were ordered.

Get talent IDs:
```sql
-- List all talents to match names
SELECT 
  id,
  username,
  temp_full_name,
  pricing,
  fulfillment_time_hours
FROM talent_profiles
WHERE is_active = true
ORDER BY temp_full_name;
```

### STEP 3: Get User ID

```sql
SELECT 
  id as user_id,
  email,
  full_name
FROM users
WHERE email = 'USER_EMAIL_HERE';
```

### STEP 4: Check Existing Order (Template)

```sql
SELECT 
  user_id,
  talent_id,
  request_details,
  amount,
  admin_fee,
  charity_amount,
  payment_transaction_id,
  created_at,
  fulfillment_time_hours
FROM orders o
JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE o.user_id = 'USER_ID_FROM_STEP_3'
LIMIT 1;
```

**Use this as a template** for the missing orders (amounts/fees/etc might be similar).

### STEP 5: Recreate Missing Orders

For **each missing order**, run this (fill in the values):

```sql
INSERT INTO orders (
  user_id,
  talent_id,
  request_details,
  amount,
  admin_fee,
  charity_amount,
  status,
  approval_status,
  approved_at,
  is_corporate_order,
  payment_transaction_id,
  fulfillment_deadline,
  created_at,
  updated_at,
  allow_promotional_use
)
VALUES (
  'USER_ID_FROM_STEP_3',              -- User ID
  'TALENT_ID_FROM_STEP_2',            -- Talent ID for this order
  'Order recovered - please contact support for request details',  -- Placeholder message
  299.99,                              -- Amount from Fortis (replace)
  44.99,                               -- Admin fee (15% of amount - replace)
  15.00,                               -- Charity (5% of amount - replace)
  'pending',                           -- Status
  'approved',                          -- Approval status (personal orders auto-approved)
  NOW(),                               -- Approved timestamp
  false,                               -- Not corporate
  'FORTIS_TXN_ID_FROM_STEP_1',        -- ⚠️ UNIQUE FOR EACH ORDER
  NOW() + INTERVAL '48 hours',         -- Deadline (adjust based on talent's fulfillment_time_hours)
  'TIMESTAMP_FROM_FORTIS',             -- Created at (actual payment time)
  'TIMESTAMP_FROM_FORTIS',             -- Updated at (same as created)
  true                                 -- Allow promotional use
)
RETURNING id, payment_transaction_id, created_at;
```

**IMPORTANT NOTES:**
- `amount` = Total amount from Fortis
- `admin_fee` = Usually 15% of amount (check platform settings)
- `charity_amount` = Usually 5% of amount (check if talent has charity enabled)
- `payment_transaction_id` = **MUST be unique** - use actual Fortis transaction ID
- `fulfillment_deadline` = Add talent's `fulfillment_time_hours` to `created_at`
- `created_at` = Use actual timestamp from Fortis (backdate to when payment was made)

### STEP 6: Update Request Details

Once orders are created, **contact the user** to get their actual request messages for each talent:

```sql
-- Update each order with actual request
UPDATE orders
SET request_details = 'USER PROVIDED REQUEST MESSAGE HERE'
WHERE id = 'ORDER_ID_FROM_STEP_5'
RETURNING id, request_details;
```

### STEP 7: Send Notifications

You'll need to manually trigger notifications for each recovered order.

**Option A: Use Supabase Edge Function**
```typescript
// Call from browser console while logged in as admin
const { data, error } = await supabase.functions.invoke('send-order-notifications', {
  body: {
    orderId: 'ORDER_ID_HERE',
    sendToTalent: true,
    sendToUser: true
  }
});
```

**Option B: Email Manually**
- Email each talent with order details
- Email user with confirmation
- Add in-app notifications manually

### STEP 8: Verify Recovery

```sql
-- Check all orders are now visible
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
WHERE u.email = 'USER_EMAIL_HERE'
ORDER BY o.created_at ASC;
```

**Expected:** 4 rows

### STEP 9: Contact User

Send user an email:
```
Subject: Your Missing ShoutOut Orders Have Been Restored

Hi [User Name],

We identified an issue where 3 of your 4 ShoutOut orders were not properly recorded in our system, even though your payments were successfully processed.

We've now restored all your orders:
- Order 1: [Talent Name] - $XXX
- Order 2: [Talent Name] - $XXX
- Order 3: [Talent Name] - $XXX
- Order 4: [Talent Name] - $XXX

Your orders are now active and the talents have been notified. You can view all orders in your dashboard.

We apologize for the inconvenience. If you have any questions, please reply to this email.

Best regards,
ShoutOut Support Team
```

## Prevention (Fix the Root Cause)

To prevent this from happening again, we need to:

### 1. Add Database Transaction Logging
```sql
CREATE TABLE order_creation_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  talent_id UUID REFERENCES talent_profiles(id),
  payment_transaction_id TEXT,
  amount DECIMAL,
  success BOOLEAN,
  error_message TEXT,
  attempted_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Add Retry Logic in Frontend
```typescript
// In OrderPage.tsx handlePaymentSuccess
let orderCreated = false;
let retryCount = 0;
const maxRetries = 3;

while (!orderCreated && retryCount < maxRetries) {
  try {
    const { data, error } = await supabase.from('orders').insert([...]);
    if (!error) {
      orderCreated = true;
    } else {
      retryCount++;
      await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
    }
  } catch (e) {
    retryCount++;
  }
}
```

### 3. Add Idempotency Check
```typescript
// Before creating order, check if it already exists
const { data: existingOrder } = await supabase
  .from('orders')
  .select('id')
  .eq('payment_transaction_id', paymentResult.id)
  .maybeSingle();

if (existingOrder) {
  console.log('Order already exists for this transaction');
  navigate('/dashboard');
  return;
}
```

### 4. Add Webhook Backup
Create a Fortis webhook that creates orders server-side as a backup to the client-side creation.

## Quick Copy-Paste Template

```sql
-- 1. Get user ID
SELECT id FROM users WHERE email = 'USER_EMAIL';
-- Result: <USER_ID>

-- 2. Get talent IDs
SELECT id, username FROM talent_profiles WHERE username IN ('talent1', 'talent2', 'talent3');
-- Results: <TALENT_ID_1>, <TALENT_ID_2>, <TALENT_ID_3>

-- 3. Create missing order 1
INSERT INTO orders (user_id, talent_id, request_details, amount, admin_fee, charity_amount, status, approval_status, approved_at, is_corporate_order, payment_transaction_id, fulfillment_deadline, created_at, updated_at, allow_promotional_use)
VALUES ('<USER_ID>', '<TALENT_ID_1>', 'Order recovered - contact support', 299.99, 44.99, 15.00, 'pending', 'approved', NOW(), false, '<FORTIS_TXN_1>', NOW() + INTERVAL '48 hours', '<FORTIS_TIMESTAMP_1>', '<FORTIS_TIMESTAMP_1>', true);

-- 4. Create missing order 2
INSERT INTO orders (user_id, talent_id, request_details, amount, admin_fee, charity_amount, status, approval_status, approved_at, is_corporate_order, payment_transaction_id, fulfillment_deadline, created_at, updated_at, allow_promotional_use)
VALUES ('<USER_ID>', '<TALENT_ID_2>', 'Order recovered - contact support', 299.99, 44.99, 15.00, 'pending', 'approved', NOW(), false, '<FORTIS_TXN_2>', NOW() + INTERVAL '48 hours', '<FORTIS_TIMESTAMP_2>', '<FORTIS_TIMESTAMP_2>', true);

-- 5. Create missing order 3
INSERT INTO orders (user_id, talent_id, request_details, amount, admin_fee, charity_amount, status, approval_status, approved_at, is_corporate_order, payment_transaction_id, fulfillment_deadline, created_at, updated_at, allow_promotional_use)
VALUES ('<USER_ID>', '<TALENT_ID_3>', 'Order recovered - contact support', 299.99, 44.99, 15.00, 'pending', 'approved', NOW(), false, '<FORTIS_TXN_3>', NOW() + INTERVAL '48 hours', '<FORTIS_TIMESTAMP_3>', '<FORTIS_TIMESTAMP_3>', true);

-- 6. Verify
SELECT COUNT(*) FROM orders WHERE user_id = '<USER_ID>';
-- Expected: 4
```

## Need Help?

If you need help with recovery:
1. Share the Fortis transaction IDs
2. Share the user's email
3. Share which 4 talents they ordered from
4. I can generate the exact SQL statements for you

