# ✅ Plaid → Moov Integration Test Checklist

## 🔍 Integration Flow Verification

### **Flow Overview:**
1. **Talent creates Moov account** (KYC data submitted)
2. **Talent clicks "Connect Bank Account"** (opens Plaid Link)
3. **Plaid Link Token created** (Edge Function: `plaid-create-link-token`)
4. **Talent selects bank & logs in** (Plaid UI)
5. **Plaid returns public_token** (temporary token)
6. **App calls linking function** (Edge Function: `moov-plaid-link-account`)
7. **Plaid public_token → access_token** (server-side exchange)
8. **Plaid creates processor_token** (for Moov)
9. **Moov links bank account** (using processor_token)
10. **Bank account appears in Payouts tab** ✅

---

## 📋 Pre-Test Checklist

### **1. Environment Variables (Supabase Edge Functions)**

Verify these secrets are set for **both** functions:

#### **`plaid-create-link-token`:**
- ✅ `PLAID_CLIENT_ID` = `690a0403d4073e001d79578f` (Production)
- ✅ `PLAID_SECRET` = `[your production secret]`
- ✅ `SUPABASE_URL` = `https://utafetamgwukkbrlezev.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = `[your service role key]`

#### **`moov-plaid-link-account`:**
- ✅ `PLAID_CLIENT_ID` = `690a0403d4073e001d79578f` (Production)
- ✅ `PLAID_SECRET` = `[your production secret]`
- ✅ `MOOV_PUBLIC_KEY` = `[your production Moov public key]`
- ✅ `MOOV_SECRET_KEY` = `[your production Moov secret key]`

### **2. Edge Functions Deployed**
- ✅ `plaid-create-link-token` (with phone validation fix)
- ✅ `moov-plaid-link-account` (using Production environment)

### **3. Database Schema**
- ✅ `talent_profiles.moov_account_id` column exists

---

## 🧪 Test Steps

### **Test 1: Create Moov Account**

1. Log in as a talent user
2. Go to **Dashboard → Payouts** tab
3. Click **"Start Onboarding"** button
4. Fill out the Moov KYC form:
   - First Name
   - Last Name
   - Email (pre-filled)
   - Phone (pre-filled, 10 digits)
   - Address
   - City
   - State (2-letter code)
   - Postal Code (5 digits)
   - Birth Date (MM, DD, YYYY)
   - SSN (9 digits)
5. Click **"Create Account"**

**Expected Result:**
- ✅ Success message: "Account created! ID: [moov_account_id]"
- ✅ `talent_profiles.moov_account_id` is saved in database
- ✅ Button changes to **"Check verification"**

**Console Check:**
```
Moov account details: { accountID: 'b469c6b5-6cb9-4c4a-947b-2daf653ae2fd', ... }
```

---

### **Test 2: Create Plaid Link Token**

1. Still on **Payouts** tab
2. Click **"Connect Bank Account"** (or **"Link Bank Account"**)
3. Wait for Plaid Link popup to open

**Expected Result:**
- ✅ Toast: "Preparing Plaid Link..."
- ✅ Plaid Link popup opens (white popup with bank search)
- ✅ No "Something went wrong" error
- ✅ No "Unable to parse phone number: TOO_SHORT" error

**Console Check (Supabase Edge Function Logs):**
```
Creating Plaid link token with user data: {
  userId: 'Bee53913-7a65-4b03-8ab4-99020b647525',
  email: 'jb@apollo.inc',
  phone: '9405354166',
  name: 'Jonathan Bodnar'
}
```

**If phone is invalid:**
```
Creating Plaid link token with user data: {
  userId: '...',
  email: 'user@example.com',
  phone: 'none',  // ← Phone omitted if invalid
  name: 'John Doe'
}
```

---

### **Test 3: Select Bank in Plaid**

1. In the Plaid popup, search for a bank (e.g., "Chase")
2. Select **"Chase"** (or use Plaid's test bank in Sandbox)
3. Enter test credentials:
   - Username: `user_good`
   - Password: `pass_good`
4. If prompted, verify with MFA code: `1234`
5. Select a **Checking** account
6. Click **"Continue"**

**Expected Result:**
- ✅ Plaid popup closes
- ✅ Toast: "Linking your bank to Moov..."
- ✅ Toast: "Bank linked successfully!"

**Console Check:**
```
Plaid/Moov link success: { 
  bankAccountID: '...',
  holderName: 'Jonathan Bodnar',
  bankName: 'Chase',
  routingNumber: '011401533',
  lastFourAccountNumber: '6789',
  status: 'new' // or 'verified'
}
```

---

### **Test 4: Verify Bank Account Appears**

1. Stay on **Payouts** tab (it should auto-refresh)
2. Look for **"Bank Information"** card

**Expected Result:**
- ✅ Bank info card shows:
  - Account Holder: `Jonathan Bodnar`
  - Bank: `Chase`
  - Account: `****6789`
  - Routing: `011401533`
  - Status: **Verified** ✅ or **Pending** ⏳

**Console Check (Supabase Query):**
```
Moov bank account details: {
  bankAccountID: '...',
  holderName: 'Jonathan Bodnar',
  bankName: 'Chase',
  lastFourAccountNumber: '6789',
  routingNumber: '011401533',
  status: 'verified'
}
```

---

### **Test 5: Check Moov Dashboard (Optional)**

1. Log in to https://dashboard.moov.io/
2. Navigate to **Accounts**
3. Find the account with ID: `[moov_account_id]`
4. Click on the account
5. Go to **Bank Accounts** tab

**Expected Result:**
- ✅ Bank account is listed
- ✅ Status: **Verified** or **Pending**
- ✅ Bank name matches (e.g., "Chase")
- ✅ Last 4 digits match

---

## 🐛 Troubleshooting

### **Error: "Something went wrong - Internal error occurred"**

**Cause:** Phone number validation issue in `plaid-create-link-token`

**Fix:**
1. Verify Edge Function is deployed with phone validation fix
2. Check Edge Function logs in Supabase Dashboard
3. Look for: `Unable to parse phone number: TOO_SHORT`
4. If present, redeploy the Edge Function with updated code

---

### **Error: "Unable to parse phone number: TOO_SHORT"**

**Cause:** Phone number in `users.phone` is not exactly 10 digits

**Fix:**
1. Check the user's phone in database:
   ```sql
   SELECT phone FROM users WHERE id = '[user_id]';
   ```
2. If phone is missing/invalid:
   - Edge Function should omit phone and still work
   - Plaid Link will open without phone pre-fill
3. If Edge Function is still failing, it's not deployed correctly

---

### **Error: "Failed to link bank account"**

**Cause:** Issue with `moov-plaid-link-account` Edge Function

**Check Console:**
```
Plaid Link Error: {
  error: "INVALID_CREDENTIALS" // or other Plaid error
}
```

**Common Causes:**
- Using Sandbox Plaid credentials in Production environment (or vice versa)
- Moov API keys are Sandbox instead of Production
- `moov_account_id` is invalid or doesn't exist

**Fix:**
1. Verify `moov-plaid-link-account` uses `PlaidEnvironments.production`
2. Verify Moov keys are Production keys
3. Check Moov account exists: `SELECT moov_account_id FROM talent_profiles WHERE user_id = '[user_id]'`

---

### **Error: "Please create your Moov account before linking your bank"**

**Cause:** `talent_profiles.moov_account_id` is `null`

**Fix:**
1. Talent needs to complete Moov KYC onboarding first
2. Click **"Start Onboarding"** button
3. Fill out the Moov form and submit
4. Then retry linking bank account

---

### **Bank Account Not Showing After Linking**

**Cause:** `fetchPayoutData()` not refreshing after successful link

**Fix:**
1. Hard refresh the page (`Cmd+Shift+R`)
2. Check `moov-list-bank-accounts` Edge Function logs
3. Verify it's returning bank accounts:
   ```javascript
   const response = await moov.bankAccounts.list({accountID:moovAccountId})
   ```

---

## ✅ Success Criteria

- ✅ Plaid Link opens without errors
- ✅ Phone number validation doesn't break Plaid
- ✅ Talent can select and authenticate with their bank
- ✅ Bank account is successfully linked to Moov
- ✅ Bank details appear in Payouts tab
- ✅ No console errors related to Plaid/Moov
- ✅ Edge Function logs show successful responses

---

## 📊 Data Flow Diagram

```
Talent Dashboard (Payouts Tab)
         ↓
   [Connect Bank Account Button]
         ↓
   Edge Function: plaid-create-link-token
   - Fetches user data (email, phone, full_name)
   - Validates phone (10 digits or omit)
   - Creates Plaid Link token
         ↓
   Plaid Link UI Opens
   - Talent selects bank
   - Logs in
   - Selects account
         ↓
   onSuccess(public_token, metadata)
         ↓
   Edge Function: moov-plaid-link-account
   - Exchanges public_token → access_token (Plaid)
   - Creates processor_token (Plaid for Moov)
   - Links bank to Moov account (Moov API)
         ↓
   Moov Account Updated
   - Bank account added
   - Status: 'new' or 'verified'
         ↓
   Frontend Refreshes
   - fetchPayoutData() called
   - Bank info displayed in UI
         ↓
   ✅ Bank Account Connected!
```

---

## 🔐 Security Notes

1. **Public Token:** Short-lived, single-use token from Plaid (frontend)
2. **Access Token:** Long-lived token stored server-side (Edge Function only)
3. **Processor Token:** Moov-specific token for linking (Edge Function only)
4. **Never expose:** access_token or processor_token to the frontend
5. **Edge Functions:** Run server-side with secure environment variables

---

## 📝 Post-Test Actions

After successful test:
- [ ] Document any issues encountered
- [ ] Verify bank account can be used for payouts
- [ ] Test with multiple banks (Chase, Bank of America, Wells Fargo)
- [ ] Test with both Checking and Savings accounts
- [ ] Monitor Edge Function logs for errors
- [ ] Check Moov Dashboard for successful links

---

**Integration is working if all tests pass!** ✅🎉

