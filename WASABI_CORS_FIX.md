# Fix Wasabi CORS Issues

## The Problem

Videos are showing this error:
```
Access to video at 'https://shoutoutorders.s3.us-central-1.wasabisys.com/...' 
from origin 'https://shoutout.us' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## The Solution

Add CORS configuration to your Wasabi bucket.

### Steps to Fix

1. **Log into Wasabi Console**
   - Go to: https://console.wasabisys.com/
   - Navigate to your `shoutoutorders` bucket

2. **Set CORS Configuration**
   - Click on the bucket name
   - Go to "Settings" tab
   - Find "CORS Configuration" section
   - Click "Edit"

3. **Add This CORS Policy**

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://shoutout.us",
      "http://localhost:3000"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

4. **Save the Configuration**

### What This Does

- **AllowedOrigins**: Allows requests from `shoutout.us` and localhost (for development)
- **AllowedMethods**: Allows GET and HEAD requests (needed for video loading)
- **AllowedHeaders**: Allows all headers
- **MaxAgeSeconds**: Browsers cache this policy for 3000 seconds

### Testing

After adding CORS policy:

1. Clear browser cache or open incognito window
2. Go to https://shoutout.us
3. Videos should now load properly
4. Check console - CORS errors should be gone

### Also Add CORS to `shoutout-assets` Bucket

Repeat the same steps for the `shoutout-assets` bucket (used for images).

## Alternative: Use CloudFlare (Later)

Once you set up CloudFlare CDN properly:
- CloudFlare will handle CORS for you
- Videos will load through `videos.shoutout.us`
- Better performance and caching

But for now, direct Wasabi access with CORS policy will work fine!

