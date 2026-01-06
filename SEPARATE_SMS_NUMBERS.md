# Separate SMS Numbers Configuration

## 📱 Three Different Twilio Numbers

Your ShoutOut platform uses **three separate Twilio phone numbers**:

### 1. Talent Communications
- **Number**: `+12175898027`
- **Env Variable**: `TWILIO_PHONE_NUMBER`
- **Used for**: 
  - Admin ↔️ Talent SMS (Comms Center "Talent SMS" tab)
  - Individual talent support messages
  - Talent notifications
- **Edge Function**: `send-sms`

### 2. User Communications
- **Number**: `+16592185163`
- **Env Variable**: `USER_SMS_PHONE_NUMBER`
- **Used for**:
  - Mass SMS campaigns to users (Comms Center "User SMS" tab)
  - User order notifications
  - Giveaway winner SMS
  - Marketing campaigns
- **Edge Function**: `send-sms`, `send-mass-sms`

### 3. OTP/Verification Codes
- **Number**: `+19863335069`
- **Env Variable**: `OTP_SMS_PHONE_NUMBER`
- **Used for**:
  - Login verification codes
  - Registration verification codes
  - Phone number verification
- **Edge Function**: `send-registration-otp`, `send-login-otp`

---

## 🔧 Setup Instructions

### Step 1: Add Environment Variable to Supabase

1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/settings/functions
2. Scroll to "Edge Functions Secrets"
3. Add new secret:
   - **Name**: `USER_SMS_PHONE_NUMBER`
   - **Value**: `+16592185163`
4. Click "Add secret"

### Step 2: Redeploy Edge Function

```bash
# The function code is already updated, just redeploy:
cd /Users/jonathanbodnar/ShoutOut
supabase functions deploy send-mass-sms --no-verify-jwt --project-ref utafetamgwukkbrlezev
```

Or deploy via Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
2. Find `send-mass-sms` function
3. Click "Edit" 
4. Copy updated code from `supabase/functions/send-mass-sms/index.ts`
5. Click "Deploy"

---

## ✅ What This Changes

| Feature | Before | After |
|---------|--------|-------|
| **Talent SMS** | Original number | ✅ Still uses original number |
| **User SMS Campaigns** | Original number | ✅ Now uses (659) 218-5163 |
| **Talent Notifications** | Original number | ✅ Still uses original number |
| **Order Updates** | Original number | ✅ Still uses original number |

---

## 🔒 Fallback Behavior

If `USER_SMS_PHONE_NUMBER` is not set:
- ✅ Automatically falls back to `TWILIO_PHONE_NUMBER`
- ✅ No errors or breaking changes
- ✅ Seamless degradation

---

## 📋 Environment Variables Summary

```bash
# Existing (unchanged)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_original_number  # For talent comms

# New (add this)
USER_SMS_PHONE_NUMBER=+16592185163  # For user campaigns
```

---

## 🧪 Testing

After deployment, test by:
1. Go to Admin > Comms Center > "User SMS" tab
2. Select "Beta Users" audience
3. Send a test message
4. Verify it comes from **(659) 218-5163**

---

## 🎯 Benefits

✅ **Brand Separation**: Different numbers for talent vs user communications  
✅ **Better Tracking**: Separate Twilio logs for campaign vs support messages  
✅ **Compliance**: Easier to manage opt-outs by audience type  
✅ **No Impact**: Talent communications remain unchanged  
✅ **Flexible**: Can switch back anytime by removing the env var

---

## 📞 Phone Number Details

- **Format**: `+16592185163` (E.164 format for Twilio)
- **Friendly Format**: `(659) 218-5163`
- **Type**: Messaging Service (more reliable for mass campaigns)
- **Messaging Service SID**: `MGb60f3d97893ce39f291eda0190287bd3`

---

## 🚨 Important

- **Always use E.164 format** in Supabase: `+16592185163`
- **Don't include** spaces, dashes, or parentheses
- **Test with a small audience** first before large campaigns
- **Monitor Twilio logs** for both numbers separately

