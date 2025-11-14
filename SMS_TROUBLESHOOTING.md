# SMS Campaign Failure Troubleshooting

## 🔍 Diagnosis Steps

Based on the screenshot showing "Beta Users (from landing page) - -1" and failed send:

### Most Likely Issues:

#### 1. **Database Not Set Up** ❌
The `-1` recipient count suggests the database functions aren't working properly.

**Fix:**
```sql
-- Run these scripts IN ORDER:
1. database/create_beta_signups_table.sql
2. database/fix_sms_user_phone.sql (if not already run)
```

**Verify:**
```sql
-- Should return the count:
SELECT COUNT(*) FROM beta_signups;
SELECT * FROM get_users_by_segment('beta');
```

---

#### 2. **Edge Function Not Deployed** ❌
The send-mass-sms function needs to be deployed with the new USER_SMS_PHONE_NUMBER.

**Fix:**
1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
2. Find `send-mass-sms` function
3. Click "Edit"
4. Copy code from `supabase/functions/send-mass-sms/index.ts`
5. Click "Deploy"

---

#### 3. **Missing Environment Variables** ❌
The new phone number env var needs to be set.

**Fix:**
1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/settings/functions
2. Scroll to "Edge Functions Secrets"
3. Add:
   - Name: `USER_SMS_PHONE_NUMBER`
   - Value: `+16592185163`
4. Click "Add secret"

---

#### 4. **RLS Policies** ❌
Admin user needs permission to invoke the function.

**Check:**
```sql
-- Verify admin user type:
SELECT id, email, user_type 
FROM users 
WHERE email = 'your_admin_email@example.com';
```

Should show `user_type = 'admin'`

---

## 🔧 Quick Fix Script

Run this to check everything:

```sql
-- Run: database/diagnose_sms_failure.sql
```

This will show:
- ✅ If beta_signups table exists
- ✅ How many signups you have
- ✅ If campaign was created
- ✅ What error occurred
- ✅ If recipients were found

---

## 🎯 Most Common Issue

**The `-1` in "Beta Users - -1" means:**
- The `get_users_by_segment('beta')` function is returning an error
- Most likely: **beta_signups table doesn't exist yet**

**Solution:**
```bash
# In Supabase SQL Editor, run:
database/create_beta_signups_table.sql
```

Then refresh the admin page and try again!

---

## 📋 Checklist

Before sending SMS campaigns:

- [ ] Run `create_beta_signups_table.sql`
- [ ] Run `fix_sms_user_phone.sql`
- [ ] Deploy `send-mass-sms` Edge Function
- [ ] Add `USER_SMS_PHONE_NUMBER` env var
- [ ] Test with 1 recipient first
- [ ] Check Twilio logs for delivery

---

## 🔍 Debug Commands

```sql
-- 1. Check table exists
SELECT tablename FROM pg_tables WHERE tablename = 'beta_signups';

-- 2. Check function exists
SELECT proname FROM pg_proc WHERE proname = 'get_users_by_segment';

-- 3. Test function manually
SELECT * FROM get_users_by_segment('beta');

-- 4. Check latest campaign
SELECT * FROM sms_campaigns ORDER BY created_at DESC LIMIT 1;

-- 5. Check campaign logs
SELECT * FROM sms_logs ORDER BY sent_at DESC LIMIT 10;
```

---

## 🚨 If Still Not Working

1. **Check Supabase Logs:**
   - https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions

2. **Check Twilio Logs:**
   - https://console.twilio.com/us1/monitor/logs/sms

3. **Check Browser Console:**
   - Look for errors when clicking "Send SMS Campaign"
   - Check Network tab for failed requests

4. **Run Diagnostic:**
   ```sql
   -- This will show exactly what's wrong:
   SELECT * FROM diagnose_sms_failure.sql;
   ```

---

## ✅ Success Indicators

When working correctly, you should see:
- ✅ "Beta Users (from landing page) - X" (where X > 0)
- ✅ "Send SMS Campaign" button enabled
- ✅ Campaign appears in history with status "completed"
- ✅ SMS received on test phone

---

## 📱 Test Flow

1. Add test number to beta_signups:
```sql
INSERT INTO beta_signups (phone_number, source)
VALUES ('+1YOUR_PHONE_HERE', 'test');
```

2. Refresh admin page
3. Create campaign with message "Test"
4. Send to "Beta Users"
5. Check phone for SMS
6. Check campaign history for success

---

## 🆘 Emergency Contacts

If completely stuck:
- **Supabase Support**: https://supabase.com/support
- **Twilio Support**: https://support.twilio.com
- **Check GitHub Issues**: Look for similar problems

---

## 📚 Related Files

- `database/create_beta_signups_table.sql` - Initial setup
- `database/fix_sms_user_phone.sql` - Phone column fix
- `supabase/functions/send-mass-sms/index.ts` - Edge function
- `SEPARATE_SMS_NUMBERS.md` - Two-number setup guide

