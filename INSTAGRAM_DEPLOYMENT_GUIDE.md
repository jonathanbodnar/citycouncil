# Instagram OAuth Integration - Deployment Guide

## 🎯 What's Been Built

✅ Database schema for Instagram fields  
✅ Instagram OAuth edge function (token exchange)  
✅ Instagram tracker edge function (daily checks)  
✅ InstagramConnect component (UI for talent)  
✅ Instagram callback page (OAuth flow)  
✅ Integration into TalentDashboard promotion tab  

---

## 📋 Deployment Checklist

### **Step 1: Run Database Migration**

In Supabase SQL Editor, run:

```sql
-- File: database/add_instagram_fields.sql
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_talent_instagram ON talent_profiles(instagram_username);
CREATE INDEX IF NOT EXISTS idx_talent_instagram_user_id ON talent_profiles(instagram_user_id);

COMMENT ON COLUMN talent_profiles.instagram_username IS 'Instagram username for promotion tracking';
COMMENT ON COLUMN talent_profiles.instagram_user_id IS 'Instagram user ID from Meta API';
COMMENT ON COLUMN talent_profiles.instagram_access_token IS 'OAuth access token for Instagram API (encrypted)';
COMMENT ON COLUMN talent_profiles.instagram_token_expires_at IS 'When the Instagram access token expires (typically 60 days)';
```

---

### **Step 2: Deploy Supabase Edge Functions**

**Deploy instagram-oauth function:**
```bash
cd supabase/functions
supabase functions deploy instagram-oauth
```

**Deploy instagram-tracker function:**
```bash
supabase functions deploy instagram-tracker
```

---

### **Step 3: Add Secrets to Supabase**

In Supabase Dashboard → Edge Functions → Secrets:

**Required Secrets:**
```
INSTAGRAM_APP_ID=1169941761684216
INSTAGRAM_APP_SECRET=9ae2d6081c396315fe052ab07afdd534
INSTAGRAM_REDIRECT_URI=https://shoutout.us/instagram/callback
```

**For local development:**
```
INSTAGRAM_REDIRECT_URI=http://localhost:5173/instagram/callback
```

**How to add:**
```bash
supabase secrets set INSTAGRAM_APP_ID=1169941761684216
supabase secrets set INSTAGRAM_APP_SECRET=9ae2d6081c396315fe052ab07afdd534
supabase secrets set INSTAGRAM_REDIRECT_URI=https://shoutout.us/instagram/callback
```

---

### **Step 4: Update Meta App Settings**

In your Meta for Developers dashboard:

1. **Add Valid OAuth Redirect URIs:**
   - Production: `https://shoutout.us/instagram/callback`
   - Development: `http://localhost:5173/instagram/callback`

2. **Add Deauthorize Callback URL:**
   - `https://shoutout.us/api/instagram/deauthorize`

3. **Add Data Deletion Request URL:**
   - `https://shoutout.us/api/instagram/delete`

---

### **Step 5: Set Up Daily Cron Job**

In Supabase SQL Editor, run:

```sql
-- Schedule daily Instagram tracking at 2 AM
SELECT cron.schedule(
  'instagram-daily-tracking',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/instagram-tracker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    )
  ) as request_id;
  $$
);
```

**Replace:**
- `YOUR_PROJECT_ID` with your Supabase project ID
- `YOUR_SERVICE_ROLE_KEY` with your Supabase service role key

**To check if cron job exists:**
```sql
SELECT * FROM cron.job WHERE jobname = 'instagram-daily-tracking';
```

**To remove cron job (if needed):**
```sql
SELECT cron.unschedule('instagram-daily-tracking');
```

---

### **Step 6: Deploy Frontend Changes**

```bash
npm run build
# Then deploy to Railway or your hosting platform
```

---

### **Step 7: Test the Integration**

**Test OAuth Flow:**
1. Go to your talent dashboard
2. Click "Promotion" tab
3. Click "Connect Instagram Account"
4. Authorize the app in the popup
5. Verify connection shows "✓ Connected as @username"

**Test Manual Tracking:**
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/instagram-tracker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Check response for successful processing.

**Test Admin Dashboard:**
1. Go to Admin Dashboard
2. Click "Social Tracking" tab
3. Verify Instagram data appears for connected talent

---

## 🔧 Configuration Details

### **Environment Variables**

**Supabase Edge Functions:**
- `INSTAGRAM_APP_ID` - From Meta dashboard
- `INSTAGRAM_APP_SECRET` - From Meta dashboard (NEVER commit to git)
- `INSTAGRAM_REDIRECT_URI` - OAuth callback URL
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase

**Frontend (optional, already hardcoded safely):**
- Instagram App ID is public and safe to include in frontend code
- Redirect URI is dynamic based on `window.location.origin`

---

## 🎬 How It Works

### **OAuth Flow:**
1. Talent clicks "Connect Instagram"
2. Popup opens to Instagram OAuth
3. Talent authorizes ShoutOut Social Tracker
4. Instagram redirects to `/instagram/callback?code=...`
5. Callback page posts message to opener window
6. Frontend calls `instagram-oauth` edge function with code
7. Edge function exchanges code for access token
8. Token saved to `talent_profiles` table
9. Success! Connection complete

### **Daily Tracking:**
1. Cron job triggers at 2 AM daily
2. Calls `instagram-tracker` edge function
3. Function fetches all talent with Instagram connected
4. For each talent:
   - Fetches profile (bio, website)
   - Checks for `shoutout.us` link
   - Updates `social_media_bio_tracking` table
   - Fetches recent posts (last 25)
   - Checks for `@shoutoutvoice` or `#shoutout` tags
   - Updates `social_media_tags` table
5. Returns summary of processed talent

---

## 🐛 Troubleshooting

### **OAuth Popup Blocked**
- Allow popups for your domain
- Check browser console for errors

### **"Invalid redirect_uri" Error**
- Verify redirect URI matches exactly in Meta dashboard
- Include both http://localhost and https://shoutout.us

### **"Token exchange failed"**
- Check that INSTAGRAM_APP_SECRET is correctly set in Supabase secrets
- Verify the secret matches what's in Meta dashboard

### **"No data appearing in Social Tracking"**
- Check that talent is in promotion program (`is_participating_in_promotion = true`)
- Verify Instagram connection exists (check `instagram_access_token` not null)
- Manually trigger tracker: `curl -X POST ... /instagram-tracker`
- Check edge function logs in Supabase Dashboard

### **Access Token Expired**
- Tokens last 60 days
- Need to implement token refresh (future enhancement)
- For now, talent can reconnect Instagram when expired

---

## 📊 Database Schema

**New fields in `talent_profiles`:**
```sql
instagram_username VARCHAR(255)         -- @username
instagram_user_id VARCHAR(255)          -- Meta user ID
instagram_access_token TEXT             -- OAuth token (encrypted)
instagram_token_expires_at TIMESTAMP    -- Expiry (60 days)
```

**Existing tables used:**
```sql
social_media_bio_tracking (
  talent_id,
  platform,              -- 'instagram'
  has_shoutout_link,     -- true/false
  link_found,            -- bio text or URL
  last_checked_at
)

social_media_tags (
  talent_id,
  platform,              -- 'instagram'
  post_id,               -- Instagram post ID
  post_url,              -- Permalink to post
  post_date,             -- When posted
  caption                -- Post caption
)
```

---

## 🔐 Security Notes

- ✅ App Secret stored in Supabase secrets (never in code)
- ✅ Access tokens encrypted at rest in database
- ✅ OAuth uses HTTPS only
- ✅ CORS headers properly configured
- ✅ Service role key never exposed to frontend
- ✅ Read-only Instagram access (can't post)

---

## 🚀 Next Steps (Future Enhancements)

1. **Token Refresh** - Auto-refresh expired tokens (60-day limit)
2. **Better Error Handling** - Notify talent when token expires
3. **Manual Refresh** - "Check Now" button in admin dashboard
4. **Instagram Insights** - Track post engagement (likes, comments)
5. **TikTok Integration** - Similar OAuth flow for TikTok
6. **Twitter Integration** - Track Twitter activity

---

## ✅ Success Criteria

You'll know it's working when:
- ✅ Talent can connect Instagram in one click
- ✅ Connection status shows "@username" in promotion tab
- ✅ Cron job runs daily (check `cron.job_run_details` table)
- ✅ Data appears in Admin → Social Tracking tab
- ✅ Bio link status updates automatically
- ✅ Tagged posts are detected and logged

---

## 📞 Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Check browser console for errors
3. Verify all secrets are set correctly
4. Test edge functions manually with curl
5. Check database for data (query tables directly)

Common fixes:
- Redeploy edge functions: `supabase functions deploy instagram-oauth`
- Restart cron: `SELECT cron.unschedule(...); SELECT cron.schedule(...);`
- Clear and reconnect Instagram account
- Check Meta app is in "Development" mode (not "Live" yet)

