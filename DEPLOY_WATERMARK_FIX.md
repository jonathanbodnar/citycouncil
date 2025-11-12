# Deploy Watermark Edge Function Fix

## Problem Solved
The watermark Edge Function was returning 500 errors when Cloudinary failed, which blocked talent onboarding. Now it gracefully falls back to the original video and always returns 200.

## Deployment Steps

### 1. Make sure you have Supabase CLI installed
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link to your project
```bash
supabase link --project-ref <your-project-ref>
```

Your project ref can be found in your Supabase dashboard URL:
`https://supabase.com/dashboard/project/<project-ref>`

### 4. Deploy the watermark-video function
```bash
supabase functions deploy watermark-video
```

### 5. Verify deployment
Check the Supabase dashboard → Edge Functions → watermark-video
- Should show "Deployed" status
- Check recent logs for any errors

## What Changed

### Edge Function (`watermark-video`)
- **Before:** Returned 500 error on failure, blocking uploads
- **After:** Always returns 200 with original video as fallback

### Frontend (`TalentOnboardingPage`)
- Better error logging with detailed context
- Graceful error messages: "Video uploaded! (Watermark will be added later)"
- Saves videoUrl even on watermark failure to prevent re-uploads

## Testing After Deployment

1. Go through talent onboarding
2. Upload a promo video
3. Watch the console logs
4. If watermark fails, you should see:
   - ✅ "Video uploaded! (Watermark will be added later)"
   - Console: Detailed error info
   - Onboarding continues normally

## Rollback (if needed)

If something goes wrong, you can rollback by deploying the previous version:

```bash
git checkout c94cff4  # Previous commit
supabase functions deploy watermark-video
git checkout main
```

## Environment Variables Check

Make sure these are set in your Supabase Edge Functions:

```
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
SUPABASE_URL=<auto-set>
SUPABASE_SERVICE_ROLE_KEY=<auto-set>
```

Check: Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

## Still Having Issues?

Check the Edge Function logs:
```bash
supabase functions logs watermark-video
```

Or in the dashboard: Edge Functions → watermark-video → Logs

