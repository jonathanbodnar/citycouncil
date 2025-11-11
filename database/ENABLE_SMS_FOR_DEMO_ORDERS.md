# Enable SMS for Demo Orders - Deployment Guide

## Overview
This guide enables SMS notifications when talent receive demo orders after onboarding.

## Prerequisites
- Supabase `pg_net` extension (for HTTP requests from database)
- `send-sms` Edge Function deployed
- Twilio credentials configured in Edge Function

## Deployment Steps

### 1. Enable pg_net Extension
Run in Supabase SQL Editor:

```sql
-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Set Database Configuration Variables
Run in Supabase SQL Editor (replace with your actual values):

```sql
-- Set Supabase URL (your project URL)
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';

-- Set Supabase Anon Key (your project anon key)
ALTER DATABASE postgres SET app.supabase_anon_key = 'YOUR_SUPABASE_ANON_KEY';
```

**To get your values:**
- URL: Supabase Dashboard → Settings → API → Project URL
- Anon Key: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

### 3. Enable SMS Notifications in Settings
Run `database/enable_sms_notifications.sql` in Supabase SQL Editor.

This creates `notification_settings` entries with SMS enabled for key events.

### 4. Update Demo Order Trigger
Run `database/fix_demo_trigger_final.sql` in Supabase SQL Editor.

This adds SMS sending logic to the demo order creation trigger.

### 5. Verify Configuration
Run in Supabase SQL Editor:

```sql
-- Check pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Check database settings
SELECT name, setting FROM pg_settings 
WHERE name IN ('app.supabase_url', 'app.supabase_anon_key');

-- Check notification settings
SELECT notification_type, sms_enabled, sms_template 
FROM notification_settings 
WHERE notification_type = 'talent_new_order';

-- Check demo order trigger exists
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_talent_onboarded';
```

## Testing

### Test SMS Flow
1. Complete onboarding for a new talent (not Nick Di Palo, Shawn Farash, or Gerald Morgan)
2. Check:
   - Demo order created: `SELECT * FROM orders WHERE order_type = 'demo' ORDER BY created_at DESC LIMIT 1;`
   - Notification created: `SELECT * FROM notifications WHERE type = 'order_placed' ORDER BY created_at DESC LIMIT 1;`
   - SMS sent: Check Twilio logs or `send-sms` Edge Function logs
   - Talent receives SMS on their phone

### Check Logs
- Supabase Dashboard → Edge Functions → `send-sms` → Logs
- Look for POST requests after talent onboarding

## How It Works

### Trigger Flow:
1. **Talent completes onboarding** (`talent_profiles.onboarding_completed` → `true`)
2. **`on_talent_onboarded` trigger fires**
3. **Creates demo order** (Michael Thompson ordering for $0.01)
4. **Creates in-app notification** (`notifications` table)
5. **Queries talent phone** from `users` table
6. **Checks if SMS enabled** in `notification_settings`
7. **Calls `send-sms` Edge Function** via HTTP (`pg_net.http_post`)
8. **Sends SMS via Twilio** (in Edge Function)

### SMS Message:
```
New demo ShoutOut order! Check your dashboard to fulfill it: https://shoutout.us/orders
```

## Troubleshooting

### SMS Not Sending

**1. Check pg_net is enabled:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```
If empty, run: `CREATE EXTENSION IF NOT EXISTS pg_net;`

**2. Check database config:**
```sql
SELECT name, setting FROM pg_settings 
WHERE name IN ('app.supabase_url', 'app.supabase_anon_key');
```
If empty, set them (see Step 2).

**3. Check notification settings:**
```sql
SELECT * FROM notification_settings WHERE notification_type = 'talent_new_order';
```
Ensure `sms_enabled = true`.

**4. Check talent has phone number:**
```sql
SELECT id, email, full_name, phone 
FROM users 
WHERE user_type = 'talent' 
ORDER BY created_at DESC LIMIT 5;
```

**5. Check Edge Function logs:**
- Supabase Dashboard → Edge Functions → `send-sms` → Logs
- Look for errors or missing requests

**6. Check trigger logs:**
```sql
-- Enable logging for trigger
SET client_min_messages = NOTICE;

-- Then trigger onboarding and watch for RAISE NOTICE messages
```

### Error: "extension pg_net does not exist"
Run: `CREATE EXTENSION IF NOT EXISTS pg_net;`

### Error: "unrecognized configuration parameter"
You need to set the database config variables (Step 2).

### Error: "could not find function net.http_post"
The `pg_net` extension is not enabled. Run Step 1.

## Security Notes

- The `app.supabase_anon_key` is stored in database config (accessible to database functions)
- This is safe because it's already a public key (used in frontend)
- SMS sending is rate-limited in the Edge Function
- Trigger has exception handling to prevent failure on SMS errors

## Summary

After following these steps, the complete flow will be:

✅ **Talent completes onboarding**  
✅ **Demo order auto-created**  
✅ **In-app notification added**  
✅ **SMS sent to talent's phone**  

The talent will receive both an in-app notification AND an SMS with a link to fulfill their demo order.

