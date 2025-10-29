# Social Media Tracking - Quick Start Guide

## 🎯 What We're Tracking

For talent in the promotion program ($200/month ad spend), we track:

1. **Bio Links:** Does their bio on Instagram/TikTok/Twitter contain `shoutout.us`?
2. **Tagged Posts:** How many times do they post and tag `@shoutoutvoice`?

This data displays in: **Admin Dashboard → Social Tracking tab**

---

## ✅ Already Built

✅ Database tables (`social_media_tags`, `social_media_bio_tracking`)  
✅ Admin UI component showing the data  
✅ Date filtering (Last 30 days, Last 90 days, etc.)  

---

## 🚀 Implementation Options

### **Option 1: Automated API Tracking (Recommended for Scale)**

**Best for:** 10+ talent, long-term solution

**Pros:**
- Fully automated
- Real-time tracking
- Scalable

**Cons:**
- Requires API approvals (2-4 weeks)
- More complex setup
- Costs money after free tier

**Steps:**
1. Apply for API access (see Platform Setup below)
2. Create Supabase Edge Functions
3. Set up daily cron job
4. Store API tokens as environment variables

---

### **Option 2: Manual Admin Entry (Quick Start)**

**Best for:** <10 talent, MVP testing, while waiting for API approval

**Pros:**
- Works immediately
- No API costs
- Simple to implement

**Cons:**
- Manual effort
- Not real-time
- Doesn't scale well

**Implementation:** I can build a simple admin form where you (or an assistant) can:
- Check talent socials weekly
- Mark if they have the link in bio
- Enter tagged post URLs manually

**Takes:** ~30 minutes to build

---

### **Option 3: Hybrid Approach (Recommended Initially)**

**Best for:** Starting immediately while setting up automation

1. **Now:** Use manual entry for initial testing
2. **Week 2-4:** Apply for Instagram + Twitter APIs (easier to get)
3. **Month 2:** Fully automated tracking

---

## 📱 Platform Setup Guide

### **Instagram (Easiest - Start Here)**

**Time to get access:** 1-2 days

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Create an app → Choose "Business" type
3. Add product: "Instagram Basic Display"
4. Get your App ID and App Secret
5. Add test users (your talent accounts)

**What you can track:**
- Bio text and website link
- Recent posts and captions
- Hashtags and mentions

**Free tier:** 200 calls/hour (plenty for daily checks)

---

### **Twitter/X (Medium Difficulty)**

**Time to get access:** 3-7 days (requires manual approval)

1. Go to [developer.twitter.com](https://developer.twitter.com/)
2. Apply for "Elevated" access (explain use case)
3. Create app and get Bearer Token
4. Test with Twitter API v2

**What you can track:**
- Bio and website URL
- Recent tweets
- Mentions of @shoutoutvoice

**Free tier:** 10,000 tweets/month (enough for ~20 talent)

**Cost:** $100/month for more

---

### **TikTok (Hardest - Do Last)**

**Time to get access:** 2-8 weeks (requires business verification)

1. Go to [developers.tiktok.com](https://developers.tiktok.com/)
2. Apply for "Content Posting API" or "Display API"
3. May require business documents
4. Often requires phone call with TikTok team

**Alternative:** Use TikTok embed API to manually check profiles

**Recommendation:** Start with manual entry for TikTok

---

## 🛠️ Quick Implementation Steps

### **For Manual Entry (30 min setup):**

Would you like me to build:
1. Simple admin form to log bio link status
2. Simple admin form to log tagged posts
3. Display existing data (already working)

### **For Automated Tracking (2-4 weeks):**

**Phase 1: Instagram (Week 1-2)**
1. Apply for Meta/Instagram API access
2. I'll create Edge Function for Instagram tracking
3. Set up OAuth for talent to connect accounts
4. Deploy and test

**Phase 2: Twitter (Week 2-3)**
1. Apply for Twitter Elevated access
2. I'll create Edge Function for Twitter tracking
3. Add Twitter username field to talent profiles
4. Deploy and test

**Phase 3: TikTok (Week 3-6)**
1. Apply for TikTok API access
2. Use manual entry while waiting
3. Switch to automated when approved

**Phase 4: Automation (Week 4)**
1. Set up daily cron job in Supabase
2. Runs at 2 AM daily
3. Checks all talent accounts
4. Updates database automatically

---

## 💰 Cost Breakdown

| Platform | Free Tier | After Free Tier |
|----------|-----------|----------------|
| **Instagram** | 200 calls/hr (~50 talent) | Depends on usage, typically free |
| **Twitter** | 10K tweets/month (~20 talent) | $100/month for 100K tweets |
| **TikTok** | Varies by approval | May require business plan |
| **Supabase Cron** | Included | Included |

**For 10-20 talent:** Should stay within free tiers  
**For 50+ talent:** ~$100-200/month total

---

## 🎬 What Should We Build First?

Pick one:

### **A. Manual Admin Form (Quick Win - 30 minutes)**
- Build simple form in admin panel
- Manually log bio links and posts
- Get data flowing immediately
- Perfect for initial testing

### **B. Instagram Automation (Complete Solution - 1 week)**
- Apply for Instagram API today
- Build OAuth flow for talent
- Automatic daily tracking
- Start with most popular platform

### **C. All Three Manual Forms (1 hour)**
- Forms for Instagram, Twitter, TikTok
- Quick data entry workflow
- Use while APIs get approved
- Switch to automated later

---

## 📊 Example: What Admins Will See

**Social Tracking Table:**

| Talent Name | Instagram Bio | Instagram Posts | Twitter Bio | Twitter Posts | TikTok Bio | TikTok Posts | Last Checked |
|-------------|---------------|-----------------|-------------|---------------|------------|--------------|--------------|
| Clint Howard | ✅ Yes | 3 | ✅ Yes | 2 | ❌ No | 0 | 2 hours ago |
| Mike Huckabee | ✅ Yes | 5 | ❌ No | 0 | ✅ Yes | 1 | 2 hours ago |
| Matt Serra | ❌ No | 0 | ✅ Yes | 1 | ❌ No | 0 | 2 hours ago |

**With date filter:**
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range

---

## 🤔 My Recommendation

**For right now (while waiting for Wasabi approval):**

1. **Option A: Build manual admin form** (30 min)
   - Get something working today
   - Start tracking your first few talent
   - Learn what data is most valuable

2. **Meanwhile:** Apply for Instagram + Twitter APIs
   - Instagram: fastest approval
   - Twitter: good coverage
   - TikTok: defer for later

3. **Next week:** Switch Instagram to automated
4. **Week after:** Switch Twitter to automated
5. **Keep TikTok manual** until their API approves (if ever)

**This gets you:**
- ✅ Working immediately
- ✅ Data for your first talent
- ✅ Path to automation
- ✅ Minimal cost

---

## ❓ Questions for You

1. **How many talent** do you expect in the promotion program?
   - <10: Manual is fine
   - 10-50: Hybrid approach
   - 50+: Need full automation

2. **Who will check socials?**
   - You: Manual is fine initially
   - Assistant/employee: Build good UI
   - Nobody: Need automation

3. **How often to check?**
   - Weekly: Manual works
   - Daily: Need automation
   - Real-time: Full API integration

4. **Budget for APIs?**
   - $0: Use free tiers + manual
   - $100/month: Twitter Elevated + Instagram
   - $200+/month: All automated

---

## 🎯 Next Step

**Let me know which you prefer:**

**A.** "Build the manual admin form now" (30 min - works today)  
**B.** "Apply for Instagram API and build automation" (1 week - best long-term)  
**C.** "Explain how to apply for APIs first" (guide me through applications)  
**D.** "Wait until we have more talent to worry about this"  

What works best for your timeline and budget?

