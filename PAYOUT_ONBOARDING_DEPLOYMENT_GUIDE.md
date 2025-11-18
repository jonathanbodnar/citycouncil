# Payout Onboarding System - Deployment Guide

## Overview

This guide covers the complete deployment of the new 3-step payout onboarding system that includes:
1. **W-9 Form** - Digital W-9 submission with signature capture
2. **Moov Account** - Identity verification via Moov
3. **Bank Connection** - Plaid integration for bank account linking

## 🎯 Features Implemented

### User-Facing Features
- ✅ Multi-step onboarding wizard with progress tracking
- ✅ Digital W-9 form with signature capture
- ✅ Resume onboarding from where user left off
- ✅ Moov identity verification integration
- ✅ Plaid bank account linking
- ✅ Progress saved to database (non-sensitive data only)
- ✅ "Setup Payouts" button in PayoutsDashboard

### Admin Features
- ✅ W-9 Forms management panel in admin dashboard
- ✅ View all submitted W-9 forms
- ✅ Download W-9 PDFs
- ✅ Filter and search functionality
- ✅ Status tracking (completed/pending)

## 📋 Prerequisites

### 1. Install Required Packages

```bash
npm install react-signature-canvas @types/react-signature-canvas
```

### 2. Database Migration

Run the following migration to set up the required tables and columns:

```bash
# Connect to your Supabase instance and run:
psql "postgresql://[YOUR_CONNECTION_STRING]" < database/add_w9_and_payout_onboarding.sql
```

Or via Supabase Dashboard:
- Go to SQL Editor
- Paste the contents of `database/add_w9_and_payout_onboarding.sql`
- Click "Run"

This creates:
- `w9_forms` table for storing W-9 submissions
- `payout_onboarding_step` column in `talent_profiles`
- `payout_onboarding_completed` column in `talent_profiles`
- `bank_account_linked` column in `talent_profiles`
- RLS policies for secure access

### 3. Deploy Edge Function

Deploy the W-9 PDF generation edge function:

```bash
cd supabase/functions
supabase functions deploy generate-w9-pdf
```

## 📁 Files Created/Modified

### New Files Created

#### Components
- `src/components/payout/W9Form.tsx` - Digital W-9 form with signature
- `src/components/payout/PayoutOnboardingWizard.tsx` - Multi-step wizard
- `src/components/payout/MoovOnboardingStep.tsx` - Moov integration step
- `src/components/payout/PlaidBankStep.tsx` - Plaid bank linking step
- `src/components/admin/W9Management.tsx` - Admin W-9 management

#### Database
- `database/add_w9_and_payout_onboarding.sql` - Migration script

#### Edge Functions
- `supabase/functions/generate-w9-pdf/index.ts` - W-9 PDF generation

### Modified Files

- `src/components/PayoutsDashboard.tsx` - Added onboarding wizard integration
- `src/components/AdminManagementTabs.tsx` - Added W-9 tab
- `src/components/AdminLayout.tsx` - Added W-9 Forms navigation item

## 🔧 Configuration

### Database Schema

The migration adds these key fields to `talent_profiles`:

```sql
payout_onboarding_step INTEGER DEFAULT 0
  -- 0: Not started
  -- 1: W-9 step (in progress)
  -- 2: Moov step (in progress)
  -- 3: Plaid step (in progress)
  -- 4: Completed

payout_onboarding_completed BOOLEAN DEFAULT FALSE
bank_account_linked BOOLEAN DEFAULT FALSE
```

### W-9 Data Storage

**IMPORTANT SECURITY NOTE:**
- SSN/EIN is **NEVER** stored in our database
- Only non-sensitive W-9 information is stored
- SSN/EIN is used only for PDF generation and then discarded
- Signature is stored as a data URL

## 🚀 Deployment Steps

### Step 1: Install Dependencies

```bash
npm install react-signature-canvas @types/react-signature-canvas
```

### Step 2: Run Database Migration

```bash
# Via Supabase CLI
supabase db push

# Or manually via SQL Editor in Supabase Dashboard
# Run: database/add_w9_and_payout_onboarding.sql
```

### Step 3: Deploy Edge Function

```bash
supabase functions deploy generate-w9-pdf
```

### Step 4: Build and Deploy Frontend

```bash
npm run build
# Deploy to your hosting platform (Railway, Vercel, etc.)
```

### Step 5: Verify Deployment

1. **Test User Flow:**
   - Log in as a talent user
   - Navigate to Payouts dashboard
   - Click "Setup Payouts" button
   - Complete W-9 form (Step 1)
   - Complete Moov verification (Step 2)
   - Link bank account via Plaid (Step 3)
   - Verify completion status

2. **Test Admin Panel:**
   - Log in as admin
   - Navigate to Admin Dashboard
   - Click "W-9 Forms" tab
   - Verify W-9 forms are listed
   - Test download functionality

## 🔍 Testing Checklist

### User Onboarding Flow

- [ ] "Setup Payouts" button appears for users without completed onboarding
- [ ] Wizard opens when button is clicked
- [ ] W-9 form validates all required fields
- [ ] Signature capture works properly
- [ ] W-9 submission succeeds
- [ ] Progress automatically advances to Step 2
- [ ] Moov account creation works
- [ ] Moov account verification status updates
- [ ] Progress automatically advances to Step 3
- [ ] Plaid Link opens successfully
- [ ] Bank account links successfully
- [ ] Moov account ID is stored in database
- [ ] Final completion status is set
- [ ] User can close and resume onboarding

### Progress Persistence

- [ ] User can close wizard and return later
- [ ] Progress is saved correctly in database
- [ ] Wizard resumes at correct step
- [ ] Previously entered data is not required to re-enter
- [ ] Completed steps show checkmarks

### Admin Panel

- [ ] W-9 Forms tab appears in admin navigation
- [ ] All submitted W-9s are listed
- [ ] Search functionality works
- [ ] Filter by status works
- [ ] Download W-9 button works
- [ ] PDF is generated correctly

## 🔐 Security Considerations

### Sensitive Data Handling

1. **SSN/EIN Protection:**
   - Never stored in database
   - Used only for PDF generation
   - Transmitted over HTTPS only
   - Edge function discards after use

2. **Signature Data:**
   - Stored as base64 data URL
   - Only accessible to talent owner and admins
   - Protected by RLS policies

3. **RLS Policies:**
   ```sql
   -- Talent can only view/insert their own W-9
   -- Admins can view all W-9s
   -- No one can update W-9s after submission
   ```

## 🎨 User Experience Flow

### Step 1: W-9 Form
- User fills out legal name, address, tax classification
- Enters SSN/EIN (not stored)
- Signs digitally using signature pad
- Submits form
- Edge function generates PDF
- Progress saved to database

### Step 2: Moov Account
- Pre-fills name, email, phone from user profile
- User enters address and DOB
- Submits for identity verification
- Moov account ID stored in database
- Polls for verification status
- Auto-advances when verified

### Step 3: Bank Account
- Checks for Moov account
- Creates Plaid Link token
- Opens Plaid Link interface
- User selects bank and logs in
- Account linked to Moov
- Completion status set

## 📊 Database Queries

### Check Onboarding Status

```sql
SELECT 
  tp.id,
  tp.full_name,
  tp.payout_onboarding_step,
  tp.payout_onboarding_completed,
  tp.moov_account_id,
  tp.bank_account_linked,
  w9.created_at as w9_submitted_at
FROM talent_profiles tp
LEFT JOIN w9_forms w9 ON w9.talent_id = tp.id
WHERE tp.user_id = 'USER_ID';
```

### View All W-9 Submissions

```sql
SELECT 
  w9.*,
  tp.full_name as talent_name,
  u.email as talent_email
FROM w9_forms w9
JOIN talent_profiles tp ON tp.id = w9.talent_id
JOIN users u ON u.id = tp.user_id
ORDER BY w9.created_at DESC;
```

## 🐛 Troubleshooting

### Issue: W-9 submission fails
**Solution:** Check edge function logs
```bash
supabase functions logs generate-w9-pdf
```

### Issue: Moov account creation fails
**Solution:** Verify Moov API credentials in environment variables

### Issue: Plaid Link doesn't open
**Solution:** Check that Plaid environment is configured correctly

### Issue: Progress doesn't save
**Solution:** Verify RLS policies allow talent to update their own profile

### Issue: Signature pad doesn't work
**Solution:** Ensure `react-signature-canvas` is installed

## 🔄 Rollback Plan

If issues arise, you can rollback:

1. **Database:**
   ```sql
   -- Remove new columns
   ALTER TABLE talent_profiles 
   DROP COLUMN IF EXISTS payout_onboarding_step,
   DROP COLUMN IF EXISTS payout_onboarding_completed,
   DROP COLUMN IF EXISTS bank_account_linked;
   
   -- Drop W-9 table
   DROP TABLE IF EXISTS w9_forms CASCADE;
   ```

2. **Frontend:**
   - Revert to previous commit
   - Redeploy

## 📝 Future Enhancements

- [ ] Email notifications at each onboarding step
- [ ] SMS reminders for incomplete onboarding
- [ ] Bulk W-9 export for accounting
- [ ] W-9 regeneration if information changes
- [ ] PDF storage in secure S3 bucket
- [ ] Integration with tax software

## 🎉 Success Metrics

Track these metrics to measure success:
- % of talent completing onboarding
- Average time to complete onboarding
- Drop-off rate at each step
- Number of W-9s collected
- Bank account link success rate

## 📞 Support

If you encounter issues:
1. Check logs: `supabase functions logs`
2. Review RLS policies in Supabase Dashboard
3. Test with a fresh test user
4. Check browser console for frontend errors

---

**Last Updated:** November 18, 2024
**Version:** 1.0.0

