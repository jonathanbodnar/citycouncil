# Moov Payout System - Deployment Guide

## Overview

This guide covers the complete payout flow:
1. **W-9 Form** - Tax document signing via SignNow
2. **Veriff KYC** - Identity verification
3. **Moov Account** - Payment account creation with KYC data
4. **Plaid Bank Link** - Secure bank account connection
5. **Payout Processing** - Automated transfers from ShoutOut to talent

## Prerequisites

### Environment Variables Required

Set these in Supabase Edge Function secrets:

```bash
# Moov API (LIVE credentials from Moov Dashboard)
supabase secrets set MOOV_PUBLIC_KEY=your_live_public_key
supabase secrets set MOOV_SECRET_KEY=your_live_secret_key
supabase secrets set MOOV_FACILITATOR_ACCOUNT_ID=your_shoutout_moov_account_id

# Plaid API (Production)
supabase secrets set PLAID_CLIENT_ID=your_plaid_client_id
supabase secrets set PLAID_SECRET=your_plaid_production_secret

# SignNow API
supabase secrets set SIGNNOW_CLIENT_ID=your_signnow_client_id
supabase secrets set SIGNNOW_CLIENT_SECRET=your_signnow_client_secret
supabase secrets set SIGNNOW_EMAIL=your_signnow_email
supabase secrets set SIGNNOW_PASSWORD=your_signnow_password
supabase secrets set SIGNNOW_TEMPLATE_ID=your_w9_template_id

# Veriff API
supabase secrets set VERIFF_API_KEY=your_veriff_api_key
supabase secrets set VERIFF_SECRET_KEY=your_veriff_secret_key
```

### Finding Your MOOV_FACILITATOR_ACCOUNT_ID

1. Log into Moov Dashboard (https://dashboard.moov.io)
2. Go to Settings > API Keys
3. Your account ID is displayed at the top (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Deploy Edge Functions

```bash
cd /Users/jonathanbodnar/ShoutOut

# Deploy all payout-related edge functions
supabase functions deploy moov-create-account --no-verify-jwt
supabase functions deploy moov-get-account --no-verify-jwt
supabase functions deploy moov-plaid-link-account --no-verify-jwt
supabase functions deploy moov-create-transfer --no-verify-jwt
supabase functions deploy moov-process-pending-batches --no-verify-jwt
supabase functions deploy plaid-create-link-token --no-verify-jwt
supabase functions deploy signnow-create-w9-invite --no-verify-jwt
supabase functions deploy veriff-create-session --no-verify-jwt
supabase functions deploy veriff-webhook --no-verify-jwt
```

## Reset Test Talent (jonathanbodnar)

Run this SQL in Supabase SQL Editor to clear existing test data:

```sql
-- File: database/reset_jonathanbodnar_payout_setup.sql
```

## Payout Flow

### Step 1: W-9 Form (SignNow)
- Talent opens payout setup wizard
- SignNow form opens in new window
- Talent signs and submits W-9
- Manual "I've completed the W-9" button advances to next step

### Step 2: Veriff KYC
- Talent completes identity verification
- Veriff webhook updates `talent_profiles.veriff_verified = true`
- Talent can proceed to next step

### Step 3: Moov Account Setup
- Talent enters personal info (name, address, DOB, SSN)
- Edge function creates Moov account with KYC data
- Moov verifies identity
- Account ID stored in `talent_profiles.moov_account_id`

### Step 4: Plaid Bank Link
- Plaid Link opens to connect bank account
- Processor token exchanged with Moov
- Bank account linked to Moov account
- `talent_profiles.bank_account_linked = true`

### Step 5: Automatic Batch Processing
- When onboarding completes, `moov-process-pending-batches` is called
- All pending payout batches for this talent are processed
- Transfers created from ShoutOut's Moov account to talent's bank

## Admin Payout Controls

### Enable/Disable Payouts Globally
```sql
-- Enable payouts
UPDATE platform_settings 
SET setting_value = 'true' 
WHERE setting_key = 'payouts_enabled';

-- Disable payouts
UPDATE platform_settings 
SET setting_value = 'false' 
WHERE setting_key = 'payouts_enabled';
```

### View Processable Batches
```sql
SELECT * FROM admin_processable_batches;
```

### Manually Process a Batch
Call the edge function:
```javascript
await supabase.functions.invoke('moov-create-transfer', {
  body: {
    batchId: 'uuid-of-batch',
    amount: 100.00,
    destinationAccountId: 'talent-moov-account-id',
    description: 'Manual payout'
  }
})
```

## Troubleshooting

### "No valid source payment method found"
- Ensure ShoutOut's Moov account has a linked bank account or funded wallet
- Check `MOOV_FACILITATOR_ACCOUNT_ID` is correct

### "No valid bank account found for destination"
- Talent hasn't completed Plaid bank link
- Check `bank_account_linked = true` in `talent_profiles`

### Transfer Fails
1. Check Moov Dashboard for transfer status
2. Check edge function logs: `supabase functions logs moov-create-transfer`
3. Verify both accounts have proper capabilities enabled

### Payout Amounts Wrong
- Amounts should be in dollars in `payout_batches.net_payout_amount`
- The transfer function converts to cents for Moov API

## Database Tables

### talent_profiles (payout fields)
- `moov_account_id` - Moov account UUID
- `bank_account_linked` - Boolean, true after Plaid success
- `payout_onboarding_step` - Current step (1-5)
- `payout_onboarding_completed` - Boolean
- `veriff_verified` - Boolean

### payout_batches
- `status` - pending, processing, paid, failed
- `moov_transfer_id` - Moov transfer UUID
- `moov_transfer_status` - Status from Moov
- `net_payout_amount` - Amount to pay talent

### payouts
- Individual order payouts
- Linked to batch via `batch_id`

## Webhook Setup (Optional)

For real-time transfer status updates, set up Moov webhooks:

1. In Moov Dashboard, go to Webhooks
2. Add webhook URL: `https://jborsxsacgqnjaqjpmvn.supabase.co/functions/v1/moov-webhook`
3. Subscribe to `transfer.updated` events
4. Create the webhook handler edge function (not yet implemented)

## Testing Checklist

- [ ] Reset jonathanbodnar payout data
- [ ] Complete W-9 form via SignNow
- [ ] Complete Veriff identity verification
- [ ] Create Moov account with KYC data
- [ ] Link bank account via Plaid
- [ ] Verify pending batches are processed
- [ ] Check transfer appears in Moov Dashboard
- [ ] Confirm funds arrive in bank account (1-3 business days)

