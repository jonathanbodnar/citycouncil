# Payout Onboarding - Deployment Steps

## Current Status
✅ Code pushed to `development` branch
❌ Database migration NOT applied yet
❌ Edge function NOT deployed yet

## Step 1: Apply Database Migration

Run this SQL script in your Supabase SQL Editor:

```sql
-- Copy and paste the entire contents of:
-- database/add_w9_and_payout_onboarding.sql
```

Or apply via Supabase CLI:
```bash
cd /Users/jonathanbodnar/ShoutOut
supabase db push
```

**What this does:**
- Creates `w9_forms` table for storing W-9 data (WITHOUT SSN/EIN)
- Adds `payout_onboarding_step`, `payout_onboarding_completed`, and `bank_account_linked` columns to `talent_profiles`
- Sets up RLS policies for secure access
- Creates necessary indexes

## Step 2: Deploy Edge Function

Deploy the `generate-w9-pdf` edge function:

```bash
cd /Users/jonathanbodnar/ShoutOut
supabase functions deploy generate-w9-pdf
```

**What this does:**
- Processes W-9 submissions from the frontend
- Validates W-9 data
- Stores non-sensitive info in database
- Generates W-9 HTML/PDF (future enhancement)
- Does NOT store SSN/EIN in database

## Step 3: Verify Deployment

1. **Check Database:**
   ```sql
   -- Verify table exists
   SELECT * FROM w9_forms LIMIT 1;
   
   -- Verify columns added
   SELECT payout_onboarding_step, payout_onboarding_completed, bank_account_linked 
   FROM talent_profiles LIMIT 1;
   ```

2. **Check Edge Function:**
   - Go to Supabase Dashboard → Edge Functions
   - Verify `generate-w9-pdf` is listed and deployed
   - Check deployment logs for any errors

3. **Test in Browser:**
   - Log in as a talent user (jonathanbodnar)
   - Go to Payouts page
   - Click "Setup Payouts" button
   - Try filling out the W-9 form
   - Check browser console for any errors

## Common Issues

### Error: "relation 'w9_forms' does not exist"
**Solution:** Database migration not applied. Run Step 1.

### Error: "Edge Function returned a non-2xx status code"
**Solution:** Edge function not deployed or has errors. Run Step 2 and check logs.

### Error: "Missing required fields"
**Solution:** Make sure all required W-9 fields are filled out and signature is drawn.

### Styling Issues (white on white text)
**Solution:** Already fixed in latest deployment. Clear browser cache or hard refresh (Cmd+Shift+R).

## Current Known Issues

Based on your screenshot:
1. ✅ **FIXED**: White text on white background (styling issue)
2. ✅ **FIXED**: Poor contrast on active step text
3. ❌ **TO FIX**: Edge function error (need to deploy function)
4. ❌ **TO FIX**: Database migration needed

## After Deployment

Once both steps are complete:
1. Clear browser cache
2. Hard refresh the page (Cmd+Shift+R)
3. Try submitting the W-9 form again
4. The error should be resolved and form should submit successfully

## Next Steps After Successful Deployment

1. Test full onboarding flow (W-9 → Moov → Plaid)
2. Verify admin panel can view W-9 forms
3. Test that progress is saved between sessions
4. Verify Moov account is created and linked
5. Verify Plaid bank account is connected to Moov

