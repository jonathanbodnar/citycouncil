

# User Order Request Update Issue - Fix

## 🐛 Problem
Users can edit their order request details, but **talent doesn't see the updates** in their dashboard.

---

## Root Causes

### 1. **RLS Policy Missing or Broken** ⚠️
The `orders` table may not have a policy allowing users to UPDATE their own orders.

### 2. **Talent Dashboard Doesn't Auto-Refresh** 🔄
Even if the UPDATE succeeds in the database, the talent dashboard only loads orders once on page load. It doesn't detect when users change their request details.

---

## The Fix

### Part 1: Fix RLS (Database)

**Run:** `database/fix_user_order_update_rls.sql` in Supabase SQL Editor

This script:
1. Checks current RLS policies on `orders` table
2. Creates/updates policy: `"Allow users to update own orders"`
3. Verifies talent can still read updated data

**Key Policy:**
```sql
CREATE POLICY "Allow users to update own orders" ON orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

This allows users to UPDATE any field on their own orders (filtered by `user_id`).

---

### Part 2: Add Real-Time Updates (Frontend) - OPTIONAL

There are two approaches:

#### **Option A: Manual Refresh (Current State)**
- Talent must refresh the page to see updates
- ✅ Simple, no code changes needed
- ❌ Not user-friendly

#### **Option B: Real-Time Subscriptions (Recommended)**
- Talent dashboard automatically updates when users edit requests
- ✅ Better UX
- ⚠️ Requires code changes

---

## Testing

### Test 1: User Can Update Request
1. Login as a user with a pending order
2. Go to **Dashboard → My Orders**
3. Find a pending order
4. Click **"Edit Request"** button
5. Change the text (e.g., "Updated message for talent")
6. Click **"Save"**

**Expected:**
- ✅ Toast: "Request details updated!"
- ✅ Text immediately updates in user's view

### Test 2: Verify in Database
```sql
SELECT id, request_details, updated_at
FROM orders
WHERE user_id = '[user_id]'
ORDER BY updated_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `request_details` shows new text
- ✅ `updated_at` timestamp is recent

### Test 3: Talent Sees Update
1. Login as the talent for that order
2. Go to **Talent Dashboard → Orders**
3. Find the same order

**Current Behavior:**
- ❌ Still shows old request_details
- ✅ After **manual page refresh**, shows new text

**After Fix:**
- ✅ Shows new text immediately (if real-time implemented)
- OR ✅ Shows new text after refresh (if only RLS fixed)

---

## Deployment Priority

### 🔴 **CRITICAL (Do Now):**
1. Run `database/fix_user_order_update_rls.sql`
2. Test user can update request details
3. Test talent can see updated text (after refresh)

### 🟡 **NICE TO HAVE (Do Later):**
4. Implement real-time subscriptions in `TalentDashboard.tsx`
5. Add auto-refresh or Supabase realtime listener

---

## Implementation Details

### Current User Update Flow:
```javascript
// UserDashboard.tsx lines 259-287
const saveRequestDetails = async (orderId: string) => {
  const { error } = await supabase
    .from('orders')
    .update({ request_details: editedRequestDetails })
    .eq('id', orderId);

  if (error) throw error;
  
  // Updates local state only
  setOrders(orders.map(order => 
    order.id === orderId 
      ? { ...order, request_details: editedRequestDetails }
      : order
  ));
  
  toast.success('Request details updated!');
};
```

### Current Talent Fetch Flow:
```javascript
// TalentDashboard.tsx lines 79-155
const fetchTalentData = async () => {
  const { data: ordersData } = await supabase
    .from('orders')
    .select(`
      *,
      users!orders_user_id_fkey (full_name, avatar_url)
    `)
    .eq('talent_id', profileData.id)
    .order('created_at', { ascending: false });

  setOrders(ordersData || []);
};
```

**Problem:** `fetchTalentData()` only runs:
- On initial page load
- After talent uploads video (`fetchTalentData()` called)
- After talent approves/rejects order (`fetchTalentData()` called)

**NOT called when:** User updates their request details.

---

## Real-Time Update Implementation (Optional)

### Add Supabase Realtime Subscription:

```typescript
// Add to TalentDashboard.tsx useEffect
useEffect(() => {
  if (!talentProfile?.id) return;

  // Subscribe to order updates
  const channel = supabase
    .channel('talent-orders')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `talent_id=eq.${talentProfile.id}`,
      },
      (payload) => {
        console.log('Order updated:', payload);
        
        // Update the specific order in state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === payload.new.id
              ? { ...order, ...payload.new }
              : order
          )
        );
        
        // Optional: Show toast notification
        if (payload.old.request_details !== payload.new.request_details) {
          toast.info('Customer updated their request details');
        }
      }
    )
    .subscribe();

  // Cleanup on unmount
  return () => {
    supabase.removeChannel(channel);
  };
}, [talentProfile?.id]);
```

### Enable Realtime on Orders Table:

```sql
-- Run in Supabase SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
```

---

## Summary

| Issue | Cause | Fix | Priority |
|-------|-------|-----|----------|
| User can't update | RLS blocks UPDATE | Run `fix_user_order_update_rls.sql` | 🔴 CRITICAL |
| Talent doesn't see update | No auto-refresh | Manual refresh works | 🟢 OK |
| Talent wants auto-update | No realtime subscription | Add Supabase realtime | 🟡 NICE TO HAVE |

---

## Files

- ✅ `database/fix_user_order_update_rls.sql` - RLS fix (DEPLOY NOW)
- ✅ `USER_ORDER_UPDATE_FIX.md` - This documentation
- ⏳ `src/components/TalentDashboard.tsx` - Optional realtime code (FUTURE)

---

## Quick Deploy

```bash
# 1. Fix RLS
# Copy database/fix_user_order_update_rls.sql
# Paste in Supabase Dashboard → SQL Editor
# Run

# 2. Test
# - User edits request
# - Check database updated
# - Talent refreshes page
# - Talent sees new text

# 3. Done!
```

---

## Status

- 🔴 **RLS FIX READY** - Deploy `fix_user_order_update_rls.sql`
- 🟡 **REALTIME OPTIONAL** - Can implement later if needed
- 🟢 **WORKAROUND AVAILABLE** - Talent can manually refresh page

---

## Support Notes

If user says "Talent can't see my updated request":
1. Ask: "Did you save the changes?" (should see toast)
2. Ask talent: "Did you refresh the page?"
3. Check database: `SELECT request_details FROM orders WHERE id = '[order_id]';`
4. If DB shows old text → RLS blocking UPDATE → Run RLS fix
5. If DB shows new text → Talent needs to refresh page → Normal behavior

