# Fix JP Sears Upload Issue - Wasabi CORS

## Problem
JP Sears can't upload videos. Console shows:
```
Access to XMLHttpRequest at 'https://s3.us-central-1.wasabisys.com/...'
from origin 'https://dev.shoutout.us' has been blocked by CORS policy
```

## Root Cause
The Wasabi CORS configuration doesn't explicitly include `https://dev.shoutout.us`

## Solution

### Update Wasabi CORS Configuration

1. **Login to Wasabi Console**: https://console.wasabisys.com/
2. **Navigate to**: Buckets > `shoutoutorder` (or your video bucket)
3. **Go to**: Settings > CORS Configuration
4. **Replace with this XML**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://shoutout.us</AllowedOrigin>
    <AllowedOrigin>https://dev.shoutout.us</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-request-id</ExposeHeader>
    <ExposeHeader>x-amz-id-2</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

5. **Save** the configuration

### What Changed
- Added `https://dev.shoutout.us` to allowed origins
- Added additional expose headers for better compatibility

### Test After Update
1. Have JP Sears try uploading again from dev.shoutout.us
2. The CORS error should be gone
3. Upload should proceed normally

### Alternative: Use Railway Production Domain
If you want to avoid this issue in the future, you could:
1. Set up a custom domain for production: `https://app.shoutout.us` or just use `https://shoutout.us`
2. Point Railway production to that domain
3. Keep `dev.shoutout.us` for development branch

## Notes
- The `*` wildcard should work, but Wasabi sometimes requires explicit domains listed first
- CORS changes take effect immediately
- No server restart needed

