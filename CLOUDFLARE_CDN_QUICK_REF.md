# Cloudflare CDN Quick Reference

## 🚀 30-Minute Setup Checklist

### Phase 1: Cloudflare DNS (5 min)
```
□ Login to Cloudflare Dashboard
□ Select domain: shoutout.us
□ DNS → Add CNAME: videos → shoutoutorders.s3.us-central-1.wasabisys.com (Proxy ON)
□ DNS → Add CNAME: images → shoutout-assets.s3.us-central-1.wasabisys.com (Proxy ON)
□ Verify orange cloud ☁️ is enabled
```

### Phase 2: Cache Rules (10 min)
```
□ Go to Rules → Page Rules
□ Create rule: videos.shoutout.us/*
  ✓ Cache Level: Cache Everything
  ✓ Edge TTL: 1 month
  ✓ Browser TTL: 4 hours
□ Create rule: images.shoutout.us/*
  ✓ Cache Level: Cache Everything
  ✓ Edge TTL: 1 month
  ✓ Browser TTL: 1 day
```

### Phase 3: SSL & Performance (3 min)
```
□ SSL/TLS → Overview → Set to "Full"
□ SSL/TLS → Edge Certificates → Enable "Always Use HTTPS"
□ Speed → Optimization → Enable Brotli + Auto Minify
```

### Phase 4: Wasabi CORS (5 min)
```
□ Run: ./scripts/setup-wasabi-cors.sh
  OR manually add CORS in Wasabi Console
```

### Phase 5: Test (5 min)
```
□ dig videos.shoutout.us (should show Cloudflare IPs)
□ curl -I https://videos.shoutout.us/test.mp4 (first: MISS)
□ curl -I https://videos.shoutout.us/test.mp4 (second: HIT)
```

### Phase 6: Deploy (2 min)
```
□ Add env vars to Railway:
  REACT_APP_WASABI_CDN_VIDEOS_URL=https://videos.shoutout.us
  REACT_APP_WASABI_CDN_IMAGES_URL=https://images.shoutout.us
□ Redeploy app
□ Test in browser
```

---

## 🧪 Testing Commands

### DNS Check
```bash
dig videos.shoutout.us
# Should show: 104.x.x.x or 172.x.x.x (Cloudflare IPs)
```

### CDN Test (First Request - MISS)
```bash
curl -I https://videos.shoutout.us/test.mp4
# Look for: cf-cache-status: MISS
```

### CDN Test (Second Request - HIT)
```bash
curl -I https://videos.shoutout.us/test.mp4
# Look for: cf-cache-status: HIT
```

### Full Response Headers
```bash
curl -v https://videos.shoutout.us/test.mp4 2>&1 | grep -E 'cf-|cache|server'
```

### Speed Test
```bash
time curl -o /dev/null https://videos.shoutout.us/test.mp4
# Should be <1 second after cache warm
```

---

## 📊 Key Metrics to Monitor

### Cloudflare Dashboard → Analytics

**Target Metrics:**
- Cache Hit Rate: >80%
- Bandwidth Saved: >70%
- Avg Response Time: <500ms
- Error Rate: <1%

**What to Watch:**
- Spike in cache misses → Check cache rules
- High error rate → Check CORS or SSL
- Low hit rate → Increase TTL or check URL patterns

---

## 🐛 Common Issues & Fixes

### Issue: "cf-cache-status: BYPASS"
**Fix:** 
- URL has query strings → Add cache everything rule
- File too large → Check Cloudflare limits (512MB max)
- POST request → Only GET/HEAD are cached

### Issue: "cf-cache-status: MISS" every time
**Fix:**
- Cache rules not applied → Wait 5 min, purge cache
- Orange cloud disabled → Enable proxy on DNS
- Different URL each time → Check URL consistency

### Issue: CORS errors
**Fix:**
- Run: `./scripts/setup-wasabi-cors.sh`
- Or manually add CORS in Wasabi Console
- Verify: `curl -I -H "Origin: https://shoutout.us" [cdn-url]`

### Issue: SSL certificate errors
**Fix:**
- SSL mode → Set to "Full" (not Full Strict)
- Wait 5 minutes for cert provisioning
- Check: https://www.ssllabs.com/ssltest/

---

## 🎯 Performance Targets

| Metric | Without CDN | With CDN | Your Result |
|--------|-------------|----------|-------------|
| Load time (US) | 2-3s | 0.5-1s | ___ |
| Load time (EU) | 5-8s | 1-2s | ___ |
| Cache hit rate | 0% | 80-90% | ___ |
| Bandwidth cost | $30 | $5 | ___ |

---

## 🔧 Useful URLs

**Cloudflare Dashboard:**
- Main: https://dash.cloudflare.com
- Analytics: https://dash.cloudflare.com/?to=/:account/:zone/analytics
- Cache: https://dash.cloudflare.com/?to=/:account/:zone/caching

**Testing Tools:**
- DNS: https://dnschecker.org
- SSL: https://www.ssllabs.com/ssltest/
- Speed: https://tools.keycdn.com/speed
- Headers: https://tools.keycdn.com/curl

**Wasabi:**
- Console: https://console.wasabisys.com
- Support: https://wasabi-support.zendesk.com

---

## 💡 Pro Tips

1. **Cache Warming:** Preload popular videos after deploy
2. **Monitoring:** Set up Cloudflare email alerts for errors
3. **Purge Strategy:** Purge by URL, not full cache
4. **Development:** Use `?nocache=1` query param to bypass CDN during testing
5. **Analytics:** Check weekly, optimize poorly-performing assets

---

## 📞 Need Help?

1. Check full guide: `CLOUDFLARE_CDN_SETUP.md`
2. Test with curl commands above
3. Check Cloudflare status: https://www.cloudflarestatus.com
4. Review Cloudflare logs: Dashboard → Analytics → Logs

---

**Setup Time:** 30 minutes  
**Cost:** $0/month  
**Savings:** $25-250/month  
**Performance:** 70% faster  

✅ **Worth it!**

