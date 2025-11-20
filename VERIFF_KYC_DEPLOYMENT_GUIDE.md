# Veriff KYC Deployment Guide

This guide explains how to deploy the Veriff identity verification (KYC) integration for payout onboarding.

## Overview

The Veriff KYC step has been added as **Step 2** in the payout onboarding wizard:
1. W-9 Form (tax information)
2. **Veriff ID Verification (NEW)**
3. Moov Account (payment setup)
4. Plaid Bank Link (bank account)

## Prerequisites

1. **Veriff Account**: Sign up at [https://www.veriff.com/](https://www.veriff.com/)
2. **API Credentials**: Get from Veriff dashboard
   - API Key
   - Secret Key (for HMAC signatures)

## Database Setup

### 1. Run the Migration

Execute the SQL migration in Supabase SQL Editor:

```bash
database/add_veriff_kyc.sql
```

This creates:
- `veriff_sessions` table (stores verification sessions)
- `veriff_verified` column on `talent_profiles`
- RLS policies for security

## Edge Functions Deployment

### 2. Deploy Veriff Session Creation Function

```bash
npx supabase functions deploy veriff-create-session
```

Or via Supabase Dashboard:
1. Go to Edge Functions
2. Find `veriff-create-session`
3. Click "Deploy new version"

### 3. Deploy Veriff Webhook Handler

```bash
npx supabase functions deploy veriff-webhook
```

Or via Supabase Dashboard:
1. Go to Edge Functions
2. Find `veriff-webhook`
3. Click "Deploy new version"

## Environment Variables

### 4. Add Veriff Credentials to Supabase

Go to Supabase → Project Settings → Edge Functions → Secrets

Add the following secrets:

```
VERIFF_API_KEY=your_veriff_api_key_here
VERIFF_SECRET_KEY=your_veriff_secret_key_here
```

**Important**: These credentials come from your Veriff dashboard.

## Veriff Webhook Configuration

### 5. Configure Webhook in Veriff Dashboard

1. Log into your Veriff dashboard
2. Go to Settings → Webhooks / Integration
3. Add webhook URL:
   ```
   https://[your-project-ref].supabase.co/functions/v1/veriff-webhook
   ```
   Replace `[your-project-ref]` with your actual Supabase project reference (e.g., `utafetamgwukkbrlezev`)

4. Select events to send:
   - `verification.started`
   - `verification.submitted`
   - `verification.approved`
   - `verification.declined`
   - `verification.resubmission_requested`
   - `verification.expired`
   - `verification.abandoned`

5. Enable HMAC signature for security

## Testing

### 6. Test the Flow

1. **Navigate to Dashboard**: Go to your talent dashboard
2. **Start Onboarding**: Click "Setup Payouts"
3. **Complete W-9**: Fill out and sign the W-9 form (Step 1)
4. **Verify Identity**: 
   - Click "Start Verification" button
   - Complete Veriff's ID verification process
   - Upload your ID document
   - Take a selfie
5. **Check Status**: The page will auto-detect completion and move to Step 3

### Test Mode

Veriff provides a test environment. To use it:
1. Change API endpoint in `veriff-create-session/index.ts`:
   ```typescript
   // Production
   const endpoint = 'https://stationapi.veriff.com/v1/sessions'
   
   // Test
   const endpoint = 'https://stationapi.veriff.me/v1/sessions'
   ```

## Troubleshooting

### Verification Not Auto-Advancing

If the wizard doesn't automatically move to the next step after verification:

1. **Check Webhook**: Verify webhook is configured in Veriff dashboard
2. **Check Logs**: Look at Supabase Edge Function logs for `veriff-webhook`
3. **Manual Check**: Query the database:
   ```sql
   SELECT * FROM veriff_sessions WHERE talent_id = 'your-talent-id';
   ```
4. **Verify Status**: Check if status is `'approved'`

### Session Creation Fails

1. **Check Credentials**: Verify `VERIFF_API_KEY` and `VERIFF_SECRET_KEY` are set
2. **Check Logs**: Look at `veriff-create-session` edge function logs
3. **API Limits**: Ensure your Veriff plan allows new sessions

### Webhook Not Receiving Events

1. **Check URL**: Verify webhook URL is correct in Veriff dashboard
2. **Check HMAC**: Ensure HMAC signature is enabled
3. **Test Webhook**: Use Veriff's webhook testing tool
4. **Check Function**: Ensure `veriff-webhook` is deployed

## Security Notes

1. **HMAC Verification**: The webhook handler verifies HMAC signatures to ensure requests are from Veriff
2. **RLS Policies**: Row-level security ensures talent can only see their own sessions
3. **Service Role**: Edge functions use service role to bypass RLS for updates
4. **Data Storage**: Personal data (name, DOB, document number) is stored securely

## Data Retention

The `veriff_sessions` table stores:
- Session ID and URL
- Verification status
- Person details (name, DOB, nationality)
- Document type and number
- Timestamps

Consider implementing data retention policies per your compliance requirements.

## API Reference

### Veriff Documentation

- [API Docs](https://developers.veriff.com/)
- [Webhooks](https://developers.veriff.com/#webhooks)
- [Session Creation](https://developers.veriff.com/#creating-a-session)

## Support

For issues:
1. Check Veriff status: [https://status.veriff.com/](https://status.veriff.com/)
2. Review Supabase Edge Function logs
3. Contact Veriff support for API-specific issues

