# MFA Troubleshooting Guide

## Issue: MFA Not Asking for Code on Login

### Common Causes & Solutions

#### 1. **MFA Not Actually Enrolled (Most Common)**

**Symptoms:**
- Enrolled MFA in dashboard
- Logged out and logged back in
- No MFA prompt appears

**Check:**
1. Open browser console (F12)
2. Look for these logs during login:
   ```
   AAL Check: { aal: { currentLevel: 'aal1', nextLevel: 'aal1' } }
   MFA not required - current level: aal1 next level: aal1
   ```

**Problem:** If `nextLevel` is `aal1` (not `aal2`), MFA isn't actually enrolled.

**Solution:**
1. Go to Dashboard → Profile → Security Settings
2. Check MFA status
3. If it says "Disabled", re-enroll:
   - Click "Enable Two-Factor Authentication"
   - Choose your method (Authenticator or SMS)
   - **Complete the verification step** (this is critical!)
   - Look for "MFA enabled successfully!" message

**Root Cause:** The enrollment wasn't completed. You must enter the verification code to finalize enrollment.

---

#### 2. **Factor Not in "Verified" Status**

**Symptoms:**
- Enrollment seemed to complete
- Console shows factors exist but MFA not triggered

**Check Console Logs:**
```
Factors: {
  factors: {
    totp: [{ id: 'xxx', status: 'unverified' }]
  }
}
MFA required but no verified factors found
```

**Problem:** Factor exists but status is `unverified`, not `verified`.

**Solution:**
1. Re-enroll MFA completely:
   - Dashboard → Profile → Security Settings
   - If MFA shows as enabled, disable it first
   - Enable again and **complete verification step**

---

#### 3. **SMS MFA: Challenge Not Sent**

**Symptoms:**
- SMS MFA enrolled
- Login shows MFA screen
- No SMS received

**Check:**
- Console logs show: `"Sending SMS challenge..."`
- Error: `"Failed to send verification code"`

**Causes:**
a) **Twilio Not Configured Properly**
   - Check Supabase Dashboard → Auth → Config → SMS Provider
   - Verify Twilio credentials are correct
   - Test by sending a test SMS from Twilio console

b) **Phone Number Format Wrong**
   - Must be E.164 format: `+1XXXXXXXXXX`
   - Check in Supabase Auth dashboard what number was enrolled

c) **Twilio Trial Account Limitations**
   - Trial accounts can only send to verified numbers
   - Verify the phone number in Twilio console first

**Solution:**
1. Check Twilio Console → Messaging → Logs
2. Look for failed sends
3. If trial account, verify your phone number
4. If production, check balance and message logs

---

#### 4. **Multiple Browser Sessions**

**Symptoms:**
- MFA works sometimes, not others
- Inconsistent behavior

**Problem:** Old authenticated session still active in browser.

**Solution:**
1. Completely sign out
2. Clear browser cache/cookies for the site
3. Close all tabs
4. Open fresh browser window
5. Log in again

---

#### 5. **AAL Level Not Elevated**

**Symptoms:**
- Factors exist and verified
- Console shows: `currentLevel: 'aal1', nextLevel: 'aal1'`

**Problem:** Supabase isn't elevating AAL requirement.

**Check in Supabase Dashboard:**
1. Go to Authentication → Policies
2. Ensure no policies are bypassing MFA
3. Check if MFA enforcement is enabled globally

**Solution:**
- This is rare and usually indicates a Supabase configuration issue
- Contact Supabase support or check their status page

---

## Debugging Checklist

### Before Login:
- [ ] MFA is enabled in Supabase Dashboard (Auth → Config → MFA)
- [ ] For SMS: Twilio is configured with correct credentials
- [ ] User has completed MFA enrollment (got success message)
- [ ] User's MFA shows as "Enabled" in Security Settings

### During Login:
Open browser console and check for these logs:

1. **AAL Check:**
   ```javascript
   AAL Check: { aal: { currentLevel: 'aal1', nextLevel: 'aal2' } }
   ```
   ✅ `nextLevel: 'aal2'` means MFA is required
   ❌ `nextLevel: 'aal1'` means MFA not enrolled

2. **Factors List:**
   ```javascript
   Factors: {
     factors: {
       totp: [{ id: 'xxx', status: 'verified', friendly_name: 'Authenticator App' }]
     }
   }
   ```
   ✅ `status: 'verified'` is required
   ❌ `status: 'unverified'` won't work

3. **Factor Found:**
   ```javascript
   Found verified TOTP factor: xxx-xxx-xxx
   ```
   or
   ```javascript
   Found verified Phone factor: xxx-xxx-xxx
   ```

4. **For SMS:**
   ```javascript
   Sending SMS challenge...
   Verification code sent to your phone!
   ```

### What Should Happen:
1. Enter email/password → Submit
2. Console logs AAL check (`aal2` required)
3. Console logs factors (find verified one)
4. For SMS: Sends challenge, shows toast
5. **MFA Verification screen appears**
6. Enter 6-digit code
7. Login completes

---

## Quick Test Procedure

### Test MFA Enrollment:
```
1. Login as talent
2. Dashboard → Profile → Security Settings
3. Status should show "Enabled" with green badge
4. Should list your enrolled method(s)
5. Each method should show as "verified"
```

### Test MFA Login:
```
1. Completely sign out
2. Open browser console (F12)
3. Go to login page
4. Enter credentials
5. Click Sign In
6. Watch console logs (should see AAL check, factors, etc.)
7. MFA screen should appear
8. For SMS: Should receive text message
9. Enter code
10. Should login successfully
```

---

## Common Console Warnings/Errors

### ⚠️ "MFA required but no verified factors found"
**Meaning:** AAL says MFA is needed, but no verified factors exist.

**Fix:**
- Re-enroll MFA completely
- Make sure to complete verification step
- Check MFA Settings to confirm enrollment

### ❌ "Failed to send verification code"
**Meaning:** SMS challenge couldn't be sent.

**Fix:**
- Check Twilio configuration
- Verify phone number (if trial account)
- Check Twilio logs for errors
- Ensure Messaging Service is active

### ℹ️ "MFA not required - current level: aal1 next level: aal1"
**Meaning:** MFA is not enrolled for this user.

**Fix:**
- Enroll MFA via Dashboard → Profile → Security Settings
- Complete entire enrollment flow
- Verify "MFA enabled successfully!" message appears

---

## Still Not Working?

### Check Supabase Dashboard:
1. Go to Authentication → Users
2. Find your test user (jb@apollo.inc)
3. Check their "Factors" column
4. Should show enrolled MFA factors

### Manual Test via Supabase:
1. Go to Authentication → Logs
2. Filter by user email
3. Look for MFA-related events
4. Check for errors or warnings

### Contact Support:
If all else fails, collect:
- Console logs (full output)
- Screenshots of MFA Settings page
- Screenshot of Supabase User factors
- Description of exact steps taken

---

## Expected Console Output (Successful MFA Login)

```javascript
// Step 1: Login submitted
Attempting to sign in with: jb@apollo.inc
Sign in result: { user: {...}, session: {...} }

// Step 2: Check AAL
AAL Check: { 
  aal: { 
    currentLevel: 'aal1', 
    nextLevel: 'aal2',
    currentAuthenticationMethods: [{ method: 'password', timestamp: 1234567890 }]
  } 
}

// Step 3: MFA Required
MFA is required - fetching factors...

// Step 4: List Factors
Factors: { 
  factors: { 
    totp: [
      { 
        id: 'abc-123-def', 
        status: 'verified',
        friendly_name: 'Authenticator App',
        created_at: '2025-11-05...'
      }
    ],
    phone: []
  } 
}

// Step 5: Factor Selected
Found verified TOTP factor: abc-123-def

// Step 6: MFA Screen Shows
// (User enters code)

// Step 7: Verification
MFA verification successful!
Welcome back! Redirecting...
```

---

**Most Common Issue:** Not completing the verification step during enrollment. Always wait for the "MFA enabled successfully!" message!

