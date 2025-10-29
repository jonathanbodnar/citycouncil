# Meta/Instagram API Setup - Step-by-Step Guide

## ✅ Current Step: Create Facebook App (Business Type)

You're on the right track! Select **"Business"** and click **"Next"**.

---

## 📋 Complete Setup Checklist

### **Step 1: Create Facebook App** ✅ (You're here!)

1. ✅ Go to [developers.facebook.com](https://developers.facebook.com/)
2. ✅ Click "Create App"
3. ✅ Select **"Business"** type
4. ⏳ Click "Next"

---

### **Step 2: App Details**

On the next screen, fill in:

**App Name:** `ShoutOut Social Tracker`

**App Contact Email:** `[your email]`

**Business Account:** (Select your business account or create one)

Then click **"Create App"**

---

### **Step 3: Add Instagram Basic Display Product**

1. In your app dashboard, scroll down to "Add Products"
2. Find **"Instagram Basic Display"** 
3. Click **"Set Up"**

**Alternative:** If you want more features, use **"Instagram Graph API"** instead
- Requires Instagram Business Account
- More powerful (can get insights, post content, etc.)
- Better for scaling

**Recommendation:** Start with **Instagram Basic Display** (simpler)

---

### **Step 4: Configure Instagram Basic Display**

1. Click **"Basic Display"** in the left sidebar
2. Click **"Create New App"**
3. Fill in:
   - **Display Name:** `ShoutOut Social Tracker`
   - **Valid OAuth Redirect URIs:** 
     ```
     https://shoutout.us/api/instagram/callback
     ```
   - **Deauthorize Callback URL:**
     ```
     https://shoutout.us/api/instagram/deauthorize
     ```
   - **Data Deletion Request URL:**
     ```
     https://shoutout.us/api/instagram/delete
     ```
4. Click **"Save Changes"**

---

### **Step 5: Get Your Credentials**

1. Go to **Settings → Basic** in the left sidebar
2. Copy and save these:
   - **App ID:** `[copy this]`
   - **App Secret:** `[click "Show" and copy this]`

**Save these somewhere secure!** You'll need them for environment variables.

---

### **Step 6: Add Test Users (Talent Accounts)**

Since your app is in Development Mode, you need to add test users:

1. Go to **Roles → Instagram Testers**
2. Click **"Add Instagram Testers"**
3. Enter Instagram usernames of your talent (one at a time)
4. They'll receive a notification to accept

**Important:** Each talent must:
- Have an Instagram account
- Accept the tester invitation
- Authorize your app to access their profile

---

### **Step 7: Get User Access Token**

For each talent account:

1. Have them visit this URL (replace `{app-id}` with your App ID):
   ```
   https://api.instagram.com/oauth/authorize?client_id={app-id}&redirect_uri=https://shoutout.us/api/instagram/callback&scope=user_profile,user_media&response_type=code
   ```

2. They'll be redirected to your callback URL with a `code` parameter

3. Exchange the code for an access token using this API call:
   ```bash
   curl -X POST \
     https://api.instagram.com/oauth/access_token \
     -F client_id={app-id} \
     -F client_secret={app-secret} \
     -F grant_type=authorization_code \
     -F redirect_uri=https://shoutout.us/api/instagram/callback \
     -F code={code-from-step-2}
   ```

4. Save the `access_token` returned

**Note:** We'll automate this OAuth flow in the code later!

---

### **Step 8: Add Instagram Username to Talent Profiles**

We need to update the database schema:

**SQL to run in Supabase:**
```sql
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_talent_instagram ON talent_profiles(instagram_username);
```

---

### **Step 9: Create Supabase Edge Function**

I'll create the edge function for you. This will:
- Check each talent's Instagram bio for `shoutout.us`
- Scan recent posts for `@shoutoutvoice` tags
- Update the tracking tables

**Location:** `supabase/functions/instagram-tracker/index.ts`

---

### **Step 10: Add Credentials to Supabase**

Once you have your App ID and App Secret:

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions → instagram-tracker**
3. Click **"Secrets"**
4. Add these secrets:
   - `INSTAGRAM_APP_ID` = `[your app id]`
   - `INSTAGRAM_APP_SECRET` = `[your app secret]`

---

### **Step 11: Deploy & Test**

Deploy the edge function:
```bash
cd supabase/functions
supabase functions deploy instagram-tracker
```

Test it:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/instagram-tracker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

### **Step 12: Set Up Daily Automation**

Add a cron job in Supabase to run daily:

**SQL:**
```sql
SELECT cron.schedule(
  'instagram-tracking',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/instagram-tracker',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

---

## 🚀 What I'll Build For You

Once you complete Steps 1-6 and share your credentials, I'll create:

1. **OAuth Flow UI** - Let talent connect their Instagram in one click
2. **Edge Function** - Automatically track bio links and posts
3. **Token Refresh Logic** - Keep access tokens valid
4. **Admin UI Enhancement** - Show Instagram data in Social Tracking tab

---

## 📸 What You Should See Now

After clicking "Next" on the "Business" app type, you should see a form asking for:
- **App Name**
- **App Contact Email**  
- **Business Portfolio** (optional)

Fill those in and proceed!

---

## ❓ FAQ

**Q: Do I need a Facebook Page?**
A: No, not for Instagram Basic Display.

**Q: Can I use my personal Instagram?**
A: Yes for testing, but talent need Business/Creator accounts for full features.

**Q: How much does this cost?**
A: Free for basic usage. No charges unless you exceed rate limits (200 calls/hr).

**Q: What if I can't add testers?**
A: Your app needs to be verified for public use. For now, use Development Mode with testers.

**Q: How do I go live (not just test users)?**
A: Submit your app for App Review (requires demo video and privacy policy).

---

## 🎯 Next Steps

**Right now:**
1. ✅ Select "Business" and click "Next"
2. Fill in app details (name, email)
3. Create the app
4. Take a screenshot of your App Dashboard
5. Share your **App ID** (it's public, safe to share)
6. I'll start building the integration!

**Reply with:**
- Screenshot of your app dashboard, OR
- Your App ID

And I'll continue building the automation!

---

## 🔐 Security Notes

**Safe to share:**
- ✅ App ID (public)
- ✅ App Name

**NEVER share publicly:**
- ❌ App Secret
- ❌ Access Tokens
- ❌ Service Role Keys

When you get your App Secret, share it securely (encrypted message, etc.) or I'll guide you on adding it directly to Supabase secrets.

