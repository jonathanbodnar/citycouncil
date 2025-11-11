# Phone Number Formatting Guide

## 📱 Format Standard: E.164

All phone numbers in ShoutOut are stored and transmitted in **E.164 format**: `+1XXXXXXXXXX`

Example: `+19495551234`

---

## ✅ Current Implementation Status

### **User Registration (SignupPage.tsx)**
- ✅ Uses `PhoneInput` component
- ✅ Automatically formats to E.164 (`+1XXXXXXXXXX`)
- ✅ Saves to `users.phone` in E.164 format
- ✅ **Fixed**: Now properly saves phone to database during signup

### **Talent Onboarding (TalentOnboardingPage.tsx)**
- ✅ Formats phone to E.164 before saving
- ✅ Line 447: `const formattedPhone = accountData.phone ? '+1${accountData.phone.replace(/\D/g, '')}' : null;`
- ✅ Saves to `users.phone` in E.164 format

### **Talent Management (TalentManagement.tsx)**
- ✅ Admin can edit talent phone numbers
- ✅ Line 352: `userUpdateData.phone = '+1${cleaned}';`
- ✅ Saves to `users.phone` in E.164 format

### **MFA Enrollment (MFAEnrollmentDual.tsx)**
- ✅ Formats phone to E.164 for Supabase MFA
- ✅ Line 118: `const formattedPhone = '+1${phoneNumber.replace(/\D/g, '')}';`
- ✅ Saves to `users.phone` after successful enrollment

### **SMS Sending (send-sms Edge Function)**
- ✅ Accepts E.164 format phone numbers
- ✅ Line 36: Fallback formatting if `+` is missing
- ✅ Sends to Twilio in E.164 format

### **Notification Service (notificationService.ts)**
- ✅ Fetches `user.phone` from database (E.164 format)
- ✅ Passes to `send-sms` Edge Function as-is
- ✅ Twilio receives correct E.164 format

---

## 🔄 Data Flow

```
User Enters Phone
       ↓
PhoneInput Component (formats to E.164)
       ↓
Database (users.phone) stores "+1XXXXXXXXXX"
       ↓
notificationService fetches user.phone
       ↓
send-sms Edge Function (validates E.164)
       ↓
Twilio API (receives "+1XXXXXXXXXX") ✅
```

---

## 📊 Database Schema

### `users` table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT, -- E.164 format: +1XXXXXXXXXX
  full_name TEXT,
  user_type user_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎨 Display vs Storage

### Storage (Database)
Always E.164: `+19495551234`

### Display (UI)
Formatted for readability: `(949) 555-1234`

**Conversion handled by:**
- `PhoneInput` component (automatic)
- `TalentDashboard.tsx` line 130-133 (manual formatting for display)

---

## 🧪 Testing Phone Numbers

### Valid US Phone Numbers (for testing)
- `+14155552671` - Twilio test number (always succeeds)
- `+14155552672` - Twilio test number (always fails, for error testing)
- `+19495551234` - Example valid format

### Invalid Formats (will be auto-corrected)
- `9495551234` → `+19495551234` ✅
- `(949) 555-1234` → `+19495551234` ✅
- `1-949-555-1234` → `+19495551234` ✅

---

## 🔍 Debugging Phone Issues

### 1. Check Database
```sql
SELECT id, email, phone FROM users WHERE email = 'user@example.com';
```

Expected: `phone = '+19495551234'` (with `+1` prefix)

### 2. Check Notification Logs
In `notificationService.ts`:
```typescript
logger.log('📱 Sending SMS to:', maskedPhone); // Should show +194****1234
```

### 3. Check Edge Function Logs
In Supabase Edge Function logs for `send-sms`:
```
Sending SMS: { to: '+19495551234', ... }
```

### 4. Check Twilio Logs
In Twilio Console → Monitor → Logs:
- `To` field should be `+19495551234`
- Status should be `delivered` or `sent`

---

## ⚠️ Common Issues

### Issue: User SMS not working
**Cause:** Phone number not saved to database during registration (fixed!)
**Solution:** Phone now properly saved in `AuthContext.signUp()` line 165

### Issue: SMS sent but not received
**Possible Causes:**
1. Phone number invalid or not E.164 format
2. Twilio trial account (only verified numbers can receive)
3. Carrier blocking short code messages
4. User's phone turned off or no signal

**Debug:**
```sql
-- Check if phone exists and is formatted correctly
SELECT email, phone FROM users WHERE id = 'USER_ID';

-- Should return: phone = '+19495551234'
```

### Issue: Phone shows as "Not provided" in profile
**Cause:** User registered before the fix was deployed
**Solution:** User needs to contact support or re-register

---

## 🚀 Best Practices

1. **Always use E.164 format** for storage (`+1XXXXXXXXXX`)
2. **Format for display** only in UI components
3. **Validate on input** using `PhoneInput` component
4. **Log masked numbers** in production (`+194****1234`)
5. **Test with Twilio test numbers** before production

---

## 📝 Related Files

- `src/components/PhoneInput.tsx` - E.164 formatting component
- `src/context/AuthContext.tsx` - User registration (saves phone)
- `src/services/notificationService.ts` - SMS notification logic
- `supabase/functions/send-sms/index.ts` - Twilio integration
- `src/components/UserDashboard.tsx` - Phone display in profile
- `src/components/TalentDashboard.tsx` - Phone display for talent
- `src/pages/TalentOnboardingPage.tsx` - Talent phone setup

---

## ✅ Summary

**Phone numbers are correctly formatted!** 

- ✅ Stored in E.164 format (`+1XXXXXXXXXX`)
- ✅ PhoneInput component handles formatting automatically
- ✅ Edge Function validates and formats if needed
- ✅ Twilio receives correct E.164 format
- ✅ All users (new registrations) will have properly formatted phones
- ✅ SMS notifications will work for new users

**The only issue was that phone numbers weren't being saved to the database during registration, which has been fixed!**

