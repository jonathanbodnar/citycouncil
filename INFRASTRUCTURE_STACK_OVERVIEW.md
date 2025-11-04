# ShoutOut Infrastructure Stack Overview

**Last Updated:** November 3, 2025  
**Scale Target:** 100,000 monthly users + 500 orders/month  
**Current Status:** Development/Beta  

---

## 🏗️ Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                               │
│                    (Web Browsers)                           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN                           │
│              (DDoS Protection, Caching)                     │
│    • videos.shoutout.us (Video CDN)                        │
│    • images.shoutout.us (Image CDN)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   VERCEL (Frontend)                         │
│           • React SPA Hosting                               │
│           • Auto-scaling CDN                                │
│           • SSL/HTTPS                                       │
│           • Prerender.io for social sharing                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──────────────┬──────────────┬─────────────────┐
             ▼              ▼              ▼                 ▼
┌──────────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐
│    SUPABASE      │ │   WASABI   │ │ MAILGUN   │ │  CLOUDINARY  │
│  (PostgreSQL)    │ │ (S3 Video) │ │  (Email)  │ │   (Video     │
│  • Database      │ │  Storage   │ │           │ │ Processing)  │
│  • Auth          │ │            │ │           │ │              │
│  • Edge Funcs    │ │            │ │           │ │              │
│  • Realtime      │ │            │ │           │ │              │
└──────────────────┘ └────────────┘ └───────────┘ └──────────────┘
             │                                              │
             ▼                                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  FORTIS / LUNARPAY                           │
│                (Payment Processing)                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 Service Breakdown

### 1. Frontend Hosting: **Vercel** (Recommended) or Railway (Current)

**Purpose:** Host React SPA, serve static assets

**Current:** Railway
**Recommended:** Vercel

**Why Vercel:**
- ✅ Optimized for React/Next.js
- ✅ Global CDN (300+ locations)
- ✅ Zero cold starts
- ✅ Auto-scaling
- ✅ Better caching
- ✅ Lower cost at scale

**Specs:**
- **Plan:** Pro ($20/mo)
- **Bandwidth:** 1TB/month included
- **Deployments:** Unlimited
- **Serverless Functions:** 100GB-hours/month
- **Build Time:** 6,000 minutes/month

**At 100k users:**
- Bandwidth usage: ~200-300GB/month (within limits)
- Cost: $20/mo (flat rate)

---

### 2. Database & Backend: **Supabase**

**Purpose:** PostgreSQL database, authentication, Edge Functions, real-time subscriptions

**Specs:**
- **Plan:** Pro ($25/mo)
- **Database:** PostgreSQL 15
- **Storage:** 8GB included (500GB for $0.125/GB)
- **Bandwidth:** 250GB/month
- **Edge Functions:** 500k invocations/month
- **Auth:** 100k MAU included
- **Realtime:** 500 concurrent connections

**At 100k users:**
- Database size: ~5GB (orders, users, profiles)
- Bandwidth: ~100GB/month (API calls)
- Edge Function calls: ~200k/month
- Cost: $25/mo (within limits)

**Tables:**
- `users` (~100k rows)
- `talent_profiles` (~100 rows)
- `orders` (~500/month = 6k/year)
- `reviews` (~400/month = 5k/year)
- `notifications` (~2k/month = 24k/year)
- `help_messages` (~500/month = 6k/year)
- `vendor_bank_info` (~100 rows, encrypted)

**Edge Functions:**
- `watermark-video` - Adds watermark to videos
- `activecampaign-add` - Email marketing integration
- `onboarding-complete-notification` - Admin alerts
- `save-bank-info` - Secure bank data encryption (to be added)
- `fortis-intention` - Payment processing
- `fortis-verify` - Payment verification
- `instagram-oauth` - Social media integration
- `instagram-tracker` - Social media tracking

---

### 3. Video/Image Storage: **Wasabi S3**

**Purpose:** Store videos and images (S3-compatible object storage)

**Specs:**
- **Buckets:**
  - `shoutoutorders` - Video files
  - `shoutout-assets` - Profile images
  - `shoutout-backups` - Database backups (recommended)
- **Region:** us-central-1
- **Cost:** $0.0059/GB/month (no egress fees!)

**At 100k users:**
- Videos: 500/month × 50MB = 25GB/month
- Annual: 300GB total
- Images: ~10GB total
- **Cost:** ~$6/mo for 1TB

**CDN:**
- CloudFlare proxies Wasabi
- `videos.shoutout.us` → CloudFlare → Wasabi
- `images.shoutout.us` → CloudFlare → Wasabi

---

### 4. CDN & Security: **CloudFlare**

**Purpose:** Content delivery, DDoS protection, caching, DNS

**Specs:**
- **Plan:** Pro ($20/mo)
- **Features:**
  - Global CDN (275+ data centers)
  - DDoS protection (unmetered)
  - Web Application Firewall (WAF)
  - Rate limiting
  - Bot management
  - SSL/TLS

**At 100k users:**
- Bandwidth: Unlimited (flat rate)
- Cache hit ratio target: >80%
- **Cost:** $20/mo (flat rate)

**DNS Records:**
```
shoutout.us           A       76.76.21.21 (Vercel)
www.shoutout.us       CNAME   cname.vercel-dns.com
videos.shoutout.us    CNAME   shoutoutorders.s3.us-central-1.wasabisys.com (Proxied)
images.shoutout.us    CNAME   shoutout-assets.s3.us-central-1.wasabisys.com (Proxied)
mg.shoutout.us        CNAME   mailgun.org (Mailgun)
```

---

### 5. Email Service: **Mailgun**

**Purpose:** Transactional emails, notifications

**Specs:**
- **Plan:** Foundation ($35/mo)
- **Volume:** 50,000 emails/month included
- **Domains:** mg.shoutout.us

**At 100k users:**
- Order confirmations: ~500/month
- Order delivery notifications: ~400/month
- Marketing emails: ~5,000/month
- Help desk responses: ~500/month
- System notifications: ~1,000/month
- **Total:** ~7,500/month (within limits)

**Email Types:**
- Transactional (order confirmations, password resets)
- Notifications (order updates, new messages)
- Marketing (announcements, promotions)
- Admin alerts (new talent, support tickets)

---

### 6. Video Processing: **Cloudinary**

**Purpose:** Video watermarking, transformations

**Specs:**
- **Plan:** Pro ($89/mo recommended) or Free (current)
- **Transformations:** 25k/month (Pro)
- **Storage:** 75GB (Pro)
- **Bandwidth:** 150GB/month (Pro)

**At 100k users:**
- Video watermarking: ~500/month (admin downloads + user downloads)
- Image optimizations: ~1,000/month (featured cards)
- **Cost:** $89/mo (Pro) or pay-as-you-go

**Usage:**
- Watermark ShoutOut logo on videos
- AI upscaling for featured images (optional)
- Video format conversion

---

### 7. Payment Processing: **Fortis / LunarPay**

**Purpose:** Credit card processing

**Specs:**
- **Integration:** Fortis Commerce via LunarPay gateway
- **Merchant ID:** 299
- **Environment:** Production
- **Compliance:** PCI Level 1 (Fortis handles all card data)

**At 100k users:**
- Transactions: ~500/month
- Average transaction: $50
- Volume: $25,000/month
- **Processing fees:** ~2.9% + $0.30 = ~$750/month

**Note:** Payment fees are a business cost, not infrastructure cost

---

### 8. Marketing Automation: **ActiveCampaign**

**Purpose:** Email marketing, contact management

**Specs:**
- **Integration:** Via Supabase Edge Function
- **Lists:**
  - Beta waitlist
  - Master list (all users)

**At 100k users:**
- Contact sync: ~1,000/month (new signups)
- **Cost:** Depends on plan (not currently critical)

---

### 9. Error Tracking: **Sentry** (To Be Added)

**Purpose:** Error monitoring, performance tracking

**Specs:**
- **Plan:** Team ($26/mo)
- **Events:** 50k/month included
- **Retention:** 90 days
- **Performance monitoring:** Included

**At 100k users:**
- Error events: ~5k/month (target < 0.1% error rate)
- Transaction events: ~10k/month (10% sampling)
- **Cost:** $26/mo (within limits)

---

### 10. Uptime Monitoring: **UptimeRobot** (To Be Added)

**Purpose:** Uptime monitoring, alerts

**Specs:**
- **Plan:** Free
- **Monitors:** 50
- **Interval:** 5 minutes
- **Alerts:** Email, SMS, webhook

**At 100k users:**
- Monitors: 5 (homepage, API, videos, emails, payments)
- **Cost:** Free

---

### 11. Social Sharing: **Prerender.io**

**Purpose:** Pre-render pages for social media crawlers (Facebook, Twitter)

**Specs:**
- **Plan:** Current tier
- **Caching:** Recache on deploy

**At 100k users:**
- Cache requests: ~10k/month (social shares)
- **Cost:** Included in current plan

---

## 🔐 Security Infrastructure

### Authentication: **Supabase Auth**
- JWT-based authentication
- Email/password + social OAuth
- Row Level Security (RLS) for data access
- Session management
- Password reset flows

### Data Encryption:
- **At Rest:** Supabase (AES-256 encryption)
- **In Transit:** TLS 1.3 (all connections)
- **Bank Data:** AES-256-GCM (server-side only, moving to Edge Function)

### API Security:
- Rate limiting (to be implemented)
- Input validation (to be implemented with Zod)
- CORS configuration
- Security headers (to be added to server.js)

### Compliance:
- **PCI DSS:** SAQ-A compliant (no card data stored)
- **GDPR:** Ready (data export, deletion, retention policies)
- **CCPA:** Ready (California privacy rights)
- **SOC 2:** Via Supabase, Vercel (infrastructure providers)

---

## 📊 Cost Breakdown

### Monthly Infrastructure Costs (At Scale)
```
┌───────────────────────────────────────────────────────┐
│ Service              │ Plan          │ Cost      │ %  │
├───────────────────────────────────────────────────────┤
│ Supabase             │ Pro           │ $25       │ 11%│
│ Vercel               │ Pro           │ $20       │ 9% │
│ Wasabi Storage       │ Pay-as-go     │ $6        │ 3% │
│ CloudFlare           │ Pro           │ $20       │ 9% │
│ Mailgun              │ Foundation    │ $35       │ 16%│
│ Cloudinary           │ Pro           │ $89       │ 40%│
│ Sentry               │ Team          │ $26       │ 12%│
│ UptimeRobot          │ Free          │ $0        │ 0% │
│ Domain & SSL         │ Annual/12     │ $2        │ 1% │
├───────────────────────────────────────────────────────┤
│ TOTAL                │               │ $223      │100%│
└───────────────────────────────────────────────────────┘

Revenue at Scale: 500 orders/mo @ $50 avg = $25,000/mo
Infrastructure Cost: $223/mo = 0.89% of revenue ✅
```

### Cost at 10x Scale (1M users, 5k orders/month)
```
Supabase Team:      $100/mo  (more compute, storage)
Vercel Pro:         $50/mo   (increased bandwidth)
Wasabi:             $20/mo   (1TB storage)
CloudFlare Pro:     $20/mo   (flat rate)
Mailgun Pro:        $90/mo   (100k emails)
Cloudinary Pro:     $224/mo  (more transformations)
Sentry Business:    $80/mo   (500k events)
─────────────────────────────────────────────
TOTAL:              ~$584/mo (1.17% of revenue)
```

**Scalability:** Infrastructure costs grow slower than revenue (economies of scale)

---

## 🔄 Data Flow Diagrams

### User Registration Flow
```
User Browser
    │
    ├─ POST /signup → Vercel
    │                   │
    │                   ├─ Supabase Auth.signUp()
    │                   │       │
    │                   │       ├─ Creates user record
    │                   │       └─ Sends confirmation email (Mailgun)
    │                   │
    │                   └─ Returns JWT token
    │
    └─ Redirects to /dashboard
```

### Order Creation Flow
```
User Browser
    │
    ├─ Fills order form
    │
    ├─ Clicks "Pay & Submit"
    │       │
    │       ├─ Frontend validates (Zod)
    │       │
    │       ├─ Calls Fortis/LunarPay API
    │       │       │
    │       │       ├─ Processes payment
    │       │       └─ Returns transaction ID
    │       │
    │       ├─ Creates order in Supabase
    │       │       │
    │       │       ├─ Inserts order record
    │       │       ├─ Triggers notification (Edge Function)
    │       │       │       │
    │       │       │       └─ Mailgun sends emails:
    │       │       │           • User: Order confirmation
    │       │       │           • Talent: New order alert
    │       │       │
    │       │       └─ Creates notification records
    │       │
    │       └─ Redirects to /dashboard
    │
    └─ Shows success message
```

### Video Upload & Delivery Flow
```
Talent Dashboard
    │
    ├─ Selects video file
    │
    ├─ Uploads to Wasabi (via AWS SDK)
    │       │
    │       └─ Stores at: s3://shoutoutorders/videos/[order-id].mp4
    │
    ├─ Calls watermark-video Edge Function
    │       │
    │       ├─ Fetches original from Wasabi
    │       ├─ Uploads to Cloudinary with watermark
    │       ├─ Caches result in watermarked_videos_cache table
    │       └─ Returns watermarked URL
    │
    ├─ Updates order.video_url in Supabase
    │       │
    │       ├─ Triggers notification Edge Function
    │       │       │
    │       │       └─ Mailgun sends email to user
    │       │
    │       └─ Updates order status to "delivered"
    │
    └─ User can download video (watermarked via CloudFlare CDN)
```

### Real-time Notification Flow
```
Event Occurs (Order update, Message, etc.)
    │
    ├─ Database trigger fires
    │
    ├─ Supabase Realtime broadcasts change
    │       │
    │       ├─ WebSocket connection to client
    │       │       │
    │       │       └─ Client updates UI instantly
    │       │
    │       └─ Notification badge updates
    │
    └─ Edge Function sends email (Mailgun)
```

---

## 🔧 Technology Stack

### Frontend
- **Framework:** React 19.2.0
- **Language:** TypeScript 4.9.5
- **Routing:** React Router DOM 7.9.3
- **Styling:** Tailwind CSS 3.4.18
- **UI Components:** Headless UI 2.2.9
- **Icons:** Heroicons 2.2.0
- **Forms:** React Hook Form 7.64.0
- **Notifications:** React Hot Toast 2.6.0
- **Build:** Create React App (React Scripts 5.0.1)

### Backend
- **Database:** PostgreSQL 15 (via Supabase)
- **API:** Supabase RESTful API + Realtime
- **Auth:** Supabase Auth (JWT-based)
- **Serverless:** Supabase Edge Functions (Deno runtime)

### Infrastructure
- **Hosting:** Vercel (recommended) / Railway (current)
- **CDN:** CloudFlare Pro
- **Storage:** Wasabi S3-compatible
- **Email:** Mailgun
- **Video Processing:** Cloudinary
- **Monitoring:** Sentry (to be added)
- **Uptime:** UptimeRobot (to be added)

### Payment
- **Gateway:** Fortis Commerce (via LunarPay)
- **PCI Compliance:** SAQ-A (no card data stored)

### DevOps
- **Version Control:** Git + GitHub
- **CI/CD:** Vercel automatic deployments
- **Secrets Management:** Vercel Environment Variables + 1Password
- **Monitoring:** Sentry + Vercel Analytics + CloudFlare Analytics
- **Backups:** Supabase PITR + Weekly manual to Wasabi

---

## 🌐 DNS Configuration

```
Domain: shoutout.us (Managed by CloudFlare)

┌─────────────────────────────────────────────────────────┐
│ Record Type │ Name    │ Target                         │
├─────────────────────────────────────────────────────────┤
│ A           │ @       │ 76.76.21.21 (Vercel)           │
│ CNAME       │ www     │ cname.vercel-dns.com           │
│ CNAME       │ videos  │ shoutoutorders.s3...wasabi.com │
│ CNAME       │ images  │ shoutout-assets.s3...wasabi.com│
│ TXT         │ @       │ SPF record (Mailgun)           │
│ TXT         │ _dmarc  │ DMARC policy                   │
│ TXT         │ k1._... │ DKIM key (Mailgun)             │
│ MX          │ @       │ Mailgun MX records             │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Architecture

### Authentication Flow
```
1. User enters email/password
2. Frontend → Supabase Auth
3. Supabase validates credentials
4. Returns JWT token (stored in localStorage)
5. JWT included in all API requests
6. Supabase validates JWT on each request
7. RLS policies enforce data access
```

### Data Access Control (Row Level Security)
```sql
-- Example: Users can only see their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Example: Talent can see orders assigned to them
CREATE POLICY "Talent can view assigned orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM talent_profiles 
      WHERE talent_profiles.user_id = auth.uid() 
        AND talent_profiles.id = orders.talent_id
    )
  );

-- Example: Only admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
        AND users.user_type = 'admin'
    )
  );
```

### Secrets Management
```
Frontend Environment Variables (Public):
  • REACT_APP_SUPABASE_URL
  • REACT_APP_SUPABASE_ANON_KEY (read-only, public)
  • REACT_APP_*_API_URL (public endpoints)

Backend Environment Variables (Private):
  • SUPABASE_SERVICE_ROLE_KEY (full access, Edge Functions only)
  • BANK_ENCRYPTION_KEY (server-side only)
  • MAILGUN_API_KEY (server-side only)
  • CLOUDINARY_API_SECRET (server-side only)
  • Database connection strings (server-side only)

Storage Locations:
  • Vercel: Environment Variables (encrypted at rest)
  • Supabase: Edge Function secrets (encrypted at rest)
  • 1Password: Master backup (encrypted)
  • Physical safe: Printed backup (for disaster recovery)
```

---

## 📈 Scalability Limits

### Current Infrastructure Limits
```
┌──────────────────────────────────────────────────────────┐
│ Component        │ Current Limit      │ Action Needed   │
├──────────────────────────────────────────────────────────┤
│ Supabase Pro     │ 100k MAU           │ At 100k: OK ✅  │
│                  │ 8GB database       │ At 5GB: OK ✅   │
│                  │ 250GB bandwidth    │ At 100GB: OK ✅ │
│                  │                    │                 │
│ Vercel Pro       │ 1TB bandwidth      │ At 300GB: OK ✅ │
│                  │ Unlimited requests │ OK ✅           │
│                  │                    │                 │
│ Wasabi           │ Unlimited          │ OK ✅           │
│                  │ $0.0059/GB/month   │ Linear cost     │
│                  │                    │                 │
│ CloudFlare Pro   │ Unlimited          │ OK ✅           │
│                  │ Flat $20/mo        │ Best value!     │
│                  │                    │                 │
│ Mailgun Found.   │ 50k emails/month   │ At 7k: OK ✅    │
│                  │                    │ Upgrade at 40k  │
│                  │                    │                 │
│ Cloudinary Pro   │ 25k transforms     │ At 1k: OK ✅    │
│                  │ 150GB bandwidth    │ OK ✅           │
└──────────────────────────────────────────────────────────┘
```

### Bottlenecks to Watch
1. **Database connections** - Monitor in Supabase dashboard
   - Limit: ~500 concurrent on Pro
   - Solution: Connection pooling (already enabled)

2. **Edge Function cold starts** - First request may be slow
   - Limit: ~1s cold start
   - Solution: Keep-alive pings or upgrade to dedicated

3. **Mailgun sending rate** - Throttled if burst > 10k/hour
   - Limit: Foundation plan can burst to 10k/hour
   - Solution: Queue emails if needed

4. **Cloudinary transformations** - Quota exhaustion
   - Limit: 25k/month on Pro
   - Solution: Cache transformed videos, upgrade plan

---

## 🚀 Scaling Roadmap

### Phase 1: 0 - 10k users (Months 1-3)
**Infrastructure:** Current stack is fine
**Focus:** Product-market fit, user acquisition
**Actions:**
- Monitor usage closely
- Fix bugs quickly
- Iterate on features

---

### Phase 2: 10k - 50k users (Months 4-8)
**Infrastructure:** Start optimizations
**Focus:** Performance, reliability
**Actions:**
- Implement code splitting ✅
- Add pagination ✅
- Optimize queries ✅
- Add monitoring (Sentry, UptimeRobot) ✅
- Migrate to Vercel ✅

---

### Phase 3: 50k - 100k users (Months 9-12)
**Infrastructure:** Scale up tiers
**Focus:** Stability, compliance
**Actions:**
- Upgrade Supabase if needed
- Optimize database (indexes, caching)
- Implement rate limiting
- Complete compliance reviews (GDPR, PCI)
- Set up disaster recovery

---

### Phase 4: 100k+ users (Year 2+)
**Infrastructure:** Enterprise considerations
**Focus:** Global expansion, performance
**Actions:**
- Consider multi-region database (Supabase multi-region)
- Implement Redis caching layer
- Consider dedicated servers for Edge Functions
- Explore CDN optimizations (CloudFlare Enterprise)
- Consider hiring DevOps engineer

---

## 🎯 Performance Targets

### Page Load Times (LCP - Largest Contentful Paint)
- **Homepage:** < 2.5s ✅ Target
- **Talent Profile:** < 2.0s ✅ Target
- **Dashboard:** < 3.0s ✅ Target
- **Order Page:** < 2.5s ✅ Target

### API Response Times (p95)
- **Database queries:** < 100ms
- **Edge Functions:** < 500ms
- **Video upload:** < 30s (for 50MB)
- **Image upload:** < 5s

### Availability
- **Target SLA:** 99.9% uptime (8.76 hours downtime/year)
- **Realistic:** 99.95% with current stack
- **Enterprise:** 99.99% (would require multi-region, more expensive)

---

## 🔍 Monitoring Strategy

### What to Monitor

**Application Health:**
- Uptime (UptimeRobot)
- Error rate (Sentry)
- Response times (Vercel Analytics)
- Core Web Vitals (Vercel Analytics)

**Infrastructure Health:**
- Database CPU/Memory (Supabase Dashboard)
- Database connections (Supabase Dashboard)
- Storage usage (Wasabi Console)
- CDN cache hit ratio (CloudFlare Analytics)
- Email deliverability (Mailgun Dashboard)

**Business Metrics:**
- Orders/day
- New users/day
- Revenue/day
- Average order value
- Talent utilization rate

### Alert Thresholds
```
CRITICAL (Page immediately):
  • Site down > 2 minutes
  • Database CPU > 90%
  • Error rate > 5%
  • Payment gateway down

HIGH (Email immediately):
  • Database CPU > 80%
  • Response time p95 > 3s
  • Error rate > 1%
  • Cache hit ratio < 60%

MEDIUM (Email within 1 hour):
  • Storage > 80%
  • Email bounce rate > 3%
  • Edge Function errors > 50/hour

LOW (Daily digest):
  • Slow queries detected
  • Unusual traffic patterns
  • Cost anomalies
```

---

## 🔄 Backup & Recovery Strategy

### What's Backed Up
1. **Database:** Daily automated (Supabase PITR) + Weekly manual to Wasabi
2. **Videos:** Versioned in Wasabi (3 versions)
3. **Images:** Versioned in Wasabi (3 versions)
4. **Environment Variables:** Encrypted in 1Password
5. **DNS Configuration:** Documented in CloudFlare + exported monthly
6. **Code:** Git repository (GitHub)

### Recovery Procedures

**Database Corruption:**
- Use Supabase Point-in-Time Recovery
- Or restore from weekly backup
- RTO: 2 hours, RPO: 24 hours

**Video Storage Loss:**
- Restore from Wasabi versioning
- Or from backup bucket (if cross-region replication enabled)
- RTO: 4 hours, RPO: 0 (versioned)

**Complete Infrastructure Failure:**
- Provision new Vercel project
- Restore database from backup
- Update DNS to new deployment
- Restore videos from backup
- RTO: 8 hours, RPO: 24 hours

---

## 🌍 Geographic Distribution

### Current: Single Region (US)
```
Frontend (Vercel):     Global CDN (300+ locations)
Database (Supabase):   US East (AWS)
Storage (Wasabi):      US Central
CDN (CloudFlare):      Global (275+ locations)
```

### Future: Multi-Region (If expanding internationally)
```
Frontend (Vercel):     Global (no change)
Database (Supabase):   US + EU replicas
Storage (Wasabi):      US + EU buckets
CDN (CloudFlare):      Global (no change)

Additional Cost: ~$100/mo for EU infrastructure
```

---

## 📞 Support Contacts

### Service Providers
- **Supabase:** support@supabase.io | https://supabase.com/dashboard/support
- **Vercel:** support@vercel.com | Dashboard → Help
- **CloudFlare:** Dashboard → Support Ticket
- **Wasabi:** support@wasabi.com | 1-844-WASABI-1
- **Mailgun:** support@mailgun.com | Dashboard → Support
- **Cloudinary:** support@cloudinary.com
- **Fortis/LunarPay:** [Contact provided by payment processor]

### Internal Team
- **Tech Lead:** jb@shoutout.us
- **DevOps:** devops@shoutout.us
- **Support:** support@shoutout.us
- **Security:** security@shoutout.us
- **Privacy:** privacy@shoutout.us

---

## 📚 Related Documentation

- `DEVOPS_SCALABILITY_TASKS.md` - Infrastructure tasks
- `CODE_SCALABILITY_TASKS.md` - Code optimization tasks
- `DEPLOYMENT.md` - Deployment procedures
- `WASABI_CORS_SETUP.md` - Wasabi configuration
- `CLOUDFLARE_DNS_FIX.md` - DNS configuration
- `ONBOARDING_NOTIFICATION_SETUP.md` - Email setup
- `RAILWAY_PRERENDER_SETUP.md` - Social sharing setup

---

## 🔄 Change Log

### November 2025
- Initial infrastructure documented
- Identified Vercel as recommended host
- Documented security hardening needs
- Created scalability roadmap

### [Next Review Date]
- Review cost efficiency
- Update scalability limits
- Document new services
- Update contact information

---

**This document should be reviewed quarterly and updated as infrastructure evolves.**

