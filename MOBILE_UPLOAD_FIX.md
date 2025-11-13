# Mobile Upload Fix - Network Error on Fast WiFi

## Problem
Android Chrome getting "Network error" on fast WiFi when uploading to Wasabi S3.

## Root Cause
**AWS SDK + Mobile Browser + CORS = Problems**

When using AWS SDK directly in mobile browsers:
1. CORS preflight requests may fail
2. Mobile browsers handle credentials differently
3. AWS SDK makes multiple requests that mobile browsers block

## Solution Options

### Option 1: Check Wasabi CORS Settings (Quick)
Ensure your Wasabi bucket has proper CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://shoutout.us", "https://*.shoutout.us"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Option 2: Use Presigned URLs (Recommended for Mobile)
Create an Edge Function that generates presigned URLs, then upload directly via fetch:

**Advantages:**
- No CORS issues (browser thinks it's uploading to your domain)
- Works on all mobile browsers
- Simpler error handling
- Better progress tracking

**Flow:**
1. Frontend requests presigned URL from your Edge Function
2. Edge Function generates Wasabi presigned URL (server-side)
3. Frontend uploads file directly to Wasabi using presigned URL
4. No AWS SDK needed in browser

### Option 3: Upload Through Edge Function Proxy (Most Reliable)
Upload file to your Edge Function, which then uploads to Wasabi:

**Advantages:**
- Zero CORS issues
- Works everywhere (even ancient browsers)
- Can add validation/processing server-side
- Better security (credentials never in browser)

**Disadvantages:**
- Uses more bandwidth (file goes through your server)
- Edge Functions have size limits (6MB for Supabase)
- Need chunking for large files

## Recommended Action

**For now:** Check console logs to confirm it's CORS/NetworkingError

**Short-term:** Add Wasabi CORS policy (Option 1)

**Long-term:** Implement presigned URL approach (Option 2) for mobile reliability

## Testing
Have Shawn check console for:
- 🔴 "NETWORK ERROR - Possible causes" log
- Look for: `cors: 'Wasabi CORS policy may be blocking mobile browsers'`
- Error code should be `NetworkingError`

