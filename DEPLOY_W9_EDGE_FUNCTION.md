# Deploy W-9 Edge Function via Supabase Dashboard

## 🚨 CRITICAL: This must be done before the W-9 form will work

## 📋 Step-by-Step Instructions

### Step 1: Go to Supabase Dashboard

Visit: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions

*(Or go to https://supabase.com/dashboard → Select ShoutOut project → Edge Functions)*

---

### Step 2: Create the Function

1. Click **"Create a new function"** button (or "Deploy new function")
2. **Function name**: `generate-w9-pdf`
3. Click **"Create function"** or **"Continue"**

---

### Step 3: Copy the Code

Copy the **ENTIRE** contents of this file:
`supabase/functions/generate-w9-pdf/index.ts`

Paste it into the Supabase Dashboard editor.

**Important:** Make sure you copy ALL the code from line 1 to the end of the file.

---

### Step 4: Deploy

1. Click **"Deploy"** button
2. Wait for deployment to complete (usually 10-30 seconds)
3. Verify function shows as "Active" or "Deployed"

---

### Step 5: Verify Deployment

1. Go to Edge Functions section in Supabase Dashboard
2. Find `generate-w9-pdf` in the list
3. Check status is **Active/Deployed**
4. Click on it to see details and logs

---

## ✅ Testing

After deployment:

1. Go to https://dev.shoutout.us/dashboard (or wherever your app is deployed)
2. Log in as a talent user (e.g., jonathanbodnar)
3. Go to **Payouts** page
4. Click **"Setup Payouts"** button
5. Fill out the W-9 form completely
6. Draw your signature
7. Click **"Sign & Submit W-9"**

If everything is working:
- ✅ Form submits successfully
- ✅ Toast notification shows "W-9 submitted successfully!"
- ✅ You're automatically taken to Step 2 (Moov Account)

If there's an error:
- ❌ Check browser console for detailed error
- ❌ Check Edge Function logs in Supabase Dashboard
- ❌ Verify database migration was applied (Step 6 below)

---

## 🗄️ Step 6: Apply Database Migration

**If you haven't already**, run this SQL in Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/editor
2. Click **"SQL Editor"** in left sidebar
3. Click **"New query"**
4. Copy and paste **ALL** contents from:
   `/Users/jonathanbodnar/ShoutOut/database/add_w9_and_payout_onboarding.sql`
5. Click **"Run"** button
6. Verify success message (no errors)

This creates:
- `w9_forms` table
- `payout_onboarding_step`, `payout_onboarding_completed`, `bank_account_linked` columns on `talent_profiles`
- RLS policies for security

---

## 🔍 Function Details

**Endpoint**: `https://utafetamgwukkbrlezev.supabase.co/functions/v1/generate-w9-pdf`

**What it does**:
1. Validates user authentication
2. Validates W-9 form data
3. Stores non-sensitive info in `w9_forms` table
4. **Does NOT store SSN/EIN** (only used for PDF generation)
5. Generates W-9 HTML representation
6. Returns success to frontend

**Security**:
- ✅ Requires authenticated user
- ✅ Validates talent ownership
- ✅ Prevents duplicate W-9s
- ✅ RLS policies protect data
- ✅ SSN/EIN never stored in database

---

## 🐛 Troubleshooting

### Error: "Edge Function returned a non-2xx status code"
- **Solution**: Function not deployed or has errors. Follow Steps 1-4 above.
- Check Edge Function logs in dashboard for specific error.

### Error: "relation 'w9_forms' does not exist"
- **Solution**: Database migration not applied. Follow Step 6 above.

### Error: "Missing required fields"
- **Solution**: Fill out all required W-9 fields and draw signature.

### Error: "W-9 already exists for this talent"
- **Solution**: This talent already has a W-9 on file. Contact admin to reset if needed.

---

## 📊 Monitoring

View function logs:
1. Go to Supabase Dashboard
2. Click **Edge Functions**
3. Click **generate-w9-pdf**
4. View **Logs** tab

You'll see:
- Function invocations
- Any errors
- Response times
- Request details

---

## ✅ That's It!

Once deployed and database is migrated:
- ✅ W-9 form works
- ✅ Talent can complete payout onboarding
- ✅ Admin can view W-9s in admin panel
- ✅ Progress is saved automatically
- ✅ SSN/EIN is secure (never stored in DB)

**The payout onboarding system is now live!** 🎉

