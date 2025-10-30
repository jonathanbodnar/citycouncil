# Prerender.io Not Working - Debug Guide

## Problem
Facebook is seeing the static `index.html` instead of the pre-rendered React page with dynamic meta tags.

## What I Found
When I curl the page as Facebook's crawler:
```bash
curl -A "facebookexternalhit/1.1" https://shoutout.us/joshfirestine
```

It returns the basic `index.html` with static OG tags, NOT the dynamic talent-specific tags.

This means Prerender.io middleware is **not intercepting the request**.

## Possible Causes

### 1. PRERENDER_TOKEN Not Set in Railway
**Check:**
1. Go to Railway Dashboard
2. Click your ShoutOut service
3. Click "Variables" tab
4. Look for `PRERENDER_TOKEN`

**If missing:**
- Add it with your Prerender.io token from https://prerender.io/account

### 2. Server Not Using the Middleware
**Check Railway Logs:**
1. Go to Railway Dashboard
2. Click "Deployments"
3. Click latest deployment
4. Look for: `✅ Prerender.io middleware enabled`

**If you see:** `⚠️ PRERENDER_TOKEN not set`
- The middleware is disabled
- Add the environment variable

### 3. Build/Deploy Issue
**The server.js might not be running:**
1. Check Railway logs for: `🚀 Server is running on port 3000`
2. Check for any errors in the deployment

**If missing:**
- Railway might be using the old `serve` command
- Check `package.json` "start" script is: `"start": "node server.js"`

### 4. Express Server Not Serving Build
**Check if build folder exists:**
```bash
# Locally
ls -la build/
```

Railway should run `npm run build` before `npm start`.

## Quick Fix: Test Prerender.io Directly

Test if Prerender.io can render your page:
```bash
curl "https://service.prerender.io/https://shoutout.us/joshfirestine?prerenderToken=YOUR_TOKEN"
```

Replace `YOUR_TOKEN` with your actual Prerender.io token.

**If this works:**
- Prerender.io is fine
- The issue is with your middleware/server setup

**If this fails:**
- Check Prerender.io dashboard for errors
- Verify your token is valid

## Solution Steps

### Step 1: Verify PRERENDER_TOKEN
```bash
# In Railway, check if this returns your token:
echo $PRERENDER_TOKEN
```

### Step 2: Check Server Logs
Look for these lines in Railway deployment logs:
```
✅ Prerender.io middleware enabled
🚀 Server is running on port 3000
📱 Prerender enabled: true
```

### Step 3: Force Rebuild
If everything looks correct but still not working:
1. Go to Railway Dashboard
2. Click "Deployments"
3. Click "..." on latest deployment
4. Click "Redeploy"

### Step 4: Test Again
After redeploy (wait 2-3 minutes):
```bash
curl -A "facebookexternalhit/1.1" https://shoutout.us/joshfirestine | grep "Josh Firestine"
```

Should return HTML with "Josh Firestine - Personalized Video ShoutOuts"

## Alternative: Manual Prerender.io URL

If the middleware continues to fail, you can manually use Prerender.io:

**In Facebook Debugger, test:**
```
https://service.prerender.io/https://shoutout.us/joshfirestine?prerenderToken=YOUR_TOKEN
```

This bypasses your server and goes directly to Prerender.io.

## Check List

- [ ] PRERENDER_TOKEN is set in Railway environment variables
- [ ] Railway logs show "Prerender.io middleware enabled"
- [ ] package.json "start" script is "node server.js"
- [ ] Build folder exists and has index.html
- [ ] Server is running (logs show port 3000)
- [ ] No errors in Railway deployment logs
- [ ] Prerender.io dashboard shows recent crawls

## Still Not Working?

If none of the above works, the issue might be:

1. **Railway routing:** Railway might be serving static files directly before hitting your Express server
2. **Cloudflare caching:** Cloudflare might be caching the static HTML
3. **Prerender.io limits:** Free tier might be at limit (250 pages)

**Check Prerender.io Dashboard:**
- https://prerender.io/dashboard
- Look for your domain in "Cached Pages"
- Check for any errors or rate limiting

## Nuclear Option: Clear All Caches

1. **Prerender.io:** Delete cached pages from dashboard
2. **Facebook:** Scrape Again multiple times
3. **Cloudflare:** Purge cache (if using Cloudflare)
4. **Railway:** Redeploy from scratch

Wait 5-10 minutes between each step for DNS/cache propagation.

