# Wasabi CORS Setup - Required for Video Uploads

## The Problem

Even though your Wasabi buckets are public, browsers are blocking the uploads due to missing CORS headers. This causes the error:

```
Access to XMLHttpRequest at 'https://s3.us-central-1.wasabisys.com/shoutoutorders'
from origin 'https://shoutout.us' has been blocked by CORS policy
```

## The Solution

You need to add CORS configuration to BOTH Wasabi buckets.

### Step 1: Log into Wasabi Console

Go to: https://console.wasabisys.com/

### Step 2: Configure CORS for `shoutoutorders` bucket

1. Click on the `shoutoutorders` bucket
2. Go to **Settings** tab
3. Find **CORS Configuration** section
4. Click **Edit**
5. **Try JSON format first** (most Wasabi interfaces prefer this):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["https://shoutout.us", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

6. Click **Save**

**If you get a syntax error with JSON**, try the XML format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://shoutout.us</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

### Step 3: Configure CORS for `shoutout-assets` bucket

Repeat the same steps for the `shoutout-assets` bucket with the same XML configuration.

### Step 4: Test

After saving:
1. Wait 1-2 minutes for changes to propagate
2. Try uploading a video during onboarding
3. Check browser console - CORS errors should be gone

## Alternative: JSON Format

If Wasabi's interface prefers JSON, use this instead:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["https://shoutout.us", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Verify CORS is Working

After setup, you can test CORS with curl:

```bash
curl -H "Origin: https://shoutout.us" \
     -H "Access-Control-Request-Method: PUT" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://shoutoutorders.s3.us-central-1.wasabisys.com/
```

If CORS is configured correctly, you should see `Access-Control-Allow-Origin: https://shoutout.us` in the response headers.

## What This Does

- **AllowedOrigin**: Tells Wasabi to accept requests from shoutout.us
- **AllowedMethods**: Permits GET (download), PUT/POST (upload), HEAD (check)
- **AllowedHeader**: Allows all request headers (*)
- **ExposeHeader**: Makes ETag available to JavaScript
- **MaxAgeSeconds**: Browsers cache this CORS policy for 50 minutes

## Temporary Workaround

Until CORS is configured, onboarding will complete without the promo video. Users can upload it later from their dashboard.

