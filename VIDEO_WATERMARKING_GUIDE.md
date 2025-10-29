# Video Watermarking Implementation Guide

## Overview
This guide explains how to implement video watermarking for promotional video downloads in the ShoutOut admin panel.

## Requirements
- ShoutOut logo watermark (top-left corner, 60% opacity)
- Applied when admin downloads videos from the "Promo Videos" tab
- Maintains video quality

## Implementation Options

### Option 1: Server-Side with FFmpeg (Recommended)

**Pros:**
- No client-side performance hit
- Consistent watermark quality
- Can handle large videos
- Professional quality

**Cons:**
- Requires server setup
- Additional infrastructure cost

**Implementation:**

1. **Create Supabase Edge Function** (`supabase/functions/watermark-video/index.ts`):

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { videoUrl } = await req.json();
    
    // Download video from Wasabi
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    
    // Use FFmpeg to add watermark
    // This requires FFmpeg binary in the edge function
    // Alternative: Call external service like Cloudinary or AWS MediaConvert
    
    // For now, recommend using external service
    const watermarkedUrl = await addWatermarkViaCloudinary(videoBlob);
    
    return new Response(
      JSON.stringify({ watermarkedUrl }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});

async function addWatermarkViaCloudinary(videoBlob: Blob) {
  // Cloudinary video transformation API
  // Upload video with watermark overlay transformation
  // Return transformed URL
}
```

2. **Update `PromotionalVideosManagement.tsx`:**

```typescript
const handleDownloadWithWatermark = async (videoUrl: string, talentName: string, orderId: string) => {
  setDownloadingVideo(orderId);
  try {
    // Call edge function to add watermark
    const { data, error } = await supabase.functions.invoke('watermark-video', {
      body: { videoUrl }
    });

    if (error) throw error;

    // Download watermarked video
    const response = await fetch(data.watermarkedUrl);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shoutout-${talentName.replace(/\s+/g, '-')}-${orderId}.mp4`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Watermarked video downloaded!');
  } catch (error) {
    console.error('Error downloading video:', error);
    toast.error('Failed to download video');
  } finally {
    setDownloadingVideo(null);
  }
};
```

### Option 2: Client-Side with Canvas/WebCodecs API

**Pros:**
- No server required
- Works entirely in browser

**Cons:**
- Performance intensive for client
- May struggle with large videos
- Browser compatibility issues

**Implementation:**

```typescript
const addWatermarkToVideo = async (videoUrl: string): Promise<Blob> => {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  
  await new Promise(resolve => {
    video.onloadedmetadata = resolve;
  });

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;

  // Load watermark image
  const watermark = new Image();
  watermark.src = '/logo.png'; // Your ShoutOut logo
  await new Promise(resolve => {
    watermark.onload = resolve;
  });

  // Create MediaRecorder to capture canvas
  const stream = canvas.captureStream();
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => chunks.push(e.data);

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/mp4' }));
    };

    video.play();
    recorder.start();

    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Draw watermark (top-left, 60% opacity)
      ctx.globalAlpha = 0.6;
      const logoWidth = canvas.width * 0.15; // 15% of video width
      const logoHeight = (watermark.height / watermark.width) * logoWidth;
      ctx.drawImage(watermark, 20, 20, logoWidth, logoHeight);
      ctx.globalAlpha = 1.0;

      if (!video.ended) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
      }
    };

    drawFrame();
  });
};
```

### Option 3: External Service (Easiest)

**Recommended Service: Cloudinary**

1. Sign up for Cloudinary (free tier available)
2. Upload video with transformation:

```typescript
// Install: npm install cloudinary

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function addWatermark(videoUrl: string): Promise<string> {
  // Upload video to Cloudinary
  const upload = await cloudinary.uploader.upload(videoUrl, {
    resource_type: 'video',
    transformation: [
      {
        overlay: 'shoutout_logo', // Your uploaded logo asset in Cloudinary
        gravity: 'north_west',
        x: 20,
        y: 20,
        width: 150,
        opacity: 60
      }
    ]
  });

  return upload.secure_url;
}
```

## Recommended Approach

**For immediate deployment:** Use **Option 3 (Cloudinary)** as it's the quickest and most reliable.

**For long-term/production:** Migrate to **Option 1 (Server-Side)** with AWS MediaConvert or similar for cost efficiency at scale.

## Next Steps

1. Choose implementation option
2. Set up required infrastructure (Cloudinary account or FFmpeg server)
3. Update `PromotionalVideosManagement.tsx` component
4. Test with various video formats and sizes
5. Monitor performance and costs

## Logo Requirements

- **Format:** PNG with transparent background
- **Size:** ~300x300px (will be scaled down in video)
- **Location:** Place in `public/shoutout-watermark-logo.png`
- **Opacity:** 60% (applied in code)

