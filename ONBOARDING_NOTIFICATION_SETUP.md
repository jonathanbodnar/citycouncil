# Onboarding Completion Email Notification Setup

## Overview
Sends email notifications to jb@shoutout.us and darrin@shoutout.us when a talent completes their onboarding process.

## Edge Function Deployment

### 1. Deploy the Function
```bash
cd /Users/jonathanbodnar/ShoutOut
supabase functions deploy onboarding-complete-notification
```

### 2. Set Environment Variables
The function requires the following environment variables (already set for Mailgun):

```bash
# These should already be set from previous Mailgun setup
supabase secrets set MAILGUN_API_KEY=your_mailgun_api_key
supabase secrets set MAILGUN_DOMAIN=mg.shoutout.us
```

### 3. Test the Function
After deployment, test with:

```bash
curl -X POST 'https://utafetamgwukkbrlezev.supabase.co/functions/v1/onboarding-complete-notification' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "talentId": "test-id-123",
    "talentName": "Test Talent",
    "email": "test@example.com"
  }'
```

## Email Recipients
- **Primary:** jb@shoutout.us
- **Secondary:** darrin@shoutout.us

## Email Content
The notification includes:
- **Subject:** 🎉 New Talent Onboarding Complete: [Talent Name]
- **Talent Information:**
  - Full Name
  - Email Address
  - Talent ID
- **Next Steps:**
  - Review profile
  - Verify promo video
  - Approve for public listing
- **Action Button:** Direct link to Admin Dashboard

## Trigger Point
The email is sent automatically when:
1. Talent completes Step 4 of onboarding (Promo Video)
2. Database is updated with `onboarding_completed = true`
3. Edge function is invoked from the frontend

## Error Handling
- Notification failures do NOT block onboarding completion
- Errors are logged to console for monitoring
- Talent can still proceed even if email fails to send

## Verification
After deployment, complete a test onboarding flow and verify:
1. Email is received at both addresses
2. Email content is properly formatted
3. Admin dashboard link works
4. Onboarding still completes if email fails

## Notes
- Uses the same Mailgun configuration as other notifications
- HTML email with professional styling
- Mobile-responsive design
- Includes direct link to admin panel for quick action

