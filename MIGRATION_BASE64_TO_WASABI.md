# Migration Guide: Base64 to Wasabi URLs

## Problem
After switching from base64 encoding to Wasabi S3 storage, existing database records still contain base64-encoded images/videos instead of Wasabi URLs. This causes:
- **ERR_QUIC_PROTOCOL_ERROR** when loading pages
- Failed to fetch errors
- App not loading

## Solution Options

### Option 1: Clear Old Data (Quick Fix - Recommended for Testing)

If you don't need to preserve existing videos/images, simply reset the affected records:

```sql
-- Clear promo videos that are base64 encoded
UPDATE talent_profiles 
SET promo_video_url = NULL 
WHERE promo_video_url LIKE 'data:%';

-- Clear temp avatars that are base64 encoded
UPDATE talent_profiles 
SET temp_avatar_url = NULL 
WHERE temp_avatar_url LIKE 'data:%';

-- Clear user avatars that are base64 encoded
UPDATE users 
SET avatar_url = NULL 
WHERE avatar_url LIKE 'data:%';

-- Clear order videos that are base64 encoded
UPDATE orders 
SET video_url = NULL 
WHERE video_url LIKE 'data:%';
```

### Option 2: Migrate Existing Base64 to Wasabi (Preserve Data) - AUTOMATED SCRIPT

If you need to keep existing images/videos, we have a ready-to-run migration script!

**Quick Start:**

1. **Install dependencies** (if not already installed):
```bash
npm install dotenv
```

2. **Set environment variables** (choose one method):

**Method A: Use existing .env file**
Your `.env` file should already have these (or add them):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REACT_APP_WASABI_ACCESS_KEY_ID=your-wasabi-key
REACT_APP_WASABI_SECRET_ACCESS_KEY=your-wasabi-secret
```

**Method B: Set inline**
```bash
SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key REACT_APP_WASABI_ACCESS_KEY_ID=your-wasabi-key REACT_APP_WASABI_SECRET_ACCESS_KEY=your-wasabi-secret node migrate-base64-to-wasabi.js
```

3. **Run the migration**:
```bash
node migrate-base64-to-wasabi.js
```

The script will:
- ✅ Find all base64-encoded images/videos
- ✅ Upload them to Wasabi S3
- ✅ Update database with new URLs
- ✅ Show progress and statistics
- ✅ Handle errors gracefully

**Sample Output:**
```
╔════════════════════════════════════════════════════╗
║  Base64 to Wasabi Migration Script                ║
╚════════════════════════════════════════════════════╝

📹 Migrating talent promo videos...

Found 3 promo videos to migrate

Processing: Jonathan Bodnar
  📦 Uploading promo-abc123-1234567890.mp4 (8.50MB) to shoutoutorders...
  ✅ Migrated successfully: https://s3.us-central-1.wasabisys.com/shoutoutorders/videos/promo-abc123-1234567890.mp4

...

╔════════════════════════════════════════════════════╗
║  Migration Complete                                ║
╚════════════════════════════════════════════════════╝

📊 Summary:
   Total items:     12
   ✅ Successful:   12
   ❌ Failed:       0
   ⏱️  Duration:     45.32s

🎉 All items migrated successfully!
```

---

### Manual Migration Example (if you prefer to customize):

```javascript
// migration-script.js
const { createClient } = require('@supabase/supabase-js');
const AWS = require('aws-sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const wasabi = new AWS.S3({
  endpoint: 's3.us-central-1.wasabisys.com',
  accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
  secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
  region: 'us-central-1',
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

async function migrateBase64ToWasabi() {
  // Get all records with base64 data
  const { data: profiles, error } = await supabase
    .from('talent_profiles')
    .select('id, promo_video_url, temp_avatar_url')
    .or('promo_video_url.like.data:%,temp_avatar_url.like.data:%');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  for (const profile of profiles) {
    // Migrate promo video
    if (profile.promo_video_url?.startsWith('data:')) {
      try {
        const base64Data = profile.promo_video_url.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = profile.promo_video_url.split(':')[1].split(';')[0];
        const extension = mimeType.split('/')[1];
        
        const fileName = `videos/promo-${profile.id}-${Date.now()}.${extension}`;
        
        const uploadResult = await wasabi.upload({
          Bucket: 'shoutoutorders',
          Key: fileName,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'public-read'
        }).promise();

        // Update database
        await supabase
          .from('talent_profiles')
          .update({ promo_video_url: uploadResult.Location })
          .eq('id', profile.id);

        console.log(`✅ Migrated promo video for profile ${profile.id}`);
      } catch (error) {
        console.error(`❌ Failed to migrate promo video for profile ${profile.id}:`, error);
      }
    }

    // Migrate avatar
    if (profile.temp_avatar_url?.startsWith('data:')) {
      try {
        const base64Data = profile.temp_avatar_url.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = profile.temp_avatar_url.split(':')[1].split(';')[0];
        const extension = mimeType.split('/')[1];
        
        const fileName = `avatars/temp-${profile.id}-${Date.now()}.${extension}`;
        
        const uploadResult = await wasabi.upload({
          Bucket: 'shoutout-assets',
          Key: fileName,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'public-read'
        }).promise();

        // Update database
        await supabase
          .from('talent_profiles')
          .update({ temp_avatar_url: uploadResult.Location })
          .eq('id', profile.id);

        console.log(`✅ Migrated avatar for profile ${profile.id}`);
      } catch (error) {
        console.error(`❌ Failed to migrate avatar for profile ${profile.id}:`, error);
      }
    }
  }

  console.log('Migration complete!');
}

migrateBase64ToWasabi();
```

Run with:
```bash
node migration-script.js
```

### Option 3: Frontend Fallback (Temporary Solution)

Add fallback handling in the frontend to skip base64 images:

```typescript
// In TalentCard.tsx or wherever images are displayed
const imageUrl = talent.temp_avatar_url?.startsWith('data:') 
  ? null 
  : talent.temp_avatar_url;

// Use imageUrl, will show placeholder if null
```

## Recommended Approach

**For immediate fix:**
1. Run Option 1 SQL queries to clear base64 data
2. Have talent re-upload their avatars/videos
3. This ensures all new uploads go to Wasabi

**For production:**
1. Run Option 2 migration script to preserve existing data
2. Schedule maintenance window to run migration
3. Test thoroughly before deploying

## Verification

After migration, verify no base64 data remains:

```sql
-- Check for remaining base64 data
SELECT COUNT(*) as base64_promo_videos
FROM talent_profiles 
WHERE promo_video_url LIKE 'data:%';

SELECT COUNT(*) as base64_temp_avatars
FROM talent_profiles 
WHERE temp_avatar_url LIKE 'data:%';

SELECT COUNT(*) as base64_avatars
FROM users 
WHERE avatar_url LIKE 'data:%';

SELECT COUNT(*) as base64_order_videos
FROM orders 
WHERE video_url LIKE 'data:%';
```

All counts should be 0.

## Wasabi CORS Configuration

Ensure Wasabi buckets have proper CORS configuration:

1. Go to Wasabi Console → Buckets
2. Select bucket → Settings → CORS Configuration
3. Add:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://shoutout.us</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

## Next Steps

1. Choose migration option based on your needs
2. Run migration
3. Verify no base64 data remains
4. Test app thoroughly
5. Monitor for any ERR_QUIC_PROTOCOL_ERROR errors

