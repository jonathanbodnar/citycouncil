# CloudFlare CDN Setup for Wasabi

Wasabi has requested CloudFlare integration before enabling public access. Here's the complete setup guide.

---

## **Step 1: Create CloudFlare Account (if needed)**

1. Go to https://www.cloudflare.com/
2. Sign up for a **Free Plan** (sufficient for now)
3. Add your domain: `shoutout.us`
4. Follow CloudFlare's nameserver setup (if not already using CloudFlare DNS)

---

## **Step 2: Create CNAME Records for Wasabi Buckets**

In your CloudFlare DNS settings:

### **For shoutout-assets bucket (images):**

1. Go to CloudFlare Dashboard → `shoutout.us` → DNS → Records
2. Click "Add record"
3. Settings:
   - **Type:** CNAME
   - **Name:** `assets` (will create assets.shoutout.us)
   - **Target:** `s3.us-central-1.wasabisys.com`
   - **Proxy status:** ✅ **Proxied** (orange cloud) ← **IMPORTANT**
   - **TTL:** Auto
4. Click "Save"

### **For shoutoutorders bucket (videos):**

1. Click "Add record" again
2. Settings:
   - **Type:** CNAME
   - **Name:** `videos` (will create videos.shoutout.us)
   - **Target:** `s3.us-central-1.wasabisys.com`
   - **Proxy status:** ✅ **Proxied** (orange cloud) ← **IMPORTANT**
   - **TTL:** Auto
3. Click "Save"

---

## **Step 3: Configure CloudFlare Cache Rules**

1. Go to CloudFlare Dashboard → `shoutout.us` → Rules → Page Rules (or Cache Rules)
2. Create a new rule for assets:

**Rule 1 - Assets (Images):**
- **URL Pattern:** `assets.shoutout.us/*`
- **Settings:**
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 4 hours
- Click "Save and Deploy"

**Rule 2 - Videos:**
- **URL Pattern:** `videos.shoutout.us/*`
- **Settings:**
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 4 hours
- Click "Save and Deploy"

---

## **Step 4: Configure CORS in CloudFlare (Optional but Recommended)**

If you encounter CORS issues, add Transform Rules:

1. Go to Rules → Transform Rules → Modify Response Header
2. Create rule:
   - **Name:** Wasabi CORS
   - **When incoming requests match:** `assets.shoutout.us/*` OR `videos.shoutout.us/*`
   - **Then...** Set static → Header name: `Access-Control-Allow-Origin` → Value: `*`
   - Click "Deploy"

---

## **Step 5: Test the CNAME Records**

Wait 5-10 minutes for DNS propagation, then test:

```bash
# Test DNS resolution
nslookup assets.shoutout.us
nslookup videos.shoutout.us

# Should show CloudFlare IPs, not Wasabi IPs
```

---

## **Step 6: Reply to Wasabi with Required Info**

Once CloudFlare is set up, reply to Wasabi with:

```
Thank you for the quick response!

I have successfully integrated CloudFlare CDN with Wasabi. Here is the requested information:

CNAME RECORDS:
- assets.shoutout.us → s3.us-central-1.wasabisys.com (Proxied via CloudFlare)
  For bucket: shoutout-assets
  
- videos.shoutout.us → s3.us-central-1.wasabisys.com (Proxied via CloudFlare)
  For bucket: shoutoutorders

CONTACT PHONE NUMBER:
[YOUR PHONE NUMBER]

CloudFlare is configured with:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month (minimizes direct Wasabi egress)
- Browser Cache TTL: 4 hours

All requests to our Wasabi buckets will be routed through CloudFlare's CDN, ensuring compliance with your egress policy.

Please let me know if you need any additional information.

Thank you!

Best regards,
[YOUR NAME]
[YOUR EMAIL]
[YOUR PHONE NUMBER]
```

---

## **Step 7: Update Application Code (After Wasabi Approval)**

Once Wasabi enables public access, we'll need to update the code to use the CloudFlare URLs instead of direct Wasabi URLs.

**Changes needed:**

### **videoUpload.ts:**
```typescript
// Instead of: https://s3.us-central-1.wasabisys.com/shoutoutorders/...
// Use: https://videos.shoutout.us/...
```

### **wasabiUpload.ts:**
```typescript
// Instead of: https://s3.us-central-1.wasabisys.com/shoutout-assets/...
// Use: https://assets.shoutout.us/...
```

I'll help you make these changes once Wasabi confirms public access is enabled.

---

## **Alternative: If You Don't Want to Use CloudFlare DNS**

If you don't want to change your DNS nameservers to CloudFlare:

1. Use CloudFlare's "CNAME Setup" (Partial Setup)
2. Or use a different subdomain not managed by your current DNS provider
3. Example: `cdn.shoutout.us` → point to CloudFlare, keep main domain elsewhere

---

## **Benefits of This Setup**

✅ **Reduced Wasabi Costs:** CloudFlare caches ~90%+ of requests  
✅ **Faster Loading:** CloudFlare's global CDN is much faster than direct Wasabi  
✅ **CORS Fixed:** CloudFlare can add proper CORS headers  
✅ **DDoS Protection:** CloudFlare's free DDoS protection  
✅ **Analytics:** See traffic stats in CloudFlare dashboard  

---

## **Estimated Timeline**

- CloudFlare setup: 10-15 minutes
- DNS propagation: 5-10 minutes
- Wasabi approval after providing info: 24-48 hours
- Code updates after approval: 15 minutes

---

## **Need Help?**

Let me know if you need assistance with:
- Setting up the CloudFlare account
- Creating the CNAME records
- Testing the setup
- Updating the code after approval

---

## **Quick Checklist**

- [ ] CloudFlare account created
- [ ] Domain added to CloudFlare (shoutout.us)
- [ ] CNAME for assets.shoutout.us created (proxied)
- [ ] CNAME for videos.shoutout.us created (proxied)
- [ ] Cache rules configured
- [ ] DNS propagation tested
- [ ] Reply sent to Wasabi with CNAME info and phone number
- [ ] Wait for Wasabi approval
- [ ] Update code to use CloudFlare URLs

