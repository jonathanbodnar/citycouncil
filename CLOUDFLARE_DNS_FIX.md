# CloudFlare DNS Configuration Fix

## Problem

Videos uploaded to Wasabi are returning `NoSuchBucket` error when accessed via `videos.shoutout.us`.

The error shows the browser is trying to access a bucket named `videos.shoutout.us`, but the actual bucket name is `shoutoutorders`.

## Solution

Your CloudFlare CNAME needs to point to the correct Wasabi bucket URL.

### CloudFlare DNS Settings

Go to CloudFlare Dashboard → DNS → Records

**For Videos:**
- **Type**: CNAME
- **Name**: `videos` (will create videos.shoutout.us)
- **Target**: `shoutoutorders.s3.us-central-1.wasabisys.com`
- **Proxy status**: Proxied (orange cloud ☁️)
- **TTL**: Auto

**For Images/Assets:**
- **Type**: CNAME
- **Name**: `assets` (will create assets.shoutout.us)
- **Target**: `shoutoutorders.s3.us-central-1.wasabisys.com`
- **Proxy status**: Proxied (orange cloud ☁️)
- **TTL**: Auto

### Why This Works

1. Browser requests: `https://videos.shoutout.us/videos/promo_123.MP4`
2. CloudFlare receives the request (because of CNAME)
3. CloudFlare proxies to: `https://shoutoutorders.s3.us-central-1.wasabisys.com/videos/promo_123.MP4`
4. Wasabi returns the video
5. CloudFlare caches and serves it

### After Changing DNS

1. Wait 5-10 minutes for DNS propagation
2. Clear browser cache or test in incognito
3. Try uploading a new video in admin panel
4. Check if video loads on landing page

### Testing

Test the CNAME is working:
```bash
# Should return the Wasabi IP
nslookup videos.shoutout.us

# Or test directly
curl -I https://videos.shoutout.us/videos/test.mp4
```

### Alternative: Direct Wasabi URLs (Temporary Fix)

If you want videos to work immediately while DNS propagates, you can temporarily use direct Wasabi URLs by changing the code:

```typescript
// In src/services/videoUpload.ts line 54:
const videoUrl = `https://shoutoutorders.s3.us-central-1.wasabisys.com/${fileName}`;
```

But CloudFlare CDN is better for performance and bandwidth costs.

## Bucket Policy Check

Also verify your Wasabi bucket policy allows public read:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::shoutoutorders/*"
    }
  ]
}
```

