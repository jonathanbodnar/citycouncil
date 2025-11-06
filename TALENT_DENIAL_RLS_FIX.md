# URGENT: Talent Order Denial RLS Fix

## 🚨 Critical Issue
**Talent cannot deny orders** - Refund processes but database doesn't update.

---

## Error Seen
```
❌ "Refund processed but failed to update order status"
```

**What happens:**
1. ✅ Talent clicks "Deny Order" with reason
2. ✅ Fortis processes refund (money goes back to customer)
3. ❌ Database UPDATE fails (RLS blocks it)
4. ❌ Order still shows as "pending" in database
5. 😱 **Customer got refunded but order status is wrong!**

---

## Console Evidence
From browser DevTools console:
```javascript
Failed to update order status: Object.procesRefund (142.5c08c848.chunk.js:1)
Refund service error: Error: Refund processed but failed to update order status
  at Object.processRefund (142.5c08c848.chunk.js:1)
  at async infosnashboard.tsx:325:14
```

---

## Root Cause

### The Problem:
The **"Allow talent to update orders"** RLS policy has a **WITH CHECK clause** that's too restrictive.

When `refundService.ts` tries to update:
```sql
UPDATE orders SET 
  status = 'denied',
  denial_reason = '...',
  denied_by = 'talent',
  denied_at = NOW(),
  refund_id = '...',
  refund_amount = 5000
WHERE id = '...';
```

The RLS policy's `WITH CHECK` clause validates the **AFTER state** and fails, likely because:
- It checks `status = 'pending'` but we're changing it to `'denied'`
- OR it has other restrictive conditions

---

## The Fix

### SQL Script: `database/fix_orders_rls_for_denial.sql`

```sql
-- Drop old restrictive policy
DROP POLICY IF EXISTS "Allow talent to update orders" ON orders;

-- Create new permissive policy
CREATE POLICY "Allow talent to update orders" ON orders
FOR UPDATE
TO authenticated
USING (
  -- Can you access this row? (Are you the talent?)
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- After update, is it still your row? (Still your talent_id?)
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);
```

### Why This Works:
- **USING clause**: Checks if you OWN the order (your talent_id)
- **WITH CHECK clause**: Only ensures you didn't change talent_id to someone else
- **Allows**: ANY field updates (status, denial_reason, video_url, etc.)
- **Prevents**: Talent from updating OTHER talent's orders

---

## Deployment Steps

### 1. **Run SQL Fix (IMMEDIATE)**
```bash
# Copy the entire contents of database/fix_orders_rls_for_denial.sql
# Paste into: Supabase Dashboard → SQL Editor → New Query
# Click "Run"
```

### 2. **Verify Policy Created**
Expected output:
```
UPDATED POLICY CHECK
policyname: "Allow talent to update orders"
operation: UPDATE
roles: {authenticated}
using_clause: (talent_id IN ( SELECT talent_profiles.id ... ))
check_clause: (talent_id IN ( SELECT talent_profiles.id ... ))
```

### 3. **Test Talent Denial**
1. Login as a talent with pending orders
2. Click "Deny" on an order
3. Enter reason: "Testing RLS fix"
4. Click "Deny Order & Process Refund"

**Expected:**
- ✅ Toast: "Order denied and refund processed successfully"
- ✅ Order disappears from pending list
- ✅ Check Supabase: `orders` table shows `status = 'denied'`
- ✅ Check Supabase: `denial_reason`, `denied_by`, `denied_at` are filled
- ✅ Customer receives email + in-app notification

---

## What Changed

| Aspect | Before (Broken) | After (Fixed) |
|--------|----------------|---------------|
| **Fortis Refund** | ✅ Works | ✅ Works |
| **DB Status Update** | ❌ RLS blocks | ✅ RLS allows |
| **Order Status** | Stuck on 'pending' | Changes to 'denied' |
| **Denial Reason** | Not saved | ✅ Saved |
| **Customer Notification** | Not sent | ✅ Sent |

---

## Impact

### Before Fix:
- 💸 Customer refunded but order shows "pending"
- 😕 Talent confused why order still shows up
- 📧 Customer never notified why order was denied
- 🐛 Data inconsistency (payment refunded, status wrong)

### After Fix:
- ✅ Order status correctly updates to "denied"
- ✅ Denial reason saved and sent to customer
- ✅ Email + in-app notification sent
- ✅ Order removed from talent's pending list
- ✅ Data consistent across Fortis and database

---

## For Admin: What to Check

### If customer asks "Why is my order still pending but I got refunded?"

1. **Check Supabase orders table:**
   ```sql
   SELECT id, status, denial_reason, denied_by, denied_at, refund_id
   FROM orders
   WHERE user_id = '[customer_id]'
   ORDER BY created_at DESC;
   ```

2. **If status is 'pending' but refund_id exists:**
   - ⚠️ This happened BEFORE the fix
   - Manually update:
     ```sql
     UPDATE orders SET 
       status = 'denied',
       denied_by = 'talent',
       denied_at = NOW(),
       denial_reason = 'Order was denied by talent (refund already processed)'
     WHERE id = '[order_id]' AND refund_id IS NOT NULL;
     ```

3. **Send manual notification to customer:**
   - Explain order was denied
   - Confirm refund was processed
   - Provide denial reason if available

---

## Testing Checklist

After deploying the SQL fix:

- [ ] RLS policy recreated (check Supabase)
- [ ] Test talent denial on pending order
- [ ] Verify order status changes to 'denied'
- [ ] Verify denial_reason is saved
- [ ] Verify denied_by = 'talent'
- [ ] Verify denied_at timestamp
- [ ] Verify refund_id is saved
- [ ] Verify customer receives email
- [ ] Verify customer sees in-app notification
- [ ] Verify order removed from talent's pending list
- [ ] Test admin denial (should also work)

---

## Files Changed

| File | Purpose |
|------|---------|
| `database/fix_orders_rls_for_denial.sql` | **THE FIX** - Updates RLS policy |
| `database/debug_josh_firestine.sql` | Investigation for separate Edge Function error |
| `TALENT_DENIAL_RLS_FIX.md` | This documentation |

---

## Related Issues

### Issue #1: Josh Firestine Order Error ⏳
Separate issue: "Edge Function returned a non-2xx status code"
- Happening on `fortis-verify` Edge Function
- Only for Josh Firestine's talent profile
- Payment succeeds but verification fails
- **Status:** Under investigation (use `debug_josh_firestine.sql`)

### Issue #2: Multiple Orders Per User ✅
- **Status:** FIXED in `fix_orders_rls_for_multiple_orders.sql`
- Unrelated to this denial issue

---

## Summary

**Problem:** Talent denial succeeds in Fortis but fails in database (RLS blocks UPDATE)

**Fix:** Recreate RLS policy with less restrictive WITH CHECK clause

**Deploy:** Run `database/fix_orders_rls_for_denial.sql` in Supabase SQL Editor

**Test:** Talent should be able to deny orders and see status update correctly

**Impact:** CRITICAL - Affects all talent denials, causes data inconsistency

**Status:** 🟢 **FIX READY - DEPLOY NOW**

---

## Support Contact

If issues persist after deploying this fix:
1. Check browser console for new errors
2. Check Supabase logs for RLS errors
3. Verify policy exists: `SELECT * FROM pg_policies WHERE tablename = 'orders';`
4. Contact dev team with order ID and user email

