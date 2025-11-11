# Magic Auth SMS Links + User Order SMS - Deployment Guide

## 🎯 What This Fixes

### Issues Resolved:
1. ✅ **Users not getting SMS** when they place orders
2. ✅ **SMS links showing `/orders`** instead of unique fulfillment URLs
3. ✅ **Talent having to login manually** when clicking SMS links

### New Features:
- **One-Click Authentication**: Talent clicks SMS link → auto-login → view order
- **User Order SMS**: Users get SMS confirmation when they place orders
- **Unique Fulfillment URLs**: All SMS now include order-specific links with auth tokens

---

## 📋 Deployment Steps

### Step 1: Update SMS Templates and Add User Notification

Run in Supabase SQL Editor:

```sql
-- File: database/fix_sms_urls_and_add_user_order_placed.sql
```

**This will:**
- Add `user_order_placed` notification type
- Update all SMS templates to use `{{order_link}}` variable
- Enable SMS for user order confirmations

**Verify:**
```sql
SELECT notification_type, sms_enabled, sms_template 
FROM notification_settings 
WHERE notification_type IN (
  'user_order_placed',
  'talent_new_order',
  'user_order_approved',
  'user_order_completed'
);
```

You should see 4 rows with `sms_enabled = true` and templates containing `{{order_link}}`.

---

### Step 2: Create Magic Auth Token System

Run in Supabase SQL Editor:

```sql
-- File: database/add_fulfillment_magic_tokens.sql
```

**This will:**
- Create `fulfillment_auth_tokens` table
- Auto-generate magic tokens for every new order
- Add indexes and RLS policies
- Create helper functions

**Verify:**
```sql
-- Check table exists
SELECT COUNT(*) FROM fulfillment_auth_tokens;

-- Check trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_order_created_generate_magic_token';

-- Test: Create a test order and see if token is generated
-- (or wait for next real order)
```

---

### Step 3: Test the System

#### Test 1: User Gets SMS When Placing Order
1. Place a test order as a user
2. Check if user receives SMS: `"✅ Your ShoutOut order from [Talent] is confirmed! ... {{order_link}}"`
3. Verify SMS includes a link

#### Test 2: Talent Gets SMS with Fulfillment Link
1. Same test order from above
2. Check if talent receives SMS: `"🎬 New ShoutOut order from [User]! ... Fulfill it now: {{order_link}}"`
3. Click the link in SMS (should look like: `https://shoutout.us/fulfill/TOKEN123?auth=MAGIC456`)

#### Test 3: One-Click Auto-Login
1. **Logout** from ShoutOut
2. Click the SMS link you received as talent
3. Should see: `"✨ Authenticated! Loading your order..."`
4. Should be redirected to `/welcome?order=ORDER_ID`
5. Should see the order details without manually logging in

#### Test 4: Backward Compatibility (Old Links)
1. Test an old fulfillment link without `?auth=` parameter
2. Should redirect to login (old behavior)
3. After login, should show the order

---

## 🔧 How It Works

### Magic Auth Flow:

```
1. Order Created
   ↓
2. Trigger auto_generate_magic_token()
   - Creates secure 256-bit token
   - Stores in fulfillment_auth_tokens table
   - Expires in 30 days
   ↓
3. SMS Sent to Talent
   - URL: /fulfill/FULFILLMENT_TOKEN?auth=MAGIC_TOKEN
   ↓
4. Talent Clicks Link (not logged in)
   ↓
5. OrderFulfillmentPage checks for ?auth= param
   ↓
6. Verifies magic token via magicAuthService
   ↓
7. Gets user email, signs in via Supabase OTP
   ↓
8. Marks token as 'used' (single-use)
   ↓
9. Redirects to /welcome?order=ID
   ✅ Talent is now logged in and viewing order
```

### SMS Template Variables:

All SMS templates now support:
- `{{first_name}}` - User's first name
- `{{talent_name}}` - Talent's name
- `{{user_name}}` - Customer's name
- `{{amount}}` - Order amount
- `{{hours}}` - Hours remaining (for deadlines)
- `{{order_link}}` - **Unique fulfillment URL with magic auth**

---

## 🛡️ Security Features

1. **Cryptographically Secure Tokens**
   - 32 bytes (256 bits) of random data
   - URL-safe base64 encoding
   - Unique per order

2. **Single-Use Tokens**
   - Marked as `used` after consumption
   - Cannot be reused for replay attacks

3. **Expiration**
   - Tokens expire after 30 days
   - Expired tokens cannot be used

4. **RLS Protection**
   - Only valid, unused tokens can be read
   - Service role required for insert/update

5. **Production-Safe Logging**
   - All console.* replaced with logger.*
   - No sensitive data exposed in production

---

## 📊 Database Schema

### `fulfillment_auth_tokens` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| order_id | UUID | References orders(id) |
| user_id | UUID | References users(id) |
| token | TEXT | Unique magic auth token |
| used | BOOLEAN | Single-use flag |
| expires_at | TIMESTAMPTZ | Expiration date (30 days) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| used_at | TIMESTAMPTZ | When token was consumed |

---

## 🚨 Troubleshooting

### User not getting SMS?
1. Check `notification_settings`:
   ```sql
   SELECT * FROM notification_settings WHERE notification_type = 'user_order_placed';
   ```
2. Verify user has `phone` in `users` table
3. Check `send-sms` Edge Function logs

### Talent not getting SMS?
1. Check `notification_settings`:
   ```sql
   SELECT * FROM notification_settings WHERE notification_type = 'talent_new_order';
   ```
2. Verify talent has `phone` in `users` table

### Magic auth not working?
1. Check if token was generated:
   ```sql
   SELECT * FROM fulfillment_auth_tokens WHERE order_id = 'ORDER_ID_HERE';
   ```
2. Check if token is expired or used:
   ```sql
   SELECT * FROM fulfillment_auth_tokens 
   WHERE token = 'TOKEN_HERE' 
   AND NOT used 
   AND expires_at > NOW();
   ```
3. Check browser console for errors (in development)

### SMS shows `{{order_link}}` literally?
- The SMS template replacement happens in `notificationService.sendSMSIfEnabled()`
- Check that `order.fulfillment_token` exists in the database
- Verify `magicAuthService.generateFulfillmentUrl()` is being called

---

## ✅ Success Criteria

After deployment, verify:

- [ ] Users get SMS when placing orders
- [ ] Talent gets SMS when receiving orders
- [ ] SMS includes clickable URLs (not `/orders`)
- [ ] Clicking SMS link auto-logs in talent
- [ ] Old fulfillment links still work
- [ ] Magic tokens are single-use
- [ ] No console logs in production (check browser console)

---

## 📝 Notes

- **Backward Compatible**: Old fulfillment links without `?auth=` still work
- **No Breaking Changes**: Existing flows unchanged
- **Performance**: Minimal overhead (one DB lookup per SMS)
- **Cost**: No additional SMS costs (same number of messages)

---

## 🎉 Expected Results

**Before:**
- ❌ User places order → No SMS
- ❌ Talent gets SMS → Generic `/orders` link
- ❌ Talent clicks SMS → Must login manually

**After:**
- ✅ User places order → SMS with order confirmation
- ✅ Talent gets SMS → Unique fulfillment link
- ✅ Talent clicks SMS → Auto-login → View order (one click!)

---

## 🔗 Related Files

- `src/services/notificationService.ts` - SMS template replacement, magic URL generation
- `src/services/magicAuthService.ts` - Magic link authentication logic
- `src/pages/OrderFulfillmentPage.tsx` - Auto-login implementation
- `database/fix_sms_urls_and_add_user_order_placed.sql` - SMS template updates
- `database/add_fulfillment_magic_tokens.sql` - Magic auth system

---

**Deploy Date:** 2025-11-11
**Status:** ✅ Ready for Testing

