# User SMS Notifications - Implementation Guide

## Overview
Users can now provide their phone numbers during signup and receive SMS notifications when their orders are approved and completed.

## Features Implemented

### 1. Phone Number Collection
- ✅ **Signup Form**: Optional phone field with auto-formatting
- ✅ **Format**: Displays as `(555) 123-4567`
- ✅ **Storage**: E.164 format `+15551234567`
- ✅ **Country Code**: Auto-adds +1 for US numbers

### 2. SMS Notifications

#### Order Approved
**Trigger**: When talent clicks "Approve Order" on a corporate order

**Default Template**:
```
Great news! {{talent_name}} approved your ShoutOut order. They'll start working on it soon. Track progress: {{order_link}}
```

**Example**:
```
Great news! John Smith approved your ShoutOut order. They'll start working on it soon. Track progress: https://link.shoutout.us/abc123
```

#### Order Completed
**Trigger**: When talent uploads video and marks order complete

**Default Template**:
```
Your ShoutOut from {{talent_name}} is ready! 🎉 Watch it now: {{order_link}}
```

**Example**:
```
Your ShoutOut from John Smith is ready! 🎉 Watch it now: https://link.shoutout.us/xyz789
```

### 3. Admin Controls

**Location**: Admin Panel → Notifications

Admins can:
- ✅ Toggle SMS notifications on/off for each type
- ✅ Edit SMS templates
- ✅ Preview SMS with variable replacement
- ✅ See live character count

### 4. Template Variables

Available in SMS templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{first_name}}` | User's first name | "John" |
| `{{talent_name}}` | Talent's full name | "Jane Doe" |
| `{{order_link}}` | Link to orders page | "https://shoutout.us/dashboard?tab=orders" |

## Database Structure

### users.phone_number
- **Type**: TEXT
- **Format**: E.164 (+1XXXXXXXXXX)
- **Nullable**: Yes (optional)
- **Example**: `+15551234567`

### notification_settings
New rows added:

```sql
notification_type: 'user_order_approved'
display_name: 'Order Approved (User)'
sms_template: 'Great news! {{talent_name}} approved your ShoutOut order...'
sms_enabled: true

notification_type: 'user_order_completed' 
display_name: 'Order Completed (User)'
sms_template: 'Your ShoutOut from {{talent_name}} is ready! 🎉...'
sms_enabled: true
```

## User Flow

### New Users
1. Visit `/signup`
2. Enter name, email, password
3. **Optionally** enter phone number
4. See message: "Get SMS notifications when your video is ready"
5. Submit form → Phone saved in E.164 format

### Order Notifications
1. User places order
2. Talent approves order → **SMS sent** ✅
3. Talent completes order → **SMS sent** ✅
4. User clicks SMS link → Redirects to orders page

## Technical Details

### PhoneInput Component
**Location**: `src/components/PhoneInput.tsx`

**Features**:
- Real-time formatting as user types
- Auto-adds +1 prefix (displayed but not typed)
- Validates 10-digit US numbers
- Shows formatted value and E.164 output

**Usage**:
```tsx
<PhoneInput
  value={phoneNumber}
  onChange={(value) => setPhoneNumber(value)}
  label="Phone Number"
  required={false}
/>
```

### Notification Service
**Location**: `src/services/notificationService.ts`

**New Methods**:
```typescript
// Order approved notification
notifyOrderApproved(userId: string, orderId: string, talentName: string)

// Order completed notification  
notifyOrderDelivered(userId: string, orderId: string, talentName: string)

// SMS sender (checks settings & user phone)
sendSMSIfEnabled(notificationType: string, userId: string, orderId: string, variables: Record<string, string>)
```

### Integration Points

**Order Approved**: `src/components/TalentDashboard.tsx`
```typescript
handleApproveOrder(orderId) {
  // ... update order status ...
  
  await notificationService.notifyOrderApproved(
    order.user_id,
    orderId,
    talentName
  );
}
```

**Order Completed**: `src/components/TalentDashboard.tsx`
```typescript
handleMarkComplete(orderId) {
  // ... upload video & update status ...
  
  await notificationService.notifyOrderDelivered(
    order.user_id,
    orderId,
    talentName
  );
}
```

## Link Shortening

All links in SMS are automatically shortened using Twilio:
- ✅ Original: `https://shoutout.us/dashboard?tab=orders`
- ✅ Shortened: `https://link.shoutout.us/abc123`
- ✅ Saves ~40 characters per SMS
- ✅ Branded domain for trust

## Testing

### Test User Signup with Phone
1. Go to `/signup`
2. Enter phone: `5551234567`
3. See formatted: `(555) 123-4567`
4. Submit → Check database: `+15551234567`

### Test Order Approved SMS
1. Admin creates corporate order for user with phone
2. Talent approves order
3. Check Supabase logs: `send-sms` Edge Function
4. User receives SMS with talent name and link

### Test Order Completed SMS
1. Talent uploads video and marks complete
2. Check Supabase logs: `send-sms` Edge Function
3. User receives SMS with link to watch video

## Admin Configuration

### Enable/Disable SMS
1. Go to Admin → Notifications
2. Find "Order Approved (User)" or "Order Completed (User)"
3. Toggle SMS switch on/off
4. Changes take effect immediately

### Edit Templates
1. Click "Edit Template" on any notification
2. Modify text (use `{{variables}}` for dynamic content)
3. See live preview with sample data
4. Save → New template used for all future SMS

### Monitor Usage
- Check Supabase Edge Functions logs
- Search for: `send-sms` function calls
- See: Success/failure, phone numbers, message content

## Privacy & Compliance

- ✅ Phone numbers are optional
- ✅ Users opt-in by providing number
- ✅ Clear messaging about SMS notifications
- ✅ SMS only sent for order updates (transactional)
- ✅ Admins can disable SMS anytime
- ✅ No marketing/promotional SMS

## Troubleshooting

### User not receiving SMS
1. Check user has phone_number in database
2. Check notification settings: `sms_enabled = true`
3. Check Supabase Edge Function logs for errors
4. Verify Twilio credentials in Supabase secrets

### SMS template not updating
1. Check notification_settings table
2. Verify admin has permission to edit
3. Check for SQL errors in update query
4. Refresh admin panel

### Phone number not saving on signup
1. Check AuthContext signUp() includes phoneNumber param
2. Check supabase.auth.signUp() options.data
3. Check users table has phone_number column
4. Check RLS policies allow insert

## Future Enhancements

Potential features to add:
- [ ] SMS for order placed (immediate confirmation)
- [ ] SMS reminders for talent deadlines
- [ ] SMS for refunds/cancellations
- [ ] User preference to opt-out of SMS
- [ ] International phone number support
- [ ] SMS rate limiting / throttling

---

**Last Updated**: November 7, 2025
**Status**: ✅ Production Ready

