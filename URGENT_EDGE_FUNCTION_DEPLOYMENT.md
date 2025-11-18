# 🚨 URGENT: Deploy W-9 Edge Function

## The Problem
The edge function `generate-w9-pdf` is either:
1. Not deployed yet, OR
2. Deployed with old code that doesn't have proper error messages

## ✅ Step-by-Step Fix

### Step 1: Check if Function Exists

1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
2. Look for `generate-w9-pdf` in the list

**If you DON'T see it:** Click "New Function" and create it
**If you DO see it:** Click on it to edit

---

### Step 2: Deploy the Function Code

#### Option A: Via Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions
2. Click **"Deploy new function"** (or edit existing)
3. **Function name**: `generate-w9-pdf`
4. Copy **ENTIRE** file from your local machine:
   - Path: `/Users/jonathanbodnar/ShoutOut/supabase/functions/generate-w9-pdf/index.ts`
   - Select ALL (Cmd+A)
   - Copy (Cmd+C)
5. Paste into Supabase editor
6. Click **"Deploy"**
7. Wait for deployment to complete (~30 seconds)

---

#### Option B: Via Supabase CLI (If you have it installed)

```bash
cd /Users/jonathanbodnar/ShoutOut
supabase functions deploy generate-w9-pdf
```

---

### Step 3: Verify Deployment

After deploying, check:

1. Function shows as **"Active"** or **"Deployed"** in dashboard
2. Function URL is: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/generate-w9-pdf`
3. Try submitting W-9 form again

---

### Step 4: Check Logs (If Still Failing)

1. Go to Supabase Dashboard → Edge Functions → `generate-w9-pdf`
2. Click **"Logs"** tab
3. Submit the W-9 form
4. Look at the logs for the actual error message
5. Share that error message with me

---

## What the Function Does

This function:
- ✅ Validates user authentication
- ✅ Validates all required W-9 fields
- ✅ Checks talent profile exists and belongs to user
- ✅ Prevents duplicate W-9 submissions
- ✅ Stores W-9 data (without SSN/EIN) in `w9_forms` table
- ✅ Generates HTML representation of W-9
- ✅ Returns success response

---

## Common Errors After Deployment

### Error: "Missing required fields: talentId"
**Cause**: User tried to submit before profile loaded
**Fix**: Refresh page and try again

### Error: "Talent profile not found or unauthorized"
**Cause**: User doesn't have a talent profile
**Fix**: User needs to complete talent onboarding first

### Error: "W-9 already exists for this talent"
**Cause**: W-9 already submitted
**Fix**: W-9 is complete, should skip to Step 2 (Moov)

### Error: "relation 'w9_forms' does not exist"
**Cause**: Database migration not applied
**Fix**: Run the SQL migration from `database/add_w9_and_payout_onboarding_safe.sql`

---

## After Successful Deployment

Once deployed:
1. ✅ Clear browser cache (Cmd+Shift+R)
2. ✅ Try submitting W-9 form
3. ✅ Check browser console for detailed logs
4. ✅ Form should submit successfully and advance to Step 2 (Moov)

---

## Still Not Working?

If still failing after deployment:
1. Open browser console (F12)
2. Go to **Network** tab
3. Try submitting again
4. Find the `generate-w9-pdf` request
5. Click on it
6. Go to **Response** tab
7. Copy the error message
8. Share it with me

The new code logs:
- ✅ What data is being sent
- ✅ Specific missing fields (if any)
- ✅ Detailed error messages
- ✅ Authentication status

This will help pinpoint the exact issue!

