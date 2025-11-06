# Josh Firestine Order Creation Failure - Debug Guide

## 🚨 Issue
User tries to order from **Josh Firestine**:
- ✅ Payment succeeds in Fortis ($50.00 processed)
- ❌ "Edge Function returned a non-2xx status code" (red error message)
- ❌ Order NOT created in database
- ❌ Order NOT showing in user's "My Orders" dashboard

**But:** Ordering from Jonathan Bodnar works fine!

---

## Root Causes (Possible)

### 1. **fortis-verify Edge Function Failing**
The error "Edge Function returned a non-2xx status code" is from `fortis-verify`.

**However:** The verification failure is **caught and ignored** (line 170-172 in `OrderPage.tsx`):
```typescript
try {
  const verify = await verifyFortisTransaction(transactionId);
} catch (e) {
  console.warn('Fortis verification failed:', e);
}
```

So this shouldn't block order creation.

### 2. **RLS Blocking Order INSERT** (Most Likely)
We just deployed RLS fixes for:
- Multiple orders per user ✅
- Talent denial updates ✅  
- User request updates ✅

**But did we check INSERT policy?**

If "Allow users to insert orders" policy is missing or broken:
- ✅ Payment succeeds (Fortis doesn't care about our DB)
- ❌ `INSERT INTO orders` fails silently
- ❌ No order created
- ❌ User sees payment success but no order

### 3. **Josh Firestine's Profile Has NULL/Invalid Data**
If Josh's `talent_profiles` record has:
- `NULL` in required fields (e.g., `pricing`, `fulfillment_time_hours`)
- Invalid foreign key (`user_id` doesn't exist)
- Profile not active (`is_active = false`)

Then order creation would fail.

### 4. **User Already Has Multiple Orders (RLS Filter)**
If the user has existing orders and the RLS policy has:
```sql
-- BAD: Only allows first order
USING (NOT EXISTS (SELECT 1 FROM orders WHERE user_id = auth.uid()))
```

This would block subsequent orders.

---

## Investigation Steps

### Step 1: Check Supabase Logs
**Supabase Dashboard → Logs → Postgres Logs**

Look for errors around the time of the failed order (11/6/2025).

Expected errors:
- `permission denied for table orders` (RLS blocking INSERT)
- `null value violates not-null constraint` (missing required field)
- `foreign key violation` (invalid talent_id or user_id)

### Step 2: Run Debug SQL

Copy `database/debug_josh_firestine.sql` into Supabase SQL Editor:

```sql
-- 1. Find Josh Firestine's profile
SELECT * FROM talent_profiles 
WHERE temp_full_name ILIKE '%firestine%';

-- 2. Check for NULL/invalid values
SELECT 
  CASE WHEN pricing IS NULL THEN '❌ NULL pricing' ELSE '✅' END,
  CASE WHEN fulfillment_time_hours IS NULL THEN '❌ NULL fulfillment' ELSE '✅' END,
  CASE WHEN user_id IS NULL THEN '❌ NULL user_id' ELSE '✅' END,
  CASE WHEN is_active = false THEN '❌ Inactive' ELSE '✅' END
FROM talent_profiles 
WHERE temp_full_name ILIKE '%firestine%';

-- 3. Check RLS INSERT policy
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'orders' AND cmd = 'INSERT';
```

### Step 3: Test Order Creation Manually

Try to manually create an order for Josh Firestine:

```sql
-- Test INSERT (will fail if RLS blocks it)
INSERT INTO orders (
  user_id,
  talent_id,
  request_details,
  amount,
  status,
  payment_transaction_id,
  fulfillment_deadline
) VALUES (
  '[user_id_from_error]',
  '[josh_talent_id]',
  'Test order',
  5000,
  'pending',
  'test_' || gen_random_uuid(),
  NOW() + INTERVAL '48 hours'
);
```

If this fails → RLS issue  
If this works → Frontend issue

### Step 4: Check Browser Console

In the screenshot, there's a red error. Check browser DevTools console for:
- Full error message
- Stack trace
- Supabase error details

Look for:
```javascript
// RLS error
"new row violates row-level security policy"

// Missing field error
"null value in column 'field_name' violates not-null constraint"

// Foreign key error
"insert or update on table orders violates foreign key constraint"
```

---

## Most Likely Scenario

Based on the evidence:

1. **Payment succeeds** → Fortis API works ✅
2. **Edge Function error** → `fortis-verify` fails (but doesn't block order)
3. **Order not created** → Something blocks the INSERT

**Hypothesis:** The **RLS INSERT policy** is either:
- Missing entirely
- Too restrictive (blocks multiple orders)
- Checking a condition that fails for Josh's profile

---

## Quick Fix to Test

### Temporarily disable RLS on orders table:

```sql
-- ⚠️ TESTING ONLY - DO NOT LEAVE DISABLED
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
```

Then try to order from Josh Firestine again.

- ✅ If it works → RLS is the problem
- ❌ If it still fails → Something else (NULL values, foreign key, etc.)

**Remember to re-enable:**
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
```

---

## The RLS Fix (If Needed)

If INSERT policy is missing or broken:

```sql
-- Drop old policy
DROP POLICY IF EXISTS "Allow users to insert orders" ON orders;

-- Create new policy
CREATE POLICY "Allow users to insert orders" ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be creating order for themselves
  auth.uid() = user_id
  -- No other restrictions (allow multiple orders)
);
```

This allows:
- ✅ Users to create unlimited orders
- ✅ Orders for any active talent
- ❌ Users creating orders for OTHER users

---

## Comparison: Why Jonathan Works but Josh Doesn't

| Aspect | Jonathan Bodnar | Josh Firestine |
|--------|----------------|----------------|
| Payment | ✅ Works | ✅ Works |
| fortis-verify | ✅ Succeeds | ❌ Fails (but ignored) |
| Order INSERT | ✅ Works | ❌ Fails |
| Order visible | ✅ Yes | ❌ No |

**Key difference:** Something about Josh's profile or the user's account causes INSERT to fail.

---

## Action Plan

### Immediate (Do Now):
1. ✅ Check Supabase Postgres Logs for INSERT errors
2. ✅ Run `debug_josh_firestine.sql` to check profile validity
3. ✅ Check RLS INSERT policy exists and is correct
4. ✅ Look at browser console for detailed error

### If RLS Issue:
1. Run `fix_orders_rls_for_multiple_orders.sql` (already deployed?)
2. Verify INSERT policy allows multiple orders
3. Test ordering from Josh again

### If Profile Issue:
1. Check Josh's `talent_profiles` for NULL values
2. Fix any missing required fields
3. Ensure `is_active = true` and `onboarding_completed = true`

### If User Issue:
1. Check if user has hit some order limit
2. Check if user account is flagged/restricted
3. Verify user_id exists in both `auth.users` and `public.users`

---

## Expected Resolution

After fixing RLS INSERT policy:
- ✅ User can order from Josh Firestine
- ✅ Order created in database
- ✅ Order visible in user's dashboard
- ✅ Talent (Josh) sees order in their dashboard
- ⚠️ fortis-verify might still fail (separate issue, doesn't block orders)

---

## Files to Check

| File | Purpose |
|------|---------|
| `database/debug_josh_firestine.sql` | Profile diagnostics |
| `database/fix_orders_rls_for_multiple_orders.sql` | Multiple orders RLS fix |
| `src/pages/OrderPage.tsx` | Order creation flow |
| `supabase/functions/fortis-verify/index.ts` | Transaction verification |

---

## Support Response

If user asks: "Why did payment go through but no order?"

**Response:**
> "I see the payment was processed successfully ($50.00). There's a technical issue preventing the order from being created in our system. Our team is investigating why this happens specifically with Josh Firestine's profile. 
>
> We'll either:
> 1. Fix the issue and manually create your order, OR
> 2. Process a full refund
>
> Which would you prefer? Your order request was: '[request_details from Fortis]'"

---

## Status

🔴 **UNDER INVESTIGATION**
- Payment: ✅ Processed in Fortis
- Order: ❌ Not created in database
- Cause: ⏳ Investigating (likely RLS or profile issue)
- Next: Check Supabase logs + run debug SQL

---

## Related Issues

1. ✅ **Multiple Orders RLS** - Fixed in previous commit
2. ✅ **Talent Denial RLS** - Fixed in previous commit
3. ⏳ **INSERT RLS** - May need fixing for Josh's case
4. ⏳ **fortis-verify failing** - Separate issue, doesn't block orders

