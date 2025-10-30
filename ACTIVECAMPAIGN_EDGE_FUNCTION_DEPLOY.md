# Deploy ActiveCampaign Edge Function

## The Issue
ActiveCampaign API calls from the browser were failing due to CORS. The solution is to use a Supabase Edge Function as a proxy.

## Deploy the Edge Function

### Option 1: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions

2. **Create New Function**
   - Click "Create a new function"
   - Name: `activecampaign-add`
   - Copy the code from: `supabase/functions/activecampaign-add/index.ts`
   - Paste it into the editor
   - Click "Deploy function"

3. **Set Environment Variables (Secrets)**
   - In the Functions section, click on "Edge Functions settings" or "Manage secrets"
   - Add these secrets:
     - `ACTIVECAMPAIGN_API_KEY` = your ActiveCampaign API key
     - `ACTIVECAMPAIGN_URL` = `https://shoutout94616.api-us1.com`

4. **Make Function Public**
   - Go to Function settings
   - Under "Security", disable "Require JWT" or set appropriate auth rules
   - This function needs to be callable from the frontend without authentication

### Option 2: Via Supabase CLI (If you have it installed)

```bash
# Deploy the function
supabase functions deploy activecampaign-add

# Set secrets
supabase secrets set ACTIVECAMPAIGN_API_KEY=your_key_here
supabase secrets set ACTIVECAMPAIGN_URL=https://shoutout94616.api-us1.com
```

## Testing

After deploying, test the integration:

1. Go to your landing page: `https://shoutout.us`
2. Enter an email and submit
3. Check browser console for logs:
   - "Adding to ActiveCampaign: email@example.com"
   - "ActiveCampaign result: { success: true }"
4. Verify in ActiveCampaign dashboard that:
   - Contact was created
   - Contact appears in "beta" list
   - Contact appears in "Master List"

## Troubleshooting

### Check Edge Function Logs
In Supabase Dashboard → Functions → activecampaign-add → Logs

### Common Issues

1. **Function returns 500**
   - Check that secrets are set correctly
   - Verify API key is valid
   - Check ActiveCampaign API limits

2. **CORS errors**
   - Make sure the function is deployed
   - Check that CORS headers are in the response

3. **Lists not found**
   - Verify list names in ActiveCampaign exactly match:
     - "beta" (case-insensitive)
     - "Master List" (case-insensitive)

## How It Works

1. Frontend calls: `supabase.functions.invoke('activecampaign-add', { body: { email } })`
2. Edge Function receives the email
3. Edge Function calls ActiveCampaign API with stored credentials
4. Edge Function returns success/failure to frontend
5. Frontend continues with signup (even if ActiveCampaign fails)

This approach:
- ✅ Bypasses CORS restrictions
- ✅ Keeps API keys secure (not in frontend)
- ✅ Doesn't block user signup if ActiveCampaign is down
- ✅ Properly handles errors

