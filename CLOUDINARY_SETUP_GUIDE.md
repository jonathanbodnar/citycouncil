# Cloudinary Setup for Video Watermarking

## Overview
This guide walks through setting up Cloudinary for automated video watermarking in ShoutOut.

## Why Cloudinary?
- ✅ No server-side FFmpeg needed
- ✅ Automatic video optimization
- ✅ CDN delivery
- ✅ Simple API
- ✅ Free tier available (25GB storage, 25GB bandwidth/month)

## Step 1: Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com/)
2. Sign up for free account
3. Verify email

## Step 2: Get API Credentials

1. Go to Dashboard
2. Note your **Cloud Name** (e.g., `dxyz123abc`)
3. Go to Settings → Access Keys
4. Copy:
   - **API Key**
   - **API Secret**

## Step 3: Upload ShoutOut Logo

1. Go to Media Library → Upload
2. Upload your ShoutOut logo (PNG with transparent background recommended)
3. Set **Public ID** to: `shoutout_logo`
4. Note the dimensions (recommend ~300x300px)

### Logo Requirements
- **Format:** PNG with transparent background
- **Size:** 300x300px recommended
- **Public ID:** Must be exactly `shoutout_logo`
- **Location in video:** Top-left corner, 20px padding

## Step 4: Create Upload Preset

1. Go to Settings → Upload
2. Scroll to "Upload presets"
3. Click "Add upload preset"
4. Configure:
   - **Preset name:** `shoutout_watermarked`
   - **Signing Mode:** Unsigned
   - **Folder:** `watermarked-videos`
   - **Use filename or externally defined Public ID:** Yes
   - **Unique filename:** Yes
5. Save

## Step 5: Configure Supabase Edge Function

1. Go to Supabase Dashboard → Edge Functions
2. Create function named `watermark-video`
3. Deploy the code from `supabase/functions/watermark-video/index.ts`
4. Add environment variables:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Deploy via CLI:
```bash
cd supabase/functions
supabase functions deploy watermark-video --project-ref your-project-ref
```

### Add secrets via CLI:
```bash
supabase secrets set CLOUDINARY_CLOUD_NAME=your_cloud_name --project-ref your-project-ref
supabase secrets set CLOUDINARY_API_KEY=your_api_key --project-ref your-project-ref
supabase secrets set CLOUDINARY_API_SECRET=your_api_secret --project-ref your-project-ref
```

## Step 6: Test the Watermarking

1. Go to Admin Dashboard → Promo Videos tab
2. Click "Download" on any video
3. You should see:
   - "Adding watermark..." toast
   - "Watermark applied!" toast
   - "Downloading video..." toast
   - Video downloads with ShoutOut logo in top-left

## Troubleshooting

### "Watermarking not configured" warning
- **Issue:** Cloudinary environment variables not set
- **Fix:** Add variables to Supabase Edge Function secrets

### Video download fails
- **Issue:** Original video URL inaccessible or CORS issue
- **Fix:** Ensure Wasabi bucket has proper CORS configuration

### Logo doesn't appear
- **Issue:** Logo not uploaded or wrong Public ID
- **Fix:** Upload logo with exact Public ID `shoutout_logo`

### Watermark too large/small
- **Fix:** Adjust `width` in transformation:
```typescript
transformation: {
  overlay: 'shoutout_logo',
  gravity: 'north_west',
  x: 20,
  y: 20,
  width: 150,  // Adjust this value (150px default)
  opacity: 60,
  flags: 'layer_apply'
}
```

## Cost Estimation

### Cloudinary Free Tier:
- 25GB storage
- 25GB bandwidth/month
- All transformations included

### When you exceed free tier:
- $89/month for 50GB storage + 50GB bandwidth
- Or pay-as-you-go: $0.05/GB storage, $0.12/GB bandwidth

### Example usage:
- Average video: 10MB
- 100 downloads/month = 1GB bandwidth = FREE
- 1000 downloads/month = 10GB bandwidth = FREE
- 5000 downloads/month = 50GB bandwidth = $89/month

## Alternative: Download Original (Interim Solution)

If Cloudinary is not configured, the system falls back to downloading the original video without watermark. This allows the feature to work immediately while Cloudinary setup is in progress.

## Watermark Customization

To customize the watermark appearance, edit `supabase/functions/watermark-video/index.ts`:

```typescript
transformation: {
  overlay: 'shoutout_logo',
  gravity: 'north_west',  // Position: north_west, north_east, south_west, south_east, center
  x: 20,                   // Horizontal offset in pixels
  y: 20,                   // Vertical offset in pixels
  width: 150,              // Logo width in pixels
  opacity: 60,             // Opacity (0-100)
  flags: 'layer_apply'
}
```

### Position Options:
- `north_west` = top-left (default)
- `north_east` = top-right
- `south_west` = bottom-left
- `south_east` = bottom-right
- `center` = center

## Support

For Cloudinary support:
- Documentation: [cloudinary.com/documentation](https://cloudinary.com/documentation)
- Support: support@cloudinary.com

For ShoutOut technical issues:
- Check Supabase Edge Function logs
- Check browser console for errors
- Verify all environment variables are set

