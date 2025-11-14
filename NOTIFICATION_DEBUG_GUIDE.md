# User Notification Debug Guide

## Issue
Users are receiving SMS notifications when videos are delivered, but NOT seeing in-app notifications in the Notification Center.

## System Overview

### When a video is delivered:
1. **Talent uploads video** → `TalentDashboard.tsx` `handleVideoUpload()`
2. **Order updated** → `status: 'completed'`, `video_url: [wasabi_url]`
3. **Notifications sent** → Lines 251-285 in `TalentDashboard.tsx`:
   - Email notification via `emailService.sendOrderDelivered()`
   - **In-app notification** via `notificationService.notifyOrderDelivered()`
   - SMS notification via `notificationService.sendSMSIfEnabled()`

### Notification Service Flow:
```typescript
notificationService.notifyOrderDelivered(userId, orderId, talentName)
  ↓
createNotification(userId, 'order_fulfilled', title, message, { order_id })
  ↓
supabase.from('notifications').insert([...])
```

## Diagnostic Steps

### 1. Run SQL Diagnostics
```bash
# Check if notifications are being created
psql [connection_string] < database/test_notification_creation.sql

# Check RLS policies and recent notifications
psql [connection_string] < database/check_user_notifications.sql
```

### 2. Check Browser Console
When a talent uploads a video, check for:
- `📢 Creating order delivered notification for user:`
- `📢 Order delivered notification result:` (should be `true`)
- Any errors in the notification creation

### 3. Possible Issues

#### Issue A: Notifications ARE being created but users can't see them (RLS)
**Symptoms:**
- SQL shows notifications with `type = 'order_fulfilled'`
- User's notification center is empty

**Fix:** RLS policy issue
```sql
-- Run this to check RLS policies
SELECT policyname, roles, cmd, with_check
FROM pg_policies 
WHERE tablename = 'notifications';
```

#### Issue B: Notifications NOT being created (Silent failure)
**Symptoms:**
- SQL shows NO `order_fulfilled` notifications for recent completed orders
- Console shows error in notification creation

**Possible causes:**
1. **RLS INSERT policy** - `authenticated` role can't insert
2. **Foreign key constraint** - `user_id` or `order_id` doesn't exist
3. **Type constraint** - `'order_fulfilled'` not in CHECK constraint
4. **Frontend error** - Promise rejection swallowed

**Fix:** Check the notification type constraint:
```sql
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
WHERE con.conrelid = 'notifications'::regclass
AND con.contype = 'c';
```

#### Issue C: Wrong user_id being used
**Symptoms:**
- Notifications exist but for wrong user
- Talent sees the notification instead of the customer

**Check:**
```sql
SELECT 
    n.user_id as notified_user,
    o.user_id as order_customer_id,
    o.talent_id,
    n.user_id = o.user_id as correct_user
FROM notifications n
JOIN orders o ON o.id = n.order_id
WHERE n.type = 'order_fulfilled'
ORDER BY n.created_at DESC
LIMIT 10;
```

## Quick Fix Script

If notifications aren't being created, run:
```sql
-- Ensure RLS policies allow notification creation
database/fix_notifications_rls.sql
```

## Testing

### Manual Test:
1. Have a talent upload a video for an existing order
2. Check browser console for notification logs
3. Check user's notification center immediately
4. Run SQL: `SELECT * FROM notifications WHERE type = 'order_fulfilled' ORDER BY created_at DESC LIMIT 5;`

### Expected Results:
- ✅ Console: `📢 Order delivered notification result: true`
- ✅ SQL: New `order_fulfilled` notification with correct `user_id`
- ✅ User sees notification in Notification Center
- ✅ SMS sent to user's phone

## Code Locations

- **Notification Creation**: `src/services/notificationService.ts:214-231`
- **Video Upload & Trigger**: `src/components/TalentDashboard.tsx:251-285`
- **Notification Display**: `src/components/NotificationCenter.tsx:27-43`
- **RLS Policies**: `database/create_notifications_table.sql:24-54`
