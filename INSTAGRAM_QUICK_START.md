# Instagram Integration - Quick Start

## ✅ What's Complete

All code is written and ready to deploy! Here's what you need to do to activate it.

---

## 🚀 5-Minute Deployment

### **Step 1: Run SQL (2 minutes)**

Go to Supabase → SQL Editor and run this file:
```
database/add_instagram_fields.sql
```

This adds Instagram fields to your talent_profiles table.

---

### **Step 2: Deploy Edge Functions (2 minutes)**

```bash
cd supabase/functions

# Deploy OAuth handler
supabase functions deploy instagram-oauth

# Deploy tracker
supabase functions deploy instagram-tracker
```

---

### **Step 3: Add Secrets (1 minute)**

```bash
supabase secrets set INSTAGRAM_APP_ID=your_instagram_app_id
supabase secrets set INSTAGRAM_APP_SECRET=your_instagram_app_secret
supabase secrets set INSTAGRAM_REDIRECT_URI=https://yourdomain.com/instagram/callback
```

---

### **Step 4: Set Up Cron Job (1 minute)**

Go to Supabase → SQL Editor and run:
```
database/instagram_cron_job.sql
```

**IMPORTANT:** Replace these two values in the SQL:
- `YOUR_PROJECT_ID` → Your Supabase project ID
- `YOUR_SERVICE_ROLE_KEY` → Your Supabase service role key

---

### **Step 5: Deploy Frontend (standard deployment)**

```bash
npm run build
# Deploy to Railway (or your hosting)
```

---

## 🎯 What Happens Next

1. **Talent sees "Connect Instagram"** in their Promotion tab
2. **One-click OAuth flow** - takes 30 seconds
3. **Daily at 2 AM** - automatic tracking runs
4. **Admin sees data** in Social Tracking tab

---

## 🧪 Test It

**Test OAuth:**
1. Login as a talent account
2. Go to Dashboard → Promotion tab
3. Click "Connect Instagram Account"
4. Authorize in popup
5. See "✓ Connected as @username"

**Test Tracker (manual):**
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/instagram-tracker \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Should return: `{"success":true,"processed":1,"errors":0,"total":1}`

**Test Admin View:**
1. Login as admin
2. Go to Admin Dashboard → Social Tracking
3. See Instagram data for connected talent

---

## 📋 Complete Checklist

- [ ] Run `database/add_instagram_fields.sql`
- [ ] Deploy `instagram-oauth` edge function
- [ ] Deploy `instagram-tracker` edge function
- [ ] Set 3 secrets (APP_ID, APP_SECRET, REDIRECT_URI)
- [ ] Run `database/instagram_cron_job.sql` (with YOUR values replaced)
- [ ] Deploy frontend to production
- [ ] Test OAuth flow with a talent account
- [ ] Test tracker with curl command
- [ ] Verify admin dashboard shows data

---

## 🔧 Troubleshooting

**"Function not found"**
→ Redeploy: `supabase functions deploy instagram-oauth`

**"Invalid redirect_uri"**
→ Check secret: `INSTAGRAM_REDIRECT_URI=https://shoutout.us/instagram/callback`

**"No data in admin"**
→ Run tracker manually with curl command above

**Popup blocked**
→ Allow popups for shoutout.us in browser settings

---

## 📞 Need Help?

See the full guide: `INSTAGRAM_DEPLOYMENT_GUIDE.md`

Or check the Meta setup guide: `META_INSTAGRAM_API_SETUP.md`

---

## ⚡ Next: Add Test Users

In Meta Dashboard:
1. Go to Instagram → Roles → Instagram Testers
2. Add Instagram usernames of your talent
3. They'll get a notification to accept
4. Once accepted, they can connect via OAuth

Without adding as testers, OAuth will fail during development mode.

---

## 🎉 Success!

Once deployed:
- Talent can connect Instagram in seconds
- Tracking runs automatically daily
- No manual work needed
- Scales to unlimited talent
- All data in admin dashboard

**Your Instagram integration is ready to go!** 🚀

