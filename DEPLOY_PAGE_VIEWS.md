# Deploy Page View Tracking System

This guide will help you deploy the new page view tracking system for bio pages.

## 🎯 What This Does

- **Tracks every bio page view** with detailed analytics (IP hash, country, referrer, UTM params)
- **Real-time view counter** in the BioDashboard header (replaces "Published" badge)
- **Privacy-focused**: IPs are hashed, not stored raw
- **Session-based unique views**: Tracks unique visitors via session IDs

## 📋 Deployment Steps

### Step 1: Create Database Table

Run this SQL in your Supabase SQL Editor:

```sql
-- See: database/create_bio_page_views_table.sql
```

Or copy/paste from `database/create_bio_page_views_table.sql`

This creates:
- `bio_page_views` table for raw tracking data
- `bio_page_view_stats` view for aggregated stats
- Proper indexes for fast queries
- RLS policies for security

### Step 2: Deploy Edge Function

You have two options:

**Option A: Via Supabase CLI** (if installed)
```bash
cd /Users/jonathanbodnar/ShoutOut
supabase functions deploy track-bio-view --no-verify-jwt
```

**Option B: Via Supabase Dashboard**
1. Go to Supabase Dashboard > Edge Functions
2. Create new function named `track-bio-view`
3. Copy contents from `supabase/functions/track-bio-view/index.ts`
4. Deploy

### Step 3: Deploy Bio App

The bio app changes are already in the code:
- `BioDashboard.tsx` - Shows view stats in header
- `BioPage.tsx` - Tracks views on page load

Just deploy the bio app as usual:
```bash
cd bio-app
npm run build
# Deploy to your hosting
```

### Step 4: Deploy Main App (Optional)

If you want to test locally first:
```bash
npm run build
# Deploy to production
```

## ✅ Verification

1. Visit any bio page (e.g., `bio.shoutout.us/username`)
2. Open BioDashboard for that talent
3. You should see view stats in the header where "Published" used to be
4. Stats update every 30 seconds automatically

## 📊 What Gets Tracked

- **Total Views**: All-time page views
- **Unique Views**: Based on session IDs (30-min sessions)
- **Last 24h**: Views in the last 24 hours
- **Last 7d**: Views in the last 7 days
- **Last 30d**: Views in the last 30 days
- **Referrer**: Where the visitor came from
- **UTM Parameters**: Marketing campaign tracking
- **Country/City**: Geographic data (from Cloudflare headers)

## 🔒 Privacy

- IP addresses are hashed with SHA-256 before storage
- No raw IPs are ever stored
- User agents are truncated to 500 chars
- Session IDs expire after 30 minutes

## 🎨 UI Changes

**Before:**
```
[Published] badge in header
```

**After:**
```
┌─────────────────────────────────┐
│ 👁️ Views        │ Last 24h      │
│    1,234        │    45         │
└─────────────────────────────────┘
```

## 🐛 Troubleshooting

**Views not tracking?**
- Check edge function logs in Supabase Dashboard
- Verify `track-bio-view` function is deployed
- Check browser console for errors

**Stats not showing?**
- Verify `bio_page_view_stats` view exists
- Check RLS policies on `bio_page_views` table
- Refresh the dashboard (stats update every 30s)

**Stats showing 0?**
- Visit the bio page first to generate a view
- Wait 30 seconds for stats to refresh
- Check if table has data: `SELECT * FROM bio_page_views LIMIT 10;`
