# View Tracking Diagnostic Checklist

Run through these steps to diagnose why view tracking isn't working:

## Step 1: Check if Database Table Exists

Run this in Supabase SQL Editor:
```sql
SELECT EXISTS (
  SELECT FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename = 'bio_page_views'
);
```

**Expected Result:** `true`

If `false`:
1. Go to Supabase Dashboard > SQL Editor
2. Copy/paste contents from `database/create_bio_page_views_table.sql`
3. Click "Run"

## Step 2: Check if Edge Function is Deployed

1. Go to Supabase Dashboard > Edge Functions
2. Look for `track-bio-view` in the list

If NOT there:
```bash
# Option A: Via CLI (if you have it installed)
cd supabase/functions
supabase functions deploy track-bio-view --no-verify-jwt

# Option B: Via Dashboard
# 1. Go to Edge Functions > Create Function
# 2. Name: track-bio-view
# 3. Copy code from supabase/functions/track-bio-view/index.ts
# 4. Deploy
```

## Step 3: Check Browser Console

1. Open any bio page (e.g., `bio.shoutout.us/username`)
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for errors

**Common errors:**
- `404 Not Found` → Edge function not deployed
- `relation "bio_page_views" does not exist` → Table not created
- `CORS error` → Edge function CORS headers issue

## Step 4: Check if Tracking Call is Being Made

In browser DevTools:
1. Go to Network tab
2. Refresh the bio page
3. Filter for "track-bio-view"
4. Check if request was made and response

**Expected:**
- Status: `200 OK`
- Response: `{"success": true}`

## Step 5: Verify Data is Being Inserted

Run this in Supabase SQL Editor:
```sql
-- Check raw page views
SELECT * FROM bio_page_views ORDER BY viewed_at DESC LIMIT 10;

-- Check aggregated stats
SELECT * FROM bio_page_view_stats;
```

## Step 6: Check Environment Variables

Make sure bio-app has these env vars set:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

Check `.env` file in `bio-app/` directory.

## Quick Fix Commands

### Deploy Edge Function (via Dashboard)
1. Copy `supabase/functions/track-bio-view/index.ts`
2. Go to Supabase Dashboard > Edge Functions > Create
3. Paste and deploy

### Run SQL Script
1. Copy `database/create_bio_page_views_table.sql`
2. Go to Supabase Dashboard > SQL Editor
3. Paste and run

### Test Manually
```bash
# Test the edge function directly
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/track-bio-view' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "talent_id": "some-uuid-here",
    "referrer": "https://google.com"
  }'
```

Expected response: `{"success":true}`

---

## Most Likely Issues (in order):

1. ❌ **Edge function not deployed** - Go deploy it in Supabase Dashboard
2. ❌ **Database table not created** - Run the SQL script
3. ❌ **Environment variables missing** - Check bio-app/.env file
