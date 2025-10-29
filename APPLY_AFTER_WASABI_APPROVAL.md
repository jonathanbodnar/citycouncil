# Code Changes to Apply After Wasabi Approval

**DO NOT APPLY THESE CHANGES UNTIL WASABI CONFIRMS PUBLIC ACCESS IS ENABLED**

Once Wasabi sends confirmation that public access is enabled for your buckets, apply these changes to switch from pre-signed URLs to CloudFlare CDN URLs.

---

## **Changes Overview**

We need to update two files to use CloudFlare CDN URLs instead of pre-signed URLs:
1. `src/services/videoUpload.ts` - For video uploads
2. `src/services/wasabiUpload.ts` - For image uploads

---

## **File 1: src/services/videoUpload.ts**

**Replace the upload function with:**

```typescript
export const uploadVideoToWasabi = async (
  file: File, 
  orderId: string
): Promise<UploadResponse> => {
  try {
    // Validate file
    if (!file.type.startsWith('video/')) {
      return { success: false, error: 'Please select a video file' };
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      return { success: false, error: 'Video must be less than 100MB' };
    }

    // Upload to Wasabi S3
    const AWS = (await import('aws-sdk')).default;
    
    const wasabi = new AWS.S3({
      endpoint: 's3.us-central-1.wasabisys.com',
      accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID!,
      secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY!,
      region: 'us-central-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4'
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `videos/${orderId}-${Date.now()}.${fileExt}`;
    
    const uploadParams = {
      Bucket: 'shoutoutorders',
      Key: fileName,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read', // NOW ALLOWED AFTER APPROVAL
    };

    await wasabi.upload(uploadParams).promise();
    
    // Use CloudFlare CDN URL instead of Wasabi direct URL
    const videoUrl = `https://videos.shoutout.us/${fileName}`;
    
    return {
      success: true,
      videoUrl: videoUrl
    };

  } catch (error) {
    console.error('Video upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
};
```

**Key changes:**
- Added `ACL: 'public-read'` (now allowed)
- Changed URL from pre-signed to CloudFlare: `https://videos.shoutout.us/${fileName}`
- Removed pre-signed URL generation

---

## **File 2: src/services/wasabiUpload.ts**

**Replace the upload function with:**

```typescript
export const uploadImageToWasabi = async (
  file: File, 
  uploadPath: string
): Promise<UploadResponse> => {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Please select an image file' };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return { success: false, error: 'Image must be less than 5MB' };
    }

    // Upload to Wasabi S3
    const AWS = (await import('aws-sdk')).default;
    
    const wasabi = new AWS.S3({
      endpoint: 's3.us-central-1.wasabisys.com',
      accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID!,
      secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY!,
      region: 'us-central-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4'
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `${uploadPath}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const uploadParams = {
      Bucket: 'shoutout-assets',
      Key: fileName,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read', // NOW ALLOWED AFTER APPROVAL
    };

    await wasabi.upload(uploadParams).promise();
    
    // Use CloudFlare CDN URL instead of Wasabi direct URL
    const imageUrl = `https://assets.shoutout.us/${fileName}`;
    
    return {
      success: true,
      imageUrl: imageUrl
    };

  } catch (error) {
    console.error('Image upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
};
```

**Key changes:**
- Added `ACL: 'public-read'` (now allowed)
- Changed URL from pre-signed to CloudFlare: `https://assets.shoutout.us/${fileName}`
- Removed pre-signed URL generation

---

## **File 3: migrate-base64-to-wasabi.js**

**Update the uploadToWasabi function:**

Find this section (around line 63):
```javascript
const uploadParams = {
  Bucket: bucket,
  Key: fileName,
  Body: buffer,
  ContentType: mimeType,
};
```

Change to:
```javascript
const uploadParams = {
  Bucket: bucket,
  Key: fileName,
  Body: buffer,
  ContentType: mimeType,
  ACL: 'public-read'
};
```

Then find (around line 70):
```javascript
// Generate pre-signed URL (7 days expiry)
const signedUrl = wasabi.getSignedUrl('getObject', {
  Bucket: bucket,
  Key: fileName,
  Expires: 604800 // 7 days
});

return signedUrl;
```

Replace with:
```javascript
// Generate CloudFlare CDN URL
const cdnUrl = bucket === 'shoutoutorders'
  ? `https://videos.shoutout.us/${fileName}`
  : `https://assets.shoutout.us/${fileName}`;

return cdnUrl;
```

---

## **Step-by-Step Application Process**

Once Wasabi confirms approval:

1. **Test that public access is enabled:**
   ```bash
   # Try accessing a file directly (should return 200, not 403)
   curl -I https://s3.us-central-1.wasabisys.com/shoutoutorders/videos/test.mp4
   ```

2. **Apply the code changes** using the snippets above

3. **Run migration to update existing URLs:**
   ```bash
   node migrate-base64-to-wasabi.js
   ```
   This will update any remaining old URLs to use CloudFlare CDN

4. **Test uploads:**
   - Upload a test image (profile picture)
   - Upload a test video (promo video)
   - Verify URLs start with `https://assets.shoutout.us/` or `https://videos.shoutout.us/`

5. **Deploy changes:**
   ```bash
   npm run build
   # Deploy to Railway
   ```

---

## **Benefits After This Change**

✅ **No URL expiration** - CloudFlare URLs work permanently  
✅ **90%+ cache hit rate** - Faster loads, lower Wasabi costs  
✅ **Global CDN** - CloudFlare serves from nearest edge location  
✅ **Automatic HTTPS** - CloudFlare handles SSL certificates  
✅ **Better performance** - CloudFlare is much faster than direct Wasabi  

---

## **What to Expect**

- **Old pre-signed URLs** will stop working after 7 days (expected)
- **New uploads** will use CloudFlare URLs and work forever
- **Existing migrated files** need to be re-migrated to get permanent URLs
- **Total downtime:** ~5 minutes while you deploy

---

## **Troubleshooting**

If images still don't load after applying changes:

1. **Check Wasabi bucket policy:**
   - Should allow public GetObject
   - Contact Wasabi if still getting 403 errors

2. **Check CloudFlare DNS:**
   ```bash
   nslookup assets.shoutout.us
   nslookup videos.shoutout.us
   ```
   Should show CloudFlare IPs

3. **Test direct Wasabi access first:**
   ```bash
   curl -I https://s3.us-central-1.wasabisys.com/shoutout-assets/test.jpg
   ```
   Should return 200 OK

4. **Then test CloudFlare:**
   ```bash
   curl -I https://assets.shoutout.us/test.jpg
   ```
   Should also return 200 OK

---

## **Contact Me When Ready**

Let me know when Wasabi confirms approval and I'll help you apply these changes!

