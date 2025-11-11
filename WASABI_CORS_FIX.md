# Fix Wasabi CORS for Promo Graphic Generator

## The Issue
Images hosted on Wasabi S3 are being blocked by CORS when loaded in the browser canvas for promo graphic generation.

## Solution: Configure CORS on Wasabi Buckets

### Method 1: Wasabi Console (Easiest)

1. Go to [Wasabi Console](https://console.wasabisys.com/)
2. Click on your bucket: **`shoutout-assets`**
3. Go to **Settings** → **CORS Configuration**
4. Add this CORS policy:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://shoutout.us</AllowedOrigin>
    <AllowedOrigin>https://*.railway.app</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

5. Click **Save**

### Method 2: AWS CLI (if you have it configured)

```bash
# Create a file: cors-config.json
cat > cors-config.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://shoutout.us", "https://*.railway.app", "http://localhost:3000"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply to bucket
aws s3api put-bucket-cors \
  --bucket shoutout-assets \
  --cors-configuration file://cors-config.json \
  --endpoint-url=https://s3.us-central-1.wasabisys.com
```

### What This Does:
- ✅ Allows `https://shoutout.us` to load images in canvas
- ✅ Allows Railway preview URLs for testing
- ✅ Allows localhost for development
- ✅ Only allows safe methods (GET, HEAD)
- ✅ Caches CORS preflight for 1 hour

### Test After Setup:
Try generating the promo graphic again - it should work!

## Alternative: If CORS Still Doesn't Work

If Wasabi CORS config doesn't work for some reason, we can:
1. Use the Edge Function proxy we created (`proxy-image`)
2. Or serve images through Cloudflare (which adds proper CORS headers)

But configuring CORS directly on Wasabi is the cleanest solution.
