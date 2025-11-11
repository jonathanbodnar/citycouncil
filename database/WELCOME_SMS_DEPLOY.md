# Welcome SMS on Onboarding - Deployment Guide

## Overview
Adds an automatic welcome SMS that is sent to talent when they complete onboarding. This text:
- Congratulates them on finishing their profile
- Includes their ShoutOut profile URL to add to social bios
- Reminds them to save the number for order notifications

## What Gets Sent

```
🎉 Congrats on finishing your ShoutOut profile, add ShoutOut.us/[username] to your social bios! Also we'll text you here with new orders and updates so please save this number.
```

---

## Deployment Steps

### Step 1: Run the SQL Script

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create **New Query**
3. Copy/paste contents of `database/add_welcome_sms_on_onboarding.sql`
4. Click **Run**

### Step 2: Verify Installation

Expected output:
```
✅ Welcome SMS notification added to onboarding trigger!
📱 Talent will now receive:
   1. Welcome SMS with profile URL and save number reminder
   2. Demo order SMS notification (if enabled)
```

---

## How It Works

### Trigger Flow:

1. **Talent completes onboarding** (`onboarding_completed` changes to `true`)
2. **Trigger fires** → `create_demo_order_for_talent()`
3. **Welcome SMS sent FIRST** ← NEW
   - Message: Congrats + profile URL + save number reminder
   - Sent via `send-sms` Edge Function
   - Logs success/failure
4. **Demo order created** (if not excluded talent)
5. **Demo order SMS sent** (if SMS enabled)

### Message Details:

**Welcome SMS:**
- **When:** Immediately when onboarding completes
- **To:** Talent's phone number from `users.phone`
- **Content:** 
  - Congratulations message
  - Profile URL: `ShoutOut.us/[username]`
  - Reminder to save the number

**Demo Order SMS:**
- **When:** After demo order is created (if applicable)
- **To:** Same talent phone number
- **Content:** New demo order notification with dashboard link

---

## Prerequisites

✅ **Required:**
- `send-sms` Edge Function deployed and working
- Twilio credentials configured
- Database config variables set (`app.supabase_url`, `app.supabase_anon_key`)
- `pg_net` extension enabled

To verify prerequisites:
```sql
-- Check pg_net extension
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Check database config
SELECT current_setting('app.supabase_url', true) as supabase_url,
       current_setting('app.supabase_anon_key', true) as anon_key;
```

---

## Testing

### Test with Existing Talent:

```sql
-- Simulate onboarding completion for a test talent
UPDATE talent_profiles
SET onboarding_completed = false
WHERE username = 'your-test-username';

-- Then complete onboarding (triggers welcome SMS)
UPDATE talent_profiles
SET onboarding_completed = true
WHERE username = 'your-test-username';
```

### Verify SMS Sent:

- Check Twilio dashboard for sent messages
- Check Supabase logs for `send-sms` function calls
- Verify talent receives text on their phone

---

## Error Handling

The trigger includes robust error handling:

- **No phone number:** Logs warning, continues with demo order creation
- **SMS send fails:** Logs error, doesn't fail trigger
- **Demo order fails:** Independent of welcome SMS

### Viewing Logs:

```sql
-- Recent function logs (if using Supabase logging)
SELECT * FROM postgres_logs
WHERE query LIKE '%create_demo_order_for_talent%'
ORDER BY timestamp DESC
LIMIT 10;
```

---

## Rollback (If Needed)

To revert to the old trigger without welcome SMS:

```sql
-- Restore original trigger (demo order only, no welcome SMS)
-- Re-run: database/fix_demo_trigger_final.sql
```

---

## Message Customization

To change the welcome message, edit line in the function:

```sql
welcome_message := '🎉 Congrats on finishing your ShoutOut profile, add ' || profile_url || ' to your social bios! Also we''ll text you here with new orders and updates so please save this number.';
```

Then re-run the script to update.

---

## FAQs

**Q: Will existing talent get this message?**  
A: No, only talent who complete onboarding AFTER this is deployed.

**Q: What if talent doesn't have a phone number?**  
A: A warning is logged, but onboarding still completes. No SMS sent.

**Q: Can I disable this for specific talent?**  
A: Yes, add them to the `excluded_talent_ids` array in the function.

**Q: Does this affect demo order creation?**  
A: No, welcome SMS is sent regardless. Demo order creation is independent.

**Q: What if the SMS fails to send?**  
A: The error is logged but doesn't block onboarding. Talent can still use the platform.

---

## Success Criteria

✅ **Deployment Successful If:**
1. SQL script runs without errors
2. Test talent receives welcome SMS after onboarding
3. SMS includes correct profile URL
4. Demo order still created (if applicable)
5. No blocking errors in Supabase logs

---

## Next Steps

After deployment:
1. Test with a new talent onboarding
2. Verify SMS delivery in Twilio dashboard
3. Check Supabase function logs
4. Monitor for any errors
5. Collect feedback from talent about the message

---

## Support

If issues occur:
- Check Supabase function logs
- Verify Twilio credentials
- Ensure `pg_net` is enabled
- Check database config variables
- Review `send-sms` Edge Function logs

