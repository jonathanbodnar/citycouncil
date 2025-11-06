# CSP Video Upload Fix

## Issue:
Image and video uploads were being blocked by Content Security Policy (CSP) on `/onboard` and potentially other pages.

## Root Cause:
The CSP `connectSrc` directive in `server.js` was missing Wasabi S3 domains, preventing the AWS SDK from making HTTPS connections to Wasabi for uploads.

## Fix Applied:
Updated `server.js` to add Wasabi domains to CSP:

```javascript
connectSrc: [
  "'self'", 
  "https://*.supabase.co", 
  "wss://*.supabase.co",
  "https://api.fortis.tech",
  "https://*.fortis.tech",
  "https://*.wasabisys.com",  // ✅ Added
  "https://s3.us-central-1.wasabisys.com"  // ✅ Added
],
```

## What This Fixes:

### ✅ Image Uploads
- **Location**: `/onboard` Step 2 (Profile Picture)
- **Service**: `wasabiUpload.ts` → `uploadImageToWasabi()`
- **Bucket**: `shoutout-assets`
- **Endpoint**: `s3.us-central-1.wasabisys.com`

### ✅ Video Uploads
- **Location 1**: `/onboard` Step 4 (Promo Video)
- **Location 2**: Talent Dashboard (Fulfillment Video)
- **Location 3**: Admin Pre-made Talent Onboarding
- **Service**: `videoUpload.ts` → `uploadVideoToWasabi()`
- **Bucket**: `shoutoutorders`
- **Endpoint**: `s3.us-central-1.wasabisys.com`

## Upload Flow:
1. User selects image/video file
2. Frontend validates file (type, size)
3. AWS SDK initializes with Wasabi endpoint
4. SDK makes HTTPS PUT request to `s3.us-central-1.wasabisys.com`
5. CSP checks `connectSrc` directive
6. ✅ Request allowed (now that Wasabi domains are in CSP)
7. File uploads to Wasabi bucket
8. Public URL returned: `https://[bucket].s3.us-central-1.wasabisys.com/[path]`

## Browser Console Errors (Before Fix):
```
Refused to connect to 'https://s3.us-central-1.wasabisys.com/...' 
because it violates the following Content Security Policy directive: 
"connect-src 'self' https://*.supabase.co..."
```

## Testing:
1. ✅ `/onboard` - Profile picture upload
2. ✅ `/onboard` - Promo video upload
3. ✅ Talent Dashboard - Fulfillment video upload
4. ✅ Admin - Pre-made talent promo video upload

## Related Files:
- `server.js` - CSP configuration
- `src/services/wasabiUpload.ts` - Image upload service
- `src/services/videoUpload.ts` - Video upload service
- `src/components/ImageUpload.tsx` - Image upload component
- `src/pages/PublicTalentOnboardingPage.tsx` - Public onboarding

## Security Notes:
- Wasabi domains are trusted for file uploads
- AWS SDK uses signed requests (v4 signatures)
- Public read ACL is set on uploads (intentional)
- CORS is configured on Wasabi buckets
- CSP still blocks other untrusted domains

## Deployment:
- ✅ Committed to `live` branch
- ✅ Building on Railway
- ⏳ Waiting for deployment

## Next Steps:
1. ✅ Fix build error (emailService.sendEmail signature) - DONE
2. ⏳ Test image upload on `/onboard` after deployment
3. ⏳ Test video upload on `/onboard` after deployment
4. 🔄 Optimize `/onboard` for mobile (no scroll)

