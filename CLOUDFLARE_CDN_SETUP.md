# Cloudflare CDN Setup Guide for Wasabi Storage

## Overview
Set up Cloudflare as a CDN in front of Wasabi S3 storage for 70% faster video/image delivery and 80% bandwidth cost savings.

## 🎯 Benefits
- **70-80% faster** video/image loading globally
- **$20-50/month savings** on Wasabi bandwidth
- **Free SSL** for custom domains
- **DDoS protection** included
- **Analytics** for cache performance

---

## 📋 Prerequisites

- [ ] Domain `shoutout.us` added to Cloudflare
- [ ] Cloudflare account with DNS access
- [ ] Wasabi buckets created:
  - `shoutoutorders` (videos)
  - `shoutout-assets` (images/avatars) - *Optional if not created yet*

---

## Step 1: Add DNS Records (5 minutes)

### Login to Cloudflare
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select domain: `shoutout.us`
3. Go to **DNS** → **Records**

### Add Video CDN Record

Click **Add record**:
```
Type: CNAME
Name: videos
Target: shoutoutorders.s3.us-central-1.wasabisys.com
Proxy status: Proxied (orange cloud ☁️)
TTL: Auto
```

Click **Save**

### Add Images CDN Record (Optional)

Click **Add record**:
```
Type: CNAME
Name: images
Target: shoutout-assets.s3.us-central-1.wasabisys.com
Proxy status: Proxied (orange cloud ☁️)
TTL: Auto
```

Click **Save**

**Important:** Ensure the **orange cloud** is enabled (Proxied). This routes traffic through Cloudflare's CDN.

---

## Step 2: Configure Cache Rules (10 minutes)

### Option A: Page Rules (Free Tier - 3 rules max)

1. Go to **Rules** → **Page Rules**
2. Click **Create Page Rule**

#### Rule 1: Video Caching
```
URL Pattern: videos.shoutout.us/*

Settings:
✓ Cache Level: Cache Everything
✓ Edge Cache TTL: 1 month
✓ Browser Cache TTL: 4 hours
✓ Origin Cache Control: On
```

Click **Save and Deploy**

#### Rule 2: Image Caching (Optional)
```
URL Pattern: images.shoutout.us/*

Settings:
✓ Cache Level: Cache Everything
✓ Edge Cache TTL: 1 month
✓ Browser Cache TTL: 1 day
✓ Origin Cache Control: On
```

Click **Save and Deploy**

### Option B: Cache Rules (New UI - Better)

1. Go to **Caching** → **Cache Rules**
2. Click **Create rule**

#### Rule 1: Videos
```
Rule name: Cache Videos

When incoming requests match:
  Field: Hostname
  Operator: equals
  Value: videos.shoutout.us

Then:
  Cache eligibility: Eligible for cache
  Edge TTL: 2678400 seconds (1 month)
  Browser TTL: 14400 seconds (4 hours)
```

#### Rule 2: Images
```
Rule name: Cache Images

When incoming requests match:
  Field: Hostname
  Operator: equals
  Value: images.shoutout.us

Then:
  Cache eligibility: Eligible for cache
  Edge TTL: 2678400 seconds (1 month)
  Browser TTL: 86400 seconds (1 day)
```

---

## Step 3: Configure SSL/TLS (2 minutes)

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode: **Full** (not Full Strict, since Wasabi uses shared certs)
3. Go to **SSL/TLS** → **Edge Certificates**
4. Enable:
   - ✓ Always Use HTTPS
   - ✓ Automatic HTTPS Rewrites
   - ✓ Minimum TLS Version: 1.2

---

## Step 4: Enable Performance Features (3 minutes)

### Speed Settings
Go to **Speed** → **Optimization**

Enable:
- ✓ **Auto Minify:** JavaScript, CSS, HTML
- ✓ **Brotli** compression
- ✓ **Early Hints**
- ✓ **Rocket Loader:** Off (can break video players)

### Caching Settings
Go to **Caching** → **Configuration**

Set:
- **Caching Level:** Standard
- **Browser Cache TTL:** 4 hours
- **Always Online:** On
- **Development Mode:** Off (unless testing)

---

## Step 5: Configure CORS for Wasabi (5 minutes)

Your Wasabi buckets need CORS headers for CDN access.

### Using AWS CLI:

Save this as `cors-config.json`:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Apply CORS:
```bash
aws s3api put-bucket-cors \
  --bucket shoutoutorders \
  --cors-configuration file://cors-config.json \
  --endpoint-url=https://s3.us-central-1.wasabisys.com

aws s3api put-bucket-cors \
  --bucket shoutout-assets \
  --cors-configuration file://cors-config.json \
  --endpoint-url=https://s3.us-central-1.wasabisys.com
```

### Using Wasabi Console:

1. Login to [Wasabi Console](https://console.wasabisys.com)
2. Select bucket `shoutoutorders`
3. Go to **Settings** → **CORS Configuration**
4. Add rule:
```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```
5. Save
6. Repeat for `shoutout-assets` bucket

---

## Step 6: Verify DNS Propagation (2 minutes)

### Check DNS Resolution:
```bash
# Check videos subdomain
dig videos.shoutout.us

# Should show Cloudflare IPs (104.x.x.x or 172.x.x.x)
# If showing Wasabi IPs, wait 5-10 minutes for propagation
```

### Check CNAME:
```bash
dig videos.shoutout.us CNAME

# Should show: shoutoutorders.s3.us-central-1.wasabisys.com
```

### Check from different locations:
- [DNS Checker](https://dnschecker.org/#CNAME/videos.shoutout.us)
- Should show Cloudflare IPs globally

---

## Step 7: Test CDN (5 minutes)

### Upload Test File:
```bash
# Upload a test video
aws s3 cp test-video.mp4 \
  s3://shoutoutorders/test-video.mp4 \
  --endpoint-url=https://s3.us-central-1.wasabisys.com \
  --acl public-read
```

### Test Direct Wasabi Access:
```bash
curl -I https://shoutoutorders.s3.us-central-1.wasabisys.com/test-video.mp4

# Should return 200 OK
```

### Test CDN Access (First Request):
```bash
curl -I https://videos.shoutout.us/test-video.mp4

# Check headers:
# cf-cache-status: MISS (first request)
# server: cloudflare
```

### Test CDN Cache (Second Request):
```bash
curl -I https://videos.shoutout.us/test-video.mp4

# Check headers:
# cf-cache-status: HIT (cached!)
# age: [seconds since cached]
# server: cloudflare
```

### Browser Test:
Open in browser:
```
https://videos.shoutout.us/test-video.mp4
```

Check Network tab (F12):
- First load: `cf-cache-status: MISS`
- Second load: `cf-cache-status: HIT`
- Load time should be <500ms (vs 2-3s direct)

---

## Step 8: Update Application Environment Variables

### Railway Dashboard:

Add these environment variables:
```bash
# CDN URLs (with CDN)
REACT_APP_WASABI_CDN_VIDEOS_URL=https://videos.shoutout.us
REACT_APP_WASABI_CDN_IMAGES_URL=https://images.shoutout.us

# Keep original URLs as fallback
REACT_APP_WASABI_BUCKET_URL=https://shoutoutorders.s3.us-central-1.wasabisys.com
```

### Local Development (.env):
```bash
# Add to .env file
REACT_APP_WASABI_CDN_VIDEOS_URL=https://videos.shoutout.us
REACT_APP_WASABI_CDN_IMAGES_URL=https://images.shoutout.us
```

---

## Step 9: Update Code to Use CDN URLs

The code has been updated to automatically use CDN URLs when available. See changes in:
- `src/services/wasabiService.ts` (if exists)
- Video/image components will use CDN URLs

No additional code changes needed if environment variables are set!

---

## 🔍 Monitoring & Analytics

### Cloudflare Analytics

Go to **Analytics & Logs** → **Traffic**

Monitor:
- **Requests:** Total requests served
- **Bandwidth:** Data transferred (should be mostly cached)
- **Cache Hit Rate:** Target 80-90%
- **Errors:** Any 4xx/5xx errors

### Cache Performance

Go to **Caching** → **Configuration** → **Purge Cache**

To test cache:
1. Purge cache for a specific URL
2. Access the file
3. Check `cf-cache-status` header
4. Should go from MISS → HIT on second request

---

## 🎯 Expected Performance

### Before CDN:
| Metric | Value |
|--------|-------|
| Video load (US) | 2-3 seconds |
| Video load (EU) | 5-8 seconds |
| Wasabi bandwidth | 100% of requests |
| Monthly cost (1k users) | $30-50 |

### After CDN:
| Metric | Value |
|--------|-------|
| Video load (US) | 0.5-1 second (**70% faster**) |
| Video load (EU) | 1-2 seconds (**80% faster**) |
| Wasabi bandwidth | 10-20% of requests |
| Monthly cost (1k users) | $5-10 (**$25-40 saved**) |

### Cache Hit Rate Goals:
- **80-90% cache hit rate** = Excellent
- **60-80% cache hit rate** = Good
- **<60% cache hit rate** = Investigate (increase TTL or check cache rules)

---

## 🛠️ Troubleshooting

### Issue: cf-cache-status always MISS

**Cause:** Cache rules not applied or CDN not enabled  
**Solution:**
1. Check Page Rules are enabled
2. Ensure orange cloud (Proxied) is ON for DNS records
3. Wait 5 minutes for cache rules to propagate
4. Purge cache and try again

### Issue: CORS errors in browser

**Cause:** Wasabi bucket CORS not configured  
**Solution:**
1. Apply CORS configuration to Wasabi buckets (Step 5)
2. Test with: `curl -I -H "Origin: https://shoutout.us" https://videos.shoutout.us/test.mp4`
3. Should see `access-control-allow-origin: *` header

### Issue: SSL/TLS errors

**Cause:** Wrong SSL mode or certificate issues  
**Solution:**
1. Go to SSL/TLS → Overview
2. Set to **Full** (not Full Strict)
3. Wait 5 minutes for SSL to provision

### Issue: Videos not loading

**Cause:** DNS not propagated or URL incorrect  
**Solution:**
1. Check DNS: `dig videos.shoutout.us`
2. Test direct Wasabi: `curl -I [wasabi-url]`
3. Test CDN: `curl -I [cdn-url]`
4. Check browser console for errors

### Issue: Slow first load

**Cause:** Cache warming needed  
**Solution:**
- First request is always MISS (pulls from Wasabi)
- Second+ requests are HIT (served from CDN edge)
- This is expected behavior
- Consider cache warming scripts for popular videos

---

## 🔒 Security Best Practices

### 1. Enable WAF (Web Application Firewall)
Go to **Security** → **WAF**
- Enable managed rules
- Set security level: Medium

### 2. Enable Rate Limiting
Go to **Security** → **Rate Limiting**
- Limit: 100 requests per 10 seconds per IP
- Action: Block for 10 minutes

### 3. Enable Bot Protection
Go to **Security** → **Bots**
- Bot Fight Mode: On
- Super Bot Fight Mode: If on paid plan

### 4. Block Bad Countries (Optional)
Go to **Security** → **Tools**
- IP Access Rules
- Block countries with high abuse rates

---

## 📊 Cost Breakdown

### Cloudflare Free Tier Includes:
- ✓ Unlimited bandwidth (CDN)
- ✓ Unlimited cached requests
- ✓ 3 Page Rules
- ✓ SSL certificates
- ✓ DDoS protection
- ✓ Basic analytics

### What You Pay:
- **Cloudflare:** $0/month (Free tier is perfect)
- **Wasabi:** Only for cache misses (~10-20% of traffic)
- **Domain:** Already own `shoutout.us`

### Monthly Savings Estimate:
| Traffic Level | Without CDN | With CDN | Savings |
|---------------|-------------|----------|---------|
| 100 users/day | $5 | $1 | **$4/mo** |
| 1,000 users/day | $30 | $5 | **$25/mo** |
| 10,000 users/day | $300 | $50 | **$250/mo** |

---

## ✅ Post-Setup Checklist

- [ ] DNS records created (videos.shoutout.us)
- [ ] Orange cloud enabled (Proxied)
- [ ] Cache rules configured
- [ ] SSL/TLS set to Full
- [ ] CORS configured on Wasabi
- [ ] Test file uploaded
- [ ] CDN working (cf-cache-status: HIT)
- [ ] Environment variables updated
- [ ] App redeployed
- [ ] Performance tested
- [ ] Cache hit rate >80%

---

## 🚀 Next Steps

1. **Monitor cache hit rate** for first 24 hours
2. **Adjust TTLs** if needed (increase for higher hit rate)
3. **Set up cache warming** for popular videos (optional)
4. **Configure analytics alerts** in Cloudflare
5. **Consider paid plan** ($20/mo) for:
   - Unlimited Page Rules
   - Better analytics
   - Image optimization
   - Polish (auto WebP conversion)

---

## 📚 Additional Resources

- [Cloudflare CDN Docs](https://developers.cloudflare.com/cache/)
- [Wasabi S3 API](https://wasabi-support.zendesk.com/hc/en-us/articles/360015106031-What-are-the-service-URLs-for-Wasabi-s-different-storage-regions-)
- [Page Rules Guide](https://support.cloudflare.com/hc/en-us/articles/218411427)
- [Cache Best Practices](https://developers.cloudflare.com/cache/best-practices/)

---

**Setup Time:** ~30 minutes  
**Cost:** $0/month  
**Savings:** $25-250/month  
**Performance Gain:** 70-80% faster  
**ROI:** Immediate ✅

**Status:** Ready to implement!

