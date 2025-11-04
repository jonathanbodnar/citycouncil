# Bulk Video Upload Setup Guide

This feature allows admins to mass upload historical videos and map them to talent profiles.

---

## 🗄️ Database Setup

### Step 1: Add Historical Orders Support

Run this in **Supabase SQL Editor**:

```sql
-- Add is_historical column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN orders.is_historical IS 'Marks orders that were uploaded as historical data (not real customer orders)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_orders_is_historical 
ON orders(is_historical) 
WHERE is_historical = false;

-- Create or replace the increment_talent_orders function
CREATE OR REPLACE FUNCTION increment_talent_orders(
  talent_profile_id UUID,
  is_fulfilled BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  IF is_fulfilled THEN
    UPDATE talent_profiles
    SET 
      total_orders = total_orders + 1,
      fulfilled_orders = fulfilled_orders + 1
    WHERE id = talent_profile_id;
  ELSE
    UPDATE talent_profiles
    SET total_orders = total_orders + 1
    WHERE id = talent_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_talent_orders TO authenticated;
```

Or run the file:
```
database/add_historical_orders.sql
```

---

## 🧹 Clear Test Data (OPTIONAL)

If you want to clear all test orders and analytics data, run this in **Supabase SQL Editor**:

```sql
BEGIN;

-- Clear all orders and related data
DELETE FROM reviews;
DELETE FROM notifications WHERE order_id IS NOT NULL;
DELETE FROM orders;

-- Reset talent statistics to zero
UPDATE talent_profiles SET
  total_orders = 0,
  fulfilled_orders = 0,
  average_rating = 0.0,
  avg_delivery_time_hours = NULL
WHERE total_orders > 0 OR fulfilled_orders > 0 OR average_rating > 0;

-- Clear social media tracking data
DELETE FROM instagram_activity_tracking;

-- Clear watermarked video cache
DELETE FROM watermarked_videos_cache;

COMMIT;
```

Or run the file:
```
database/clear_test_data.sql
```

**⚠️ WARNING:** This will permanently delete all orders! Make sure to backup any data you want to keep.

---

## 📝 How to Use the Bulk Upload Feature

### Access the Feature

1. Go to **Admin Dashboard** → `https://shoutout.us/admin`
2. Click the **"Bulk Upload"** tab
3. You'll see the bulk video upload interface

---

### Upload Process

#### Step 1: Select Videos
- Click **"Select Videos"** or drag and drop
- Select multiple video files from your computer
- Supported formats: MP4, MOV, AVI, etc.
- Max file size: 300MB per video

#### Step 2: Assign to Talent
For each video:
- **Select Talent** (required) - Choose which talent profile this video belongs to
- **Recipient Name** (optional) - Who the video was for
- **Occasion** (optional) - Birthday, Anniversary, etc.

#### Step 3: Upload
- Click **"Upload All"** to start the batch upload
- Videos are uploaded sequentially (one at a time to avoid overwhelming the system)
- Progress bars show upload status for each video

#### Step 4: Review
- ✅ **Success**: Video uploaded and added to talent's profile
- ❌ **Error**: Shows error message (can retry or remove)
- Clear completed uploads to clean up the list

---

## 🎯 What Happens When You Upload

1. **Video is uploaded** to Wasabi S3 storage
2. **Order record is created** with:
   - Status: `delivered`
   - Historical flag: `is_historical = true`
   - Video URL: Link to uploaded video
   - Talent assignment: Linked to selected talent
3. **Talent statistics are updated**:
   - `total_orders` incremented
   - `fulfilled_orders` incremented
4. **Video appears** on talent's profile under "Recent Videos"

---

## 📊 Historical vs Regular Orders

### Historical Orders
- Marked with `is_historical = true`
- Don't trigger payment processing
- Don't send customer notifications
- Don't create payout records
- Used for showcasing past work

### Regular Orders
- Created through normal order flow
- Trigger payments and payouts
- Send notifications to users and talent
- Full order management lifecycle

---

## 🔍 Filtering Historical Orders

In the admin panel, you can filter to see only real orders:

```sql
-- View only real (non-historical) orders
SELECT * FROM orders WHERE is_historical = false OR is_historical IS NULL;

-- View only historical uploads
SELECT * FROM orders WHERE is_historical = true;

-- Talent stats (excluding historical)
SELECT 
  t.temp_full_name,
  COUNT(o.id) FILTER (WHERE o.is_historical = false) as real_orders,
  COUNT(o.id) FILTER (WHERE o.is_historical = true) as historical_orders
FROM talent_profiles t
LEFT JOIN orders o ON t.id = o.talent_id
GROUP BY t.id, t.temp_full_name;
```

---

## 🎬 Example Bulk Upload Workflow

### Scenario: Uploading 50 Old Videos

**1. Prepare your videos**
```
old-videos/
  ├── tucker-birthday-jan2024.mp4
  ├── tucker-wedding-feb2024.mp4
  ├── josh-graduation-mar2024.mp4
  └── ... (47 more videos)
```

**2. Go to Admin → Bulk Upload**

**3. Select all 50 videos**

**4. Assign each video:**
- First 2 videos → Tucker Carlson
- Third video → Josh Firestine
- Continue assigning...

**5. Fill in optional details:**
- Video 1: Recipient "John Smith", Occasion "Birthday"
- Video 2: Recipient "Jane Doe", Occasion "Wedding"
- etc.

**6. Click "Upload All"**
- System uploads videos one by one
- Progress bars show status
- Estimated time: ~2-5 minutes for 50 videos (depending on file sizes)

**7. Result:**
- All 50 videos now appear on respective talent profiles
- Statistics updated (total_orders +50, fulfilled_orders +50)
- Videos are marked as historical (won't affect payment analytics)

---

## 🚨 Troubleshooting

### Upload Fails
- **Check file size**: Max 300MB per video
- **Check format**: MP4 is recommended
- **Check internet connection**: Large files need stable connection
- **Try again**: Click retry or re-upload the video

### Video Not Showing on Profile
- Check that talent is selected correctly
- Refresh the talent's profile page
- Verify upload status shows "Success"

### Talent Not in Dropdown
- Make sure talent has `is_active = true`
- Check that talent has completed onboarding
- Talent must exist in `talent_profiles` table

### Statistics Not Updating
- Check that `increment_talent_orders` function exists
- Verify talent_id is correct
- Manually update if needed:
  ```sql
  UPDATE talent_profiles 
  SET 
    total_orders = (SELECT COUNT(*) FROM orders WHERE talent_id = 'TALENT_ID'),
    fulfilled_orders = (SELECT COUNT(*) FROM orders WHERE talent_id = 'TALENT_ID' AND status = 'delivered')
  WHERE id = 'TALENT_ID';
  ```

---

## 📋 Best Practices

1. **Organize videos before uploading**
   - Name files clearly (talent-occasion-date.mp4)
   - Group by talent for easier assignment

2. **Upload in batches**
   - Don't upload 500 videos at once
   - Do 20-50 at a time for manageability

3. **Add metadata**
   - Fill in recipient names and occasions when known
   - Helps with future reference and organization

4. **Test with one video first**
   - Upload a single video to test the process
   - Verify it appears correctly on the talent profile
   - Then proceed with bulk upload

5. **Monitor progress**
   - Watch the progress bars
   - Address any errors immediately
   - Clear completed uploads to reduce clutter

---

## 🔐 Security Notes

- Only admins can access bulk upload
- Videos are uploaded to secure Wasabi S3 storage
- Historical orders are marked to prevent payment processing
- All uploads are logged in the orders table
- Video URLs are private (require authentication to view)

---

## 📊 Analytics Considerations

Historical orders are included in:
- ✅ Total orders count
- ✅ Fulfilled orders count
- ✅ Talent profile statistics
- ✅ "Recent Videos" section on profile

Historical orders are NOT included in:
- ❌ Revenue calculations
- ❌ Payout calculations
- ❌ Customer notification emails
- ❌ Payment processing statistics

To filter them out in analytics:
```sql
SELECT * FROM orders WHERE (is_historical = false OR is_historical IS NULL);
```

---

## ✅ Success Indicators

After uploading:
1. Videos appear in the "Videos to Upload" list with ✓ checkmark
2. Talent statistics increase (check admin analytics)
3. Videos visible on talent profile page under "Recent Videos"
4. Order records created with `is_historical = true`
5. No errors in browser console

---

**Need Help?** Contact your development team or check the error messages in the upload interface.

