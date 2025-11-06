# 🐛 DEBUG: Missing Orders Issue

## Problem Report
A user placed **4 orders** (one from each talent), but only **1 order** is showing up in:
- User's dashboard (`/dashboard`)
- Admin orders management
- System records

## Diagnostic Steps

### 1. Run SQL Diagnostics (FIRST STEP)

Go to **Supabase Dashboard → SQL Editor** and run:
```sql
-- See: database/debug_missing_orders.sql
```

This will show:
- ✅ Total orders in database
- ✅ Orders per user (grouped)
- ✅ Any duplicate transaction IDs
- ✅ Current RLS policies
- ✅ Recent orders (last 24 hours)

### 2. Check Browser Console Logs

With the new logging, check the console when:

**User Dashboard:**
```
🔍 Fetching orders for user: <user_id> <email>
📦 Orders query result: { count: X, error: null, orders: [...] }
```

**Admin Dashboard:**
```
🔍 [ADMIN] Fetching all orders...
📦 [ADMIN] Orders query result: { 
  count: X, 
  ordersByUser: { 
    'user@example.com': 4  // ← Should show 4 orders here!
  } 
}
```

**Order Creation:**
```
🔄 Inserting order…
✅ Order insert result: { success: true, orderId: '...' }
```

### 3. Possible Root Causes

#### A. RLS Policy Issue
**Symptom:** Orders exist in DB but can't be queried by user/admin
**Check:** Run query #4 in `debug_missing_orders.sql`
**Fix:** Update RLS policies to allow proper access

#### B. Duplicate Transaction ID Prevention
**Symptom:** Same payment transaction ID used multiple times
**Check:** Run query #3 in `debug_missing_orders.sql`
**Fix:** Ensure each order gets unique transaction ID

#### C. User ID Mismatch
**Symptom:** Orders created with wrong/null user_id
**Check:** Run query #6 (orphaned orders) and #5 (user-specific orders)
**Fix:** Verify `user.id` is correct during order creation

#### D. Frontend State Issue
**Symptom:** All orders created but only last one shown
**Check:** Console logs show `count: 1` despite 4 orders existing
**Fix:** Check if React state is being overwritten

#### E. Database Trigger/Constraint
**Symptom:** Only first order succeeds, rest fail silently
**Check:** Browser console for insert errors
**Fix:** Review database constraints on `orders` table

### 4. Quick Database Check (Copy User Email)

Ask the user for their email, then run in SQL Editor:
```sql
SELECT 
  o.id,
  o.created_at,
  o.status,
  o.amount,
  tp.username as talent,
  u.email
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE u.email = 'USER_EMAIL_HERE'  -- Replace with actual email
ORDER BY o.created_at DESC;
```

**Expected:** 4 rows (one per talent)
**If < 4 rows:** Orders were never created → payment/creation issue
**If = 4 rows:** Orders exist but RLS/query issue → permissions problem

### 5. Test Order Creation Flow

1. Create a test user account
2. Place **2 test orders** from **2 different talents**
3. Check console logs during each order:
   ```
   🔄 Inserting order… (talent A)
   ✅ Order insert result: { success: true }
   
   🔄 Inserting order… (talent B)
   ✅ Order insert result: { success: true }
   ```
4. Check dashboard:
   ```
   📦 Orders query result: { count: 2 }
   ```
5. **If both show up:** Original user's orders might be corrupted/deleted
6. **If only 1 shows up:** Confirmed bug in order creation/retrieval

### 6. Check for Race Conditions

If user placed all 4 orders **very quickly** (within seconds):
- Payment provider might have deduplicated transactions
- Database unique constraints might have conflicted
- Check `payment_transaction_id` uniqueness

### 7. Verify No Manual Deletions

Check if orders were manually deleted:
```sql
-- If you have audit logs enabled
SELECT * FROM audit_log 
WHERE table_name = 'orders' 
  AND operation = 'DELETE'
ORDER BY created_at DESC;
```

## Resolution Actions

Once you identify the cause:

### If Orders Never Created:
1. Check Fortis payment logs
2. Review browser console during order placement
3. Test order creation flow with test account

### If Orders Exist But Hidden:
1. Fix RLS policies (see `database/fix_orders_rls.sql`)
2. Clear browser cache
3. Re-query with correct user_id

### If Database Constraint Issue:
1. Review unique constraints on `orders` table
2. Ensure `payment_transaction_id` is unique per order
3. Remove duplicate prevention logic if present

## Prevention

Add to order creation:
```typescript
// Generate unique order ID upfront
const orderId = crypto.randomUUID();

// Log before insert
console.log('Creating order:', { orderId, userId, talentId });

// Insert with explicit ID
const { data, error } = await supabase
  .from('orders')
  .insert([{ id: orderId, ...orderData }])
  .select()
  .single();

// Verify insert
if (error) {
  console.error('❌ Order creation failed:', error);
  throw error;
}

console.log('✅ Order created:', data.id);
```

## Contact Support

If issue persists after diagnostics:
1. Export console logs (browser devtools)
2. Run all SQL diagnostic queries
3. Screenshot user's dashboard
4. Screenshot admin orders view
5. Provide user's email for direct DB lookup

