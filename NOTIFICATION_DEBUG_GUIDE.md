# 🔔 Notification Debugging Guide

## Issues Reported:
1. ✅ **Order acceptance failing** - FIXED
2. 🔍 **Notifications not showing** - NEEDS TESTING

---

## ✅ FIXED: Order Acceptance

### What Was Wrong:
Error: `Invalid input value for enum order_status: '229920'`

The UUID of the order was somehow being sent as the status value.

### What Was Fixed:
- Added detailed logging to track the flow
- Added `.select().single()` to return the updated order
- Added `await` to `fetchTalentData()` for proper refresh
- Better error handling and messages

### Test It:
1. Log in as talent
2. Go to dashboard → Orders tab
3. Click "Accept Order" on a pending order
4. **Should see:** "Order accepted! You can now upload the video." ✅
5. **Check console:** Should see `"Accepting order: <uuid>"` and `"Order accepted successfully: {...}"`

---

## 🔍 INVESTIGATING: Notifications Not Showing

### What SHOULD Happen:

When a user places an order:

```javascript
// 1. Order is created in database
await supabase.from('orders').insert([...])

// 2. Notification is created for talent
await notificationService.notifyNewOrder(
  talent.user_id,  // ← Talent's auth user ID
  order.id,
  user.full_name,
  pricing.total
)

// 3. Header's real-time subscription receives INSERT event
supabase
  .channel('notifications-header')
  .on('postgres_changes', { event: 'INSERT', filter: `user_id=eq.${user.id}` })
  .subscribe()

// 4. fetchNotifications() is called
// 5. Notification badge updates
// 6. Notification appears in dropdown
```

### Possible Issues:

#### 1. **User ID Mismatch**
**Problem:** `talent.user_id` in `talent_profiles` doesn't match `auth.user.id`

**Check:**
```sql
-- Run in Supabase SQL Editor
SELECT 
  tp.id as talent_profile_id,
  tp.user_id as talent_user_id,
  au.id as auth_user_id,
  au.email,
  tp.temp_full_name
FROM talent_profiles tp
LEFT JOIN auth.users au ON tp.user_id = au.id
WHERE tp.user_id IS NOT NULL
LIMIT 10;
```

**Expected:** `talent_user_id` should match `auth_user_id`  
**If not:** That's the problem - notifications are being created for wrong user_id

#### 2. **RLS Policy Blocking Reads**
**Problem:** Talent can't read their own notifications due to RLS

**Check:**
```sql
-- Check RLS policies on notifications table
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

**Fix (if needed):**
```sql
-- Allow users to read their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

#### 3. **Real-Time Subscription Not Active**
**Problem:** Notification created before subscription starts

**Check Console:**
When you log in as talent, you should see:
```
[Supabase] Listening to notifications-header channel
```

If you don't see this, the subscription isn't starting.

#### 4. **Notification IS Created But Not Fetched**
**Problem:** Notification exists in DB but Header doesn't show it

**Check:**
```sql
-- Get recent notifications for a talent
SELECT * FROM notifications 
WHERE user_id = '<TALENT_USER_ID>'
ORDER BY created_at DESC
LIMIT 5;
```

If notifications exist but Header shows 0, it's a fetch/RLS issue.

---

## 🧪 Testing Steps:

### Step 1: Place an Order (as Customer)
1. Log in as a regular user (not talent)
2. Go to any talent's profile
3. Click "Order a ShoutOut"
4. Fill out the form
5. Complete payment
6. **Watch console for:**
   ```
   📢 Creating new order notification for talent: {talentUserId, orderId, ...}
   📢 New order notification result: true
   ```

### Step 2: Check If Notification Was Created
Open Supabase Dashboard → Table Editor → `notifications`

Look for a row where:
- `user_id` = the talent's user ID (from `talent_profiles.user_id`)
- `type` = 'order_placed'
- `title` = '🎬 New Order Received!'
- `is_read` = false
- `created_at` = just now

**If the row EXISTS:** Notification was created ✅  
**If the row DOESN'T EXIST:** `notificationService.createNotification()` failed ❌

### Step 3: Log in as Talent
1. Log out
2. Log in as the talent who received the order
3. **Check notification bell icon** (top right)
4. **Should see:** Red badge with "1" ✅
5. **Click the bell**
6. **Should see:** The notification in the dropdown ✅

### Step 4: Debug If Not Showing

**A. Check Console Logs:**
```
[Supabase] Listening to notifications-header channel
Fetching user profile for: Best3913-7d65-40d3-8ab4-99b20b047525
User profile found: {id, email, user_type: 'talent', ...}
```

**B. Open Browser DevTools → Network Tab:**
- Filter for "notifications"
- Look for requests to Supabase
- Check if `user_id=eq.<CORRECT_ID>`

**C. Manually Trigger Fetch:**
Open console and run:
```javascript
// Check current user ID
console.log('Current user:', await supabase.auth.getUser())

// Manually fetch notifications
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', '<PASTE_USER_ID_HERE>')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('Notifications:', data, error);
```

**If `data` is empty:** RLS issue or wrong user_id  
**If `data` has notifications:** Header not fetching correctly

---

## 🔍 Common Fixes:

### Fix 1: User ID Mismatch
```sql
-- Update talent_profiles to use correct user_id
UPDATE talent_profiles
SET user_id = auth.uid()
WHERE email = '<TALENT_EMAIL>';
```

### Fix 2: RLS Policy Missing
```sql
-- Add read policy for notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add insert policy (for system to create notifications)
CREATE POLICY "Service role can create notifications"
ON notifications FOR INSERT
TO service_role
WITH CHECK (true);
```

### Fix 3: Real-Time Not Enabled
In Supabase Dashboard:
1. Go to Database → Replication
2. Find `notifications` table
3. Enable "INSERT" events
4. Save

---

## 📊 Expected Console Output:

### When Order is Placed:
```
📢 Creating new order notification for talent: {
  talentUserId: "Best3913-7d65-40d3-8ab4-99b20b047525",
  orderId: "229920a7-d7be-4e3c-8b28-5c1a5c7e3367",
  userName: "John Smith",
  amount: 50
}
📢 New order notification result: true
```

### When Talent Logs In:
```
[Supabase] Listening to notifications-header channel
Fetching user profile for: Best3913-7d65-40d3-8ab4-99b20b047525
User profile found: {...}
```

### When Notification Bell is Clicked:
```
Fetching notifications for user: Best3913-7d65-40d3-8ab4-99b20b047525
Notifications fetched: [{id: "...", title: "🎬 New Order Received!", ...}]
Unread count: 1
```

---

## 🎯 Quick Test Commands:

### Check if notifications exist:
```sql
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at,
  u.email as talent_email
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
WHERE n.type = 'order_placed'
ORDER BY n.created_at DESC
LIMIT 10;
```

### Check talent user IDs:
```sql
SELECT 
  tp.id as profile_id,
  tp.user_id,
  tp.temp_full_name,
  u.email,
  u.user_type
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id;
```

### Manually create a test notification:
```sql
INSERT INTO notifications (user_id, type, title, message, is_read)
VALUES (
  '<TALENT_USER_ID>',
  'order_placed',
  '🧪 TEST NOTIFICATION',
  'If you see this in the bell icon, notifications are working!',
  false
);
```

---

## ✅ Success Criteria:

- [ ] Order acceptance works (no enum error)
- [ ] Console shows "Creating new order notification..."
- [ ] Console shows "notification result: true"
- [ ] Notification row appears in database
- [ ] Talent logs in and sees red badge on bell icon
- [ ] Clicking bell shows the notification
- [ ] Notification is marked as read when clicked

---

## 🆘 If Still Broken:

1. **Share console output** from:
   - Customer placing order
   - Talent logging in
   - Talent clicking notification bell

2. **Share SQL query results:**
   ```sql
   SELECT * FROM notifications 
   WHERE user_id = '<TALENT_USER_ID>' 
   ORDER BY created_at DESC LIMIT 5;
   ```

3. **Check Network tab:**
   - Are requests to `/rest/v1/notifications` succeeding?
   - What's the response?

4. **Check Supabase logs:**
   - Database → Logs
   - Look for errors related to notifications table

---

**File:** `NOTIFICATION_DEBUG_GUIDE.md`  
**Created:** 2025-11-06  
**Purpose:** Debug why talent notifications aren't appearing in Header bell icon

