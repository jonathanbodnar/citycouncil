# Video Watermarking - Implementation Status

## Current Status: ⚠️ Not Implemented

Video watermarking is **not currently functional**. The watermark edge function exists but requires Cloudinary configuration which isn't set up.

## Why Watermarking is Complex

Client-side video watermarking in the browser is:
- **Very slow** - requires downloading, processing with canvas, and re-encoding
- **Resource intensive** - can freeze the browser
- **Poor quality** - browser-based encoding is lower quality than server-side
- **Not reliable** - fails on large videos or slow connections

## Recommended Solution: Server-Side Watermarking

### Option 1: Use Existing Edge Function with Cloudinary (Recommended)

The `supabase/functions/watermark-video/index.ts` function is ready but needs:

1. **Sign up for Cloudinary**: https://cloudinary.com (free tier available)

2. **Create upload preset** named `shoutout_watermarked` in Cloudinary dashboard

3. **Upload ShoutOut logo** to Cloudinary (get the public_id)

4. **Set environment variables** in Supabase Edge Functions:
   ```bash
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

5. **Update logo public_id** in watermark function (line 59):
   ```typescript
   overlay: 'your_logo_public_id', // Replace with your Cloudinary logo ID
   ```

6. **Call watermark function** when videos are uploaded/downloaded:
   ```typescript
   const { data } = await supabase.functions.invoke('watermark-video', {
     body: { videoUrl: originalVideoUrl }
   });
   const watermarkedUrl = data.watermarkedUrl;
   ```

### Option 2: FFmpeg on Server (More Control)

If you want full control, set up a dedicated video processing server with FFmpeg:

```bash
ffmpeg -i input.mp4 -i logo.png \
  -filter_complex "[1:v]scale=150:-1[logo];[0:v][logo]overlay=20:20:format=auto,format=yuv420p" \
  -c:v libx264 -crf 23 -preset medium \
  -c:a copy output.mp4
```

This requires a separate server/service like:
- AWS Lambda + FFmpeg layer
- Railway/Render with FFmpeg installed
- Dedicated video processing service

## Where to Apply Watermark

Videos that should be watermarked:
1. ✅ **Promo videos** from talent (when `allow_promotional_use` is checked)
2. ✅ **Admin downloads** (from Promotional Videos Management)
3. ❌ **User's personal ShoutOuts** (customers paid for these, no watermark)

## Current Workaround

For now, videos download without watermarks. The filename includes `-watermarked` suffix to indicate where it should be applied, but the actual watermarking isn't happening.

## Quick Fix (If Needed Urgently)

If you need watermarking NOW without server processing:
1. Manually add watermark using video editing software (iMovie, Premiere, etc.)
2. Re-upload the watermarked version
3. Not automated, but works for small volumes

## Long-term Plan

1. Set up Cloudinary (30 minutes)
2. Deploy watermark edge function
3. Update upload flows to call watermark function
4. Store both original AND watermarked URLs
5. Serve watermarked versions for promotional use

