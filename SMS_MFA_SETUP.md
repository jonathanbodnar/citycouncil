# SMS MFA Setup Guide for ShoutOut

## Overview
SMS-based Multi-Factor Authentication has been added as an alternative to TOTP (authenticator apps). Users can now choose between:
- **Authenticator App** (Google Authenticator, Authy, etc.) - FREE
- **SMS Text Messages** - Requires Twilio setup and has costs

## ⚠️ Important: SMS MFA Costs

### Supabase Costs:
- **$75/month** for the first project with Phone MFA enabled
- **$10/month** for each additional project
- Billed at **$0.1027/hour** (first project) or **$0.0137/hour** (additional)

### Twilio Costs:
- **~$1/month** for phone number rental
- **~$0.0075 per SMS** sent (varies by country)
- Estimated **$10-50/month** depending on usage

**Total Monthly Cost: ~$85-125/month** for SMS MFA

## Setup Instructions

### Step 1: Create Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for an account
3. Verify your email and phone number
4. You'll get **$15 in trial credit** to test with

### Step 2: Get Twilio Credentials

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to **Dashboard**
3. Find and copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal and copy)

### Step 3: Create Messaging Service

1. In Twilio Console, go to **Messaging** → **Services**
2. Click **Create Messaging Service**
3. Give it a friendly name: "ShoutOut MFA"
4. Select **Notify my users** as the use case
5. Click **Create**
6. Add a phone number:
   - Click **Add Senders**
   - Buy a new phone number (costs ~$1/month)
   - Select a number and add it to your service
7. Copy the **Messaging Service SID** (starts with `MG...`)

### Step 4: Enable Phone MFA in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Configuration**
4. Scroll to **Multi-Factor Authentication**
5. Enable **Phone** (TOTP should already be enabled)
6. Click **Save**

### Step 5: Configure Twilio in Supabase

1. Still in **Authentication** → **Configuration**
2. Scroll to **SMS Provider**
3. Select **Twilio** from the dropdown
4. Enter your credentials:
   ```
   Account SID: AC... (from Step 2)
   Auth Token: ... (from Step 2)
   Messaging Service SID: MG... (from Step 3)
   ```
5. Click **Save**

### Step 6: Test SMS MFA

1. Go through talent onboarding
2. At Step 5 (MFA), select **Text Message (SMS)**
3. Enter a phone number
4. You should receive an SMS with a 6-digit code
5. Enter the code to complete enrollment

## Environment Variables

No additional environment variables needed! All SMS configuration is done in Supabase dashboard.

## Testing with Trial Account

Twilio trial accounts have limitations:
- ✅ Can send SMS to **verified phone numbers only**
- ❌ Cannot send to unverified numbers
- ✅ $15 free credit included

To verify a phone number during trial:
1. Go to Twilio Console → **Phone Numbers** → **Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter phone number and verify via call or SMS

## Going to Production

Once you're ready to go live:

1. **Upgrade Twilio Account:**
   - Go to Twilio Console → **Account** → **Upgrade**
   - Add payment method
   - Remove trial restrictions

2. **Set Up Usage Alerts:**
   - Go to **Billing** → **Usage Alerts**
   - Set spending limit (e.g., $100/month)
   - Get notified before hitting limit

3. **Monitor Usage:**
   - Check Twilio Console → **Usage** regularly
   - Monitor SMS costs per month
   - Track number of MFA verifications

## Cost Optimization Tips

### 1. Make SMS Optional
SMS is more expensive than TOTP. Encourage users to use authenticator apps:
- Highlight "FREE" for authenticator app option
- Show SMS as "Standard rates apply"
- Default to authenticator app recommendation

### 2. Implement Rate Limiting
```typescript
// Limit SMS resends to prevent abuse
- Max 3 SMS per 15 minutes per user
- Show countdown timer for resend button
- Log suspicious activity
```

### 3. Use Shorter Codes
- 6-digit codes are secure enough
- Reduce SMS length = lower cost
- Keep message simple: "Your ShoutOut code: 123456"

### 4. Set Expiration Times
- Codes expire after 5 minutes
- Reduces need for resends
- Improves security

## Troubleshooting

### "SMS MFA is not enabled" Error
**Solution:** Enable Phone MFA in Supabase Dashboard (Step 4)

### SMS Not Received
**Causes:**
1. Twilio trial account - number not verified
2. Invalid phone number format
3. Twilio credentials incorrect
4. SMS provider not configured

**Solutions:**
1. Verify number in Twilio Console (trial only)
2. Ensure +1 country code for US numbers
3. Double-check Account SID and Auth Token
4. Verify Messaging Service SID is correct

### "Messaging Service not found"
**Solution:** Make sure you created a Messaging Service in Twilio and added a phone number to it

### High SMS Costs
**Solutions:**
1. Check for abuse/spam in usage logs
2. Implement rate limiting (max 3 SMS per 15 min)
3. Encourage authenticator app usage
4. Set Twilio spending limits

## Alternative: Email-based MFA

If SMS costs are too high, consider:
- **Email OTP** (free, but less secure)
- **TOTP only** (free, but requires app installation)
- **Backup codes** (free, one-time use)

## Current Implementation

### Component: `MFAEnrollmentDual.tsx`
Features:
- ✅ Method selection screen (TOTP vs SMS)
- ✅ Phone number input with formatting
- ✅ SMS code delivery
- ✅ Code verification
- ✅ Resend code functionality
- ✅ Fallback to TOTP if SMS fails

### Integration:
- **Talent Onboarding** (Step 5)
- **Future:** User settings page for managing MFA

## Budget Planning

### For 100 Talent Accounts:
- Initial enrollment: 100 SMS × $0.0075 = **$0.75**
- Monthly re-auth (avg 10 logins/talent): 1,000 SMS × $0.0075 = **$7.50**
- **Total: ~$10/month in SMS costs + $75 Supabase fee = $85/month**

### For 1,000 Talent Accounts:
- Initial enrollment: 1,000 SMS × $0.0075 = **$7.50**
- Monthly re-auth: 10,000 SMS × $0.0075 = **$75**
- **Total: ~$85/month in SMS costs + $75 Supabase fee = $160/month**

## Recommendations

### For Beta/Testing:
✅ Enable SMS MFA for testing  
✅ Use Twilio trial account ($15 free credit)  
✅ Verify your own phone numbers  
✅ Test both TOTP and SMS flows  

### For Launch:
✅ Keep both TOTP and SMS options  
✅ Upgrade Twilio account  
✅ Set spending limits  
✅ Monitor usage weekly  
⚠️ Consider making TOTP the default (cheaper)  

### For Scale (1000+ users):
✅ Heavily promote TOTP (free)  
✅ Charge users for SMS option (e.g., $2/month premium)  
✅ Implement strict rate limiting  
✅ Consider dedicated phone number per region  

## Support & Resources

- [Twilio SMS Pricing](https://www.twilio.com/sms/pricing/us)
- [Supabase Phone MFA Pricing](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone)
- [Twilio Messaging Services](https://www.twilio.com/docs/messaging/services)
- [Supabase MFA Docs](https://supabase.com/docs/guides/auth/auth-mfa/phone)

---

**Implementation Date**: November 2025  
**Status**: ✅ Code Complete - Requires Twilio & Supabase Configuration  
**Monthly Cost**: ~$85-160 depending on usage

