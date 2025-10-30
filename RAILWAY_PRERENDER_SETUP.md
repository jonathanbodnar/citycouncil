# Railway Prerender.io Setup Guide

## ✅ Code Changes Complete

The following files have been updated:
- ✅ `server.js` - Express server with Prerender.io middleware
- ✅ `package.json` - Updated start command to use Node server
- ✅ Added dependencies: `express`, `prerender-node`

## 🚀 Railway Configuration Steps

### 1. Get Your Prerender.io Token
1. Go to https://prerender.io/
2. Sign in to your account
3. Go to Account Settings
4. Copy your **API Token**

### 2. Add Environment Variable to Railway
1. Go to your Railway project dashboard
2. Click on your **ShoutOut** service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Variable Name**: `PRERENDER_TOKEN`
   - **Variable Value**: `[paste your token here]`
6. Click **Add**

### 3. Deploy Changes
Railway will automatically redeploy when you push these changes.

```bash
git add -A
git commit -m "Add Prerender.io integration for social media previews"
git push
```

Railway will:
1. Detect the changes
2. Run `npm install` (installs express and prerender-node)
3. Run `npm run build` (builds the React app)
4. Run `npm start` (starts the Express server with Prerender middleware)

## 🧪 Testing After Deploy

### 1. Test Homepage
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter: `https://shoutout.us`
3. Click **Scrape Again**
4. Verify: Should show ShoutOut logo and description

### 2. Test Talent Profile
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter: `https://shoutout.us/joshfirestine`
3. Click **Scrape Again**
4. Verify: Should show Josh's profile image and bio

### 3. Test Twitter
1. Go to: https://cards-dev.twitter.com/validator
2. Enter: `https://shoutout.us/joshfirestine`
3. Verify: Shows proper Twitter Card preview

## 🔍 Troubleshooting

### Preview Not Showing?
1. **Check Railway Logs**:
   - Look for: `✅ Prerender.io middleware enabled`
   - If you see: `⚠️ PRERENDER_TOKEN not set` - double check environment variable

2. **Clear Cache**:
   - Facebook: Click "Scrape Again" multiple times
   - Wait 5 minutes, then try again

3. **Check Prerender.io Dashboard**:
   - Go to https://prerender.io/dashboard
   - Look for recent cache entries
   - Should show crawls from facebookexternalhit, twitterbot, etc.

### Server Not Starting?
1. Check Railway logs for errors
2. Ensure `build` folder exists (run `npm run build` locally to test)
3. Check that `PRERENDER_TOKEN` is set correctly

## 📊 How It Works

```
User Request → Railway Server → Express Server
                                     ↓
                            Is it a social crawler?
                            (Facebook, Twitter, etc.)
                                     ↓
                           ┌─────────┴─────────┐
                          YES                  NO
                           ↓                    ↓
                    Prerender.io         Serve React App
                    (renders JS)         (normal SPA)
                           ↓                    ↓
                    Return HTML          Return HTML
                    with meta tags       (client renders)
```

## 🎯 Expected Behavior

### For Regular Users:
- No change! React app loads normally
- Fast, interactive single-page application

### For Social Media Crawlers:
- Request goes to Prerender.io
- JavaScript is executed
- Open Graph meta tags are rendered
- Crawler sees the meta tags
- Link preview shows properly!

## 📈 Monitoring

Check your Prerender.io dashboard to see:
- Number of pages cached
- Crawl requests per day
- Cache hit rate
- Response times

Free tier includes:
- 250 cached pages
- Unlimited recaches
- Standard support

## ✅ Verification Checklist

After deployment, verify:
- [ ] Railway deployment successful
- [ ] Server logs show "Prerender.io middleware enabled"
- [ ] Homepage preview works on Facebook Debugger
- [ ] Talent profile preview works on Facebook Debugger
- [ ] Twitter Card preview works
- [ ] LinkedIn preview works (use LinkedIn Post Inspector)

---

**Need Help?**
- Prerender.io docs: https://docs.prerender.io/
- Railway docs: https://docs.railway.app/

