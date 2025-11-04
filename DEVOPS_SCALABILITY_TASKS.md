# DevOps & Infrastructure Tasks - Scale to 100k Users

**Target:** 100,000 monthly users + 500 orders/month  
**Timeline:** 4 weeks  
**Est. Monthly Cost:** $223/mo  

---

## 📋 Priority 1: Database Optimization

### Task 1.1: Add Database Indexes
**Platform:** Supabase SQL Editor  
**Time:** 30 minutes  
**Impact:** Critical - 10x query speed improvement

```sql
-- Connect to Supabase SQL Editor and run:
CREATE INDEX CONCURRENTLY idx_talent_profiles_username ON talent_profiles(username);
CREATE INDEX CONCURRENTLY idx_talent_profiles_category ON talent_profiles(category);
CREATE INDEX CONCURRENTLY idx_talent_profiles_is_active ON talent_profiles(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_talent_profiles_featured ON talent_profiles(is_featured) WHERE is_featured = true;
CREATE INDEX CONCURRENTLY idx_orders_user_id_created ON orders(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_orders_talent_id_status ON orders(talent_id, status);
CREATE INDEX CONCURRENTLY idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_notifications_user_id_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX CONCURRENTLY idx_reviews_talent_id ON reviews(talent_id);
CREATE INDEX CONCURRENTLY idx_help_messages_user_id_created ON help_messages(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_help_messages_is_resolved ON help_messages(is_resolved);

-- Analyze tables for query optimization
ANALYZE talent_profiles;
ANALYZE orders;
ANALYZE notifications;
ANALYZE reviews;
ANALYZE help_messages;
```

**Verification:**
```sql
-- Check indexes were created
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

---

### Task 1.2: Enable Connection Pooling
**Platform:** Supabase Dashboard  
**Time:** 10 minutes  
**Impact:** High - Prevents connection exhaustion

1. Go to Supabase Dashboard → Settings → Database
2. Enable "Enable connection pooler"
3. Copy the pooled connection string
4. Update environment variables in Vercel/Railway:
   - Use format: `postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[PROJECT_ID].pooler.supabase.com:6543/postgres`
5. Test connection from application

**Cost:** Included in Supabase Pro ($25/mo)

---

### Task 1.3: Configure Database Autovacuum
**Platform:** Supabase SQL Editor  
**Time:** 5 minutes  
**Impact:** Medium - Prevents bloat

```sql
-- Aggressive autovacuum for high-write tables
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE notifications SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE help_messages SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE reviews SET (autovacuum_vacuum_scale_factor = 0.2);

-- Check autovacuum settings
SELECT relname, reloptions 
FROM pg_class 
WHERE relname IN ('orders', 'notifications', 'help_messages', 'reviews');
```

---

### Task 1.4: Set up Database Backups
**Platform:** Supabase Dashboard  
**Time:** 15 minutes  
**Impact:** Critical - Disaster recovery

1. Supabase Dashboard → Settings → Database → Point-in-Time Recovery
2. Enable PITR (included in Pro tier)
3. Configure backup retention: 7 days minimum
4. Test restore once:
   - Create test database
   - Restore from backup
   - Verify data integrity

**Schedule Manual Backups (Weekly):**
```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h db.utafetamgwukkbrlezev.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -b \
  -v \
  -f "backup_shoutout_${DATE}.dump"

# Upload to Wasabi
aws s3 cp "backup_shoutout_${DATE}.dump" s3://shoutout-backups/database/
```

---

## 📋 Priority 2: Hosting Migration

### Task 2.1: Set up Vercel Account
**Platform:** Vercel  
**Time:** 30 minutes  
**Impact:** High - Better performance, lower cost

1. Sign up at [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import from GitHub: `ShoutOutUS/frontend`
4. Configure build settings:
   - **Framework Preset:** Create React App
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
   - **Install Command:** `npm install`
   - **Root Directory:** `./`

5. Click "Deploy" (this is a test deployment)

**Cost:** $20/mo (Pro plan recommended)

---

### Task 2.2: Configure Environment Variables in Vercel
**Platform:** Vercel Dashboard  
**Time:** 15 minutes  
**Impact:** Critical - App won't work without these

Vercel Dashboard → Project → Settings → Environment Variables

**Add all variables (copy from Railway):**
```
REACT_APP_SUPABASE_URL=https://utafetamgwukkbrlezev.supabase.co
REACT_APP_SUPABASE_ANON_KEY=[your_key]
REACT_APP_LUNARPAY_API_URL=https://devapp.lunarpay.com
REACT_APP_LUNARPAY_API_KEY=[your_key]
REACT_APP_LUNARPAY_MERCHANT_ID=299
REACT_APP_LUNARPAY_ENV=production
REACT_APP_WASABI_ACCESS_KEY_ID=[your_key]
REACT_APP_WASABI_SECRET_ACCESS_KEY=[your_key]
REACT_APP_WASABI_BUCKET_NAME=shoutout-videos
REACT_APP_WASABI_REGION=us-east-1
REACT_APP_MAILGUN_API_KEY=[your_key]
REACT_APP_MAILGUN_DOMAIN=mg.shoutout.us
REACT_APP_ADMIN_FEE_PERCENTAGE=15
REACT_APP_APP_NAME=ShoutOut
REACT_APP_CLOUDINARY_CLOUD_NAME=dl85nqovp
REACT_APP_CLOUDINARY_UPLOAD_PRESET=[your_preset]
REACT_APP_ACTIVECAMPAIGN_API_KEY=[your_key]
REACT_APP_ACTIVECAMPAIGN_URL=[your_url]
REACT_APP_SENTRY_DSN=[after Sentry setup]
PRERENDER_TOKEN=[your_token]
```

**Important:** Do NOT add `REACT_APP_BANK_ENCRYPTION_KEY` (security risk - will be moved to backend)

---

### Task 2.3: Configure Custom Domain in Vercel
**Platform:** Vercel Dashboard + DNS Provider  
**Time:** 20 minutes  
**Impact:** Critical - User-facing

1. Vercel Dashboard → Project → Settings → Domains
2. Click "Add Domain"
3. Add domains:
   - `shoutout.us`
   - `www.shoutout.us`

4. Update DNS records at your domain provider:

**For Cloudflare DNS:**
```
Type: A      Name: @      Value: 76.76.21.21        Proxy: Off (grey cloud)
Type: CNAME  Name: www    Value: cname.vercel-dns.com   Proxy: Off (grey cloud)
```

**For other DNS providers:**
```
Type: A      Name: @      Value: 76.76.21.21
Type: CNAME  Name: www    Value: cname.vercel-dns.com
```

5. Wait for DNS propagation (5-60 minutes)
6. Verify SSL certificate is issued automatically
7. Test: `https://shoutout.us` and `https://www.shoutout.us`

---

### Task 2.4: Set up Preview Deployments
**Platform:** Vercel Dashboard  
**Time:** 5 minutes  
**Impact:** Medium - Helps with testing

1. Vercel Dashboard → Project → Settings → Git
2. Enable "Automatic Deployments" (should be on by default)
3. Configure:
   - ✅ Production Branch: `main`
   - ✅ Preview Deployments: Enable for all branches
   - ✅ Deploy on push
   - ✅ Deploy on pull request

**Result:** Every PR gets a unique preview URL: `https://shoutout-pr-123.vercel.app`

---

### Task 2.5: Cutover from Railway to Vercel
**Platform:** DNS Provider  
**Time:** 30 minutes  
**Impact:** Critical - Production deployment

**Pre-Cutover Checklist:**
- [ ] All environment variables configured in Vercel
- [ ] Test deployment successful on `*.vercel.app` domain
- [ ] All features tested on staging URL
- [ ] Database connection working
- [ ] Video uploads working
- [ ] Email notifications working
- [ ] Payment flow tested
- [ ] Prerender.io working for social sharing

**Cutover Steps:**
1. **Announce maintenance window** (off-peak hours, 2 AM - 4 AM)
2. **Update DNS** to point to Vercel (see Task 2.3)
3. **Wait for DNS propagation** (check with `dig shoutout.us`)
4. **Test production URL:** `https://shoutout.us`
5. **Monitor for errors** in Vercel Dashboard → Deployments → Logs
6. **Keep Railway running** for 24 hours as backup
7. **After 24 hours:** Scale down Railway (don't delete yet)
8. **After 7 days:** Delete Railway deployment

**Rollback Plan (if issues):**
- Revert DNS to Railway IP
- Debug issue on Vercel staging
- Retry cutover next maintenance window

---

## 📋 Priority 3: CDN Setup

### Task 3.1: Configure CloudFlare for Wasabi
**Platform:** CloudFlare DNS  
**Time:** 20 minutes  
**Impact:** High - Faster video delivery, lower costs

1. CloudFlare Dashboard → DNS → Add record

**Add CNAME records:**
```
Type: CNAME  Name: videos   Target: shoutoutorders.s3.us-central-1.wasabisys.com   Proxy: ON (orange cloud)
Type: CNAME  Name: images   Target: shoutout-assets.s3.us-central-1.wasabisys.com  Proxy: ON (orange cloud)
```

2. CloudFlare Dashboard → Caching → Configuration
   - Cache Level: Standard
   - Browser Cache TTL: 4 hours
   - Always Online: ON

3. Create Page Rule (CloudFlare Dashboard → Rules → Page Rules):
   - URL: `videos.shoutout.us/*`
   - Settings:
     - Cache Level: Cache Everything
     - Edge Cache TTL: 1 month
     - Browser Cache TTL: 4 hours

4. Create Page Rule for images:
   - URL: `images.shoutout.us/*`
   - Settings:
     - Cache Level: Cache Everything
     - Edge Cache TTL: 1 month
     - Browser Cache TTL: 1 day

**Verification:**
```bash
# Check DNS propagation
dig videos.shoutout.us
dig images.shoutout.us

# Test video loading
curl -I https://videos.shoutout.us/[test-video-path].mp4

# Check for CloudFlare headers
# Should see: cf-cache-status: HIT (after 2nd request)
```

**Cost:** $20/mo (CloudFlare Pro)

---

### Task 3.2: Enable CloudFlare Security
**Platform:** CloudFlare Dashboard  
**Time:** 15 minutes  
**Impact:** High - DDoS protection

1. **Enable Bot Fight Mode:**
   - CloudFlare → Security → Bots
   - Enable "Bot Fight Mode"

2. **Configure Rate Limiting:**
   - CloudFlare → Security → WAF → Rate limiting rules
   - Create rule: "API Rate Limit"
     - If: `http.request.uri.path contains "/api/"`
     - AND: `rate > 100 requests per 1 minute`
     - Then: Challenge

3. **Configure Firewall Rules:**
   - CloudFlare → Security → WAF → Firewall rules
   - Create rule: "Block Known Bad Actors"
     - If: `cf.threat_score > 50`
     - Then: Block

4. **Enable Under Attack Mode (only if needed):**
   - CloudFlare → Overview → Quick Actions
   - Toggle "Under Attack Mode" (only during DDoS)

**Cost:** Included in Pro plan

---

## 📋 Priority 4: Email Infrastructure

### Task 4.1: Upgrade Mailgun Plan
**Platform:** Mailgun Dashboard  
**Time:** 5 minutes  
**Impact:** Medium - Email reliability

1. Mailgun Dashboard → Account → Billing → Plans
2. Current: Flex (pay-as-you-go)
3. Upgrade to: **Foundation ($35/mo)**
   - 50,000 emails/month included
   - Better deliverability
   - Priority support

**Estimated Usage:**
- Transactional emails: ~2,000/month (order confirmations, notifications)
- Marketing emails: ~5,000/month (announcements)
- **Total:** ~7,000/month (within Foundation tier)

---

### Task 4.2: Verify Email Authentication
**Platform:** Mailgun Dashboard  
**Time:** 10 minutes  
**Impact:** Critical - Email deliverability

1. Mailgun Dashboard → Sending → Domains → `mg.shoutout.us`
2. Check DNS Records → All should have **green checkmarks:**
   - ✅ SPF Record
   - ✅ DKIM Record
   - ✅ DMARC Record
   - ✅ MX Records

**If any are red (not verified):**
1. Copy the DNS records from Mailgun
2. Add to CloudFlare DNS
3. Wait 10-30 minutes for verification
4. Click "Verify DNS Settings" in Mailgun

**Test Email Delivery:**
```bash
# Send test email via API
curl -s --user 'api:YOUR_API_KEY' \
  https://api.mailgun.net/v3/mg.shoutout.us/messages \
  -F from='ShoutOut <notifications@mg.shoutout.us>' \
  -F to='your-email@example.com' \
  -F subject='Test Email' \
  -F text='Testing email delivery'
```

---

### Task 4.3: Set up Email Monitoring
**Platform:** Mailgun Dashboard  
**Time:** 10 minutes  
**Impact:** Medium - Catch deliverability issues

1. Mailgun Dashboard → Analytics
2. Set up alerts (Settings → Webhooks → Add Webhook):

**Alert Thresholds:**
- **Bounce Rate > 5%** → Email to: `devops@shoutout.us`
- **Complaint Rate > 0.1%** → Email to: `devops@shoutout.us`
- **Daily Volume > 1,000** → Email to: `devops@shoutout.us`

**Monitor Daily:**
- Delivered rate (should be > 95%)
- Bounce rate (should be < 5%)
- Complaint rate (should be < 0.1%)

---

## 📋 Priority 5: Security Hardening

### Task 5.1: Enable Supabase Row Level Security
**Platform:** Supabase SQL Editor  
**Time:** 20 minutes  
**Impact:** Critical - Data security

**1. Verify RLS is enabled on all tables:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**2. If any tables show `rowsecurity = false`, enable:**
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**3. Verify RLS policies exist:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**4. Critical tables that MUST have RLS:**
- `orders` ✅
- `talent_profiles` ✅
- `vendor_bank_info` ✅
- `notifications` ✅
- `help_messages` ✅
- `reviews` ✅
- `users` ✅

**5. Test RLS policies:**
```sql
-- Test as anonymous user
SET ROLE anon;
SELECT * FROM orders; -- Should return 0 rows
RESET ROLE;

-- Test as authenticated user
SET ROLE authenticated;
SELECT * FROM orders WHERE user_id = '[test-user-id]'; -- Should return only user's orders
RESET ROLE;
```

---

### Task 5.2: Rotate All API Keys
**Platform:** Various  
**Time:** 45 minutes  
**Impact:** High - Security best practice

**Schedule:** Rotate every 90 days

**1. Supabase (if key is ever compromised):**
- Dashboard → Settings → API
- Generate new `anon` key
- Update in Vercel environment variables
- Deploy
- Delete old key

**2. Wasabi:**
- Wasabi Console → Access Keys
- Create new access key
- Update `REACT_APP_WASABI_ACCESS_KEY_ID` and `SECRET` in Vercel
- Deploy
- Delete old key (after 24 hour grace period)

**3. Mailgun:**
- Mailgun → Settings → API Keys
- Create new API key
- Update `REACT_APP_MAILGUN_API_KEY` in Vercel
- Deploy
- Revoke old key

**4. Cloudinary:**
- Cloudinary → Settings → Security
- Regenerate API Secret
- Update in Supabase Edge Function secrets
- Deploy functions
- Old secret invalidated automatically

**5. LunarPay:**
- Contact LunarPay support to rotate API key
- Update `REACT_APP_LUNARPAY_API_KEY` in Vercel
- Test payment flow thoroughly

**Document rotation in:** Password manager or secrets vault

---

### Task 5.3: Configure Firewall Rules
**Platform:** Supabase Dashboard  
**Time:** 15 minutes  
**Impact:** Medium - Reduce attack surface

1. Supabase Dashboard → Settings → Database → Network Restrictions
2. Enable "Restrict connections to specific IP addresses"
3. Add allowed IPs:

```
# Vercel IP ranges (get from: vercel.com/docs/concepts/deployments/edge-network)
76.76.21.0/24
76.223.0.0/20
# Add all Vercel edge network IPs

# Your office IP (for admin access)
[YOUR_OFFICE_IP]/32

# CI/CD IP (if using GitHub Actions)
[GITHUB_ACTIONS_IP_RANGE]
```

**Note:** This might be complex with Vercel's dynamic IPs. Alternative: Keep open but rely on strong RLS policies.

---

### Task 5.4: Enable 2FA on All Accounts
**Platform:** Various  
**Time:** 30 minutes  
**Impact:** Critical - Account security

**Enable 2FA on:**
- [ ] **Supabase account** (Settings → Account Security)
- [ ] **Vercel account** (Settings → Security → Two-Factor Authentication)
- [ ] **Railway account** (Profile → Security)
- [ ] **Wasabi account** (Account → Security)
- [ ] **Mailgun account** (Account → Security Settings)
- [ ] **Domain registrar** (e.g., Namecheap, GoDaddy)
- [ ] **CloudFlare account** (My Profile → Authentication)
- [ ] **GitHub organization** (Settings → Security → 2FA required)
- [ ] **Cloudinary account** (Settings → Security)

**Use:** Authy, Google Authenticator, or 1Password

**Backup codes:** Save in encrypted password manager

---

## 📋 Priority 6: Monitoring & Alerts

### Task 6.1: Set up UptimeRobot
**Platform:** UptimeRobot (Free)  
**Time:** 15 minutes  
**Impact:** High - Immediate downtime alerts

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Click "Add New Monitor"

**Monitor 1: Homepage**
- Monitor Type: HTTP(s)
- Friendly Name: ShoutOut Homepage
- URL: `https://shoutout.us`
- Monitoring Interval: 5 minutes
- Monitor Timeout: 30 seconds
- Alert When Down For: 2 minutes

**Monitor 2: API Health**
- Monitor Type: HTTP(s)
- Friendly Name: Supabase API
- URL: `https://utafetamgwukkbrlezev.supabase.co/rest/v1/`
- Monitoring Interval: 5 minutes
- Alert When Down For: 2 minutes

**Monitor 3: Video CDN**
- Monitor Type: HTTP(s)
- Friendly Name: Video CDN
- URL: `https://videos.shoutout.us` (or specific test video URL)
- Monitoring Interval: 10 minutes
- Alert When Down For: 5 minutes

3. Configure Alert Contacts:
- Email: `devops@shoutout.us`
- Email: `jb@shoutout.us`
- Optional: SMS, Slack webhook

**Cost:** Free (50 monitors)

---

### Task 6.2: Configure Supabase Alerts
**Platform:** Supabase Dashboard  
**Time:** 10 minutes  
**Impact:** High - Proactive issue detection

Supabase Dashboard → Project → Settings → Integrations → Email Alerts

**Enable alerts for:**
- [ ] **Database CPU usage > 80%**
  - Alert when: Sustained for 10 minutes
  - Action: Check for slow queries, add indexes

- [ ] **Database disk usage > 80%**
  - Alert when: Immediate
  - Action: Upgrade plan or clean old data

- [ ] **Edge Function errors > 100/hour**
  - Alert when: Sustained for 1 hour
  - Action: Check function logs, debug errors

- [ ] **Auth rate limit exceeded**
  - Alert when: Immediate
  - Action: Check for bot attacks

- [ ] **Realtime connections > 500**
  - Alert when: Immediate
  - Action: Optimize real-time subscriptions

**Alert recipients:**
- `devops@shoutout.us`
- `jb@shoutout.us`

---

### Task 6.3: Set up Sentry Account
**Platform:** Sentry.io  
**Time:** 20 minutes  
**Impact:** High - Error tracking

1. Sign up at [sentry.io](https://sentry.io)
2. Create new organization: "ShoutOut"
3. Create new project:
   - Platform: React
   - Project Name: ShoutOut Frontend

4. Copy DSN key (looks like: `https://abc123@o123.ingest.sentry.io/456`)
5. Add to Vercel environment variables:
   ```
   REACT_APP_SENTRY_DSN=https://abc123@o123.ingest.sentry.io/456
   ```

6. Configure alert rules (Sentry → Alerts):
   - **New Issue Alert:** Email immediately
   - **High Volume Alert:** > 100 errors/hour → Email + Slack
   - **Critical Error Alert:** Error level = fatal → Email immediately

7. Configure performance monitoring:
   - Enable Transactions
   - Sample Rate: 10% (adjust based on traffic)

8. Integrate with Slack (optional):
   - Sentry → Settings → Integrations → Slack
   - Connect workspace
   - Select channel: `#engineering-alerts`

**Cost:** $26/mo (Team plan - up to 50k events)

---

## 📋 Priority 7: Backup & Disaster Recovery

### Task 7.1: Database Backup Strategy
**Platform:** Supabase + Wasabi  
**Time:** 1 hour (setup) + 30 min/week (ongoing)  
**Impact:** Critical - Business continuity

**Automated Backups (Supabase PITR):**
- Enabled in Task 1.4
- 7-day retention
- Point-in-Time Recovery

**Manual Weekly Backups:**

**1. Create Wasabi backup bucket:**
- Wasabi Console → Create Bucket
- Name: `shoutout-backups`
- Region: Same as main bucket (us-central-1)
- Enable versioning: ON

**2. Create backup script:**
```bash
#!/bin/bash
# save as: backup-database.sh

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/shoutout-backups"
DB_HOST="db.utafetamgwukkbrlezev.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="[from Supabase Settings → Database]"
S3_BUCKET="s3://shoutout-backups/database/"
WASABI_ENDPOINT="https://s3.us-central-1.wasabisys.com"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
echo "Starting backup: backup_${DATE}.dump"
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -F c \
  -b \
  -v \
  -f "$BACKUP_DIR/backup_${DATE}.dump"

# Compress
gzip "$BACKUP_DIR/backup_${DATE}.dump"

# Upload to Wasabi
echo "Uploading to Wasabi..."
aws s3 cp "$BACKUP_DIR/backup_${DATE}.dump.gz" $S3_BUCKET \
  --endpoint-url=$WASABI_ENDPOINT

# Cleanup local file
rm "$BACKUP_DIR/backup_${DATE}.dump.gz"

# Delete backups older than 30 days
aws s3 ls $S3_BUCKET --endpoint-url=$WASABI_ENDPOINT | \
  grep "backup_" | \
  awk '{print $4}' | \
  while read filename; do
    file_date=$(echo $filename | grep -oE '[0-9]{8}')
    if [ $(( $(date +%s) - $(date -d "$file_date" +%s) )) -gt 2592000 ]; then
      echo "Deleting old backup: $filename"
      aws s3 rm "$S3_BUCKET$filename" --endpoint-url=$WASABI_ENDPOINT
    fi
  done

echo "Backup complete!"
```

**3. Schedule with cron (on a secure server):**
```bash
# Edit crontab
crontab -e

# Add line (runs every Sunday at 2 AM):
0 2 * * 0 /path/to/backup-database.sh >> /var/log/shoutout-backup.log 2>&1
```

**4. Test restore procedure (quarterly):**
```bash
# Download backup
aws s3 cp s3://shoutout-backups/database/backup_20241201_020000.dump.gz . \
  --endpoint-url=https://s3.us-central-1.wasabisys.com

# Decompress
gunzip backup_20241201_020000.dump.gz

# Restore to test database
PGPASSWORD=$TEST_DB_PASSWORD pg_restore \
  -h $TEST_DB_HOST \
  -U postgres \
  -d test_database \
  -v \
  backup_20241201_020000.dump

# Verify data integrity
psql -h $TEST_DB_HOST -U postgres -d test_database -c "SELECT COUNT(*) FROM orders;"
psql -h $TEST_DB_HOST -U postgres -d test_database -c "SELECT COUNT(*) FROM talent_profiles;"
```

---

### Task 7.2: Video Storage Backup & Lifecycle
**Platform:** Wasabi Console  
**Time:** 30 minutes  
**Impact:** High - Cost optimization & data protection

**1. Enable Versioning:**
- Wasabi Console → Buckets → `shoutoutorders` → Properties
- Enable Versioning: ON
- Retain: 3 versions (latest + 2 previous)

**2. Configure Lifecycle Policy:**
- Wasabi Console → Buckets → `shoutoutorders` → Lifecycle
- Add rule: "Archive Old Videos"
  - Rule Name: archive-old-videos
  - Apply to: Prefix `videos/`
  - Transition to Immutable Storage: After 90 days
  - Delete incomplete multipart uploads: After 7 days

**3. Configure Replication (Optional, for disaster recovery):**
- Create second bucket in different region: `shoutoutorders-backup`
- Enable cross-region replication
- **Cost:** Double storage cost (~$12/mo total)

**4. Set up monitoring:**
- Wasabi Console → Metrics
- Set alert: Storage > 500 GB → Email to `devops@shoutout.us`

**5. Cleanup script for failed uploads:**
```bash
#!/bin/bash
# cleanup-wasabi.sh - Run monthly

BUCKET="shoutoutorders"
ENDPOINT="https://s3.us-central-1.wasabisys.com"

# Delete incomplete multipart uploads > 7 days old
aws s3api list-multipart-uploads \
  --bucket $BUCKET \
  --endpoint-url $ENDPOINT | \
  jq -r '.Uploads[] | select(.Initiated < "'$(date -d '7 days ago' -I)'") | "\(.Key) \(.UploadId)"' | \
  while read key uploadid; do
    echo "Aborting: $key ($uploadid)"
    aws s3api abort-multipart-upload \
      --bucket $BUCKET \
      --key "$key" \
      --upload-id "$uploadid" \
      --endpoint-url $ENDPOINT
  done
```

---

### Task 7.3: Disaster Recovery Plan Document
**Platform:** Internal Documentation  
**Time:** 2 hours  
**Impact:** Critical - Business continuity

**Create document: `DISASTER_RECOVERY_PLAN.md`**

Include:

**1. Recovery Objectives:**
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 24 hours

**2. Critical Systems Inventory:**
- Database (Supabase)
- Frontend (Vercel)
- Video Storage (Wasabi)
- Email (Mailgun)
- CDN (CloudFlare)
- Payment Processing (Fortis/LunarPay)

**3. Incident Response Contacts:**
- On-call engineer: [phone/email]
- Database admin: [phone/email]
- CTO: jb@shoutout.us
- Supabase support: support@supabase.io
- Vercel support: support@vercel.com

**4. Recovery Procedures:**

**Database Failure:**
```
1. Check Supabase status page
2. If Supabase is down globally: Wait for resolution
3. If project-specific issue:
   - Restore from PITR (last known good time)
   - Or restore from weekly backup
4. Verify data integrity
5. Test critical flows (login, order, video upload)
6. Notify users via status page
```

**Frontend Failure:**
```
1. Check Vercel status page
2. Check deployment logs in Vercel dashboard
3. Rollback to previous deployment
4. If Vercel is down: Point DNS to Railway backup
5. Test all pages
6. Monitor error rates
```

**Video Storage Failure:**
```
1. Check Wasabi status
2. If regional outage: Videos won't load (temporary)
3. If data loss: Restore from versioned backup
4. Test video playback
5. Clear CloudFlare cache
```

**5. Environment Variable Backup:**
- Store encrypted in 1Password/LastPass
- Print encrypted backup, store in physical safe
- Update after any rotation

**6. Communication Plan:**
- Status page: status.shoutout.us (set up with Statuspage.io)
- Email template for users
- Social media post template
- Update frequency: Every 30 minutes during incident

**Test Plan (Quarterly):**
- [ ] Test database restore (2 hours)
- [ ] Test frontend rollback (30 min)
- [ ] Test video recovery (1 hour)
- [ ] Update documentation with learnings

---

## 📋 Priority 8: Performance Monitoring

### Task 8.1: Enable Vercel Analytics
**Platform:** Vercel Dashboard  
**Time:** 5 minutes  
**Impact:** Medium - Performance insights

1. Vercel Dashboard → Project → Analytics
2. Click "Enable Analytics"
3. Configure:
   - Enable: Core Web Vitals
   - Enable: Real User Monitoring
   - Budget: $20/mo (included in Pro)

**Monitor Metrics:**
- Largest Contentful Paint (LCP): Target < 2.5s
- First Input Delay (FID): Target < 100ms
- Cumulative Layout Shift (CLS): Target < 0.1
- Time to First Byte (TTFB): Target < 600ms

**Set up alerts:**
- LCP > 4s → Email alert
- Error rate > 1% → Email alert

---

### Task 8.2: Configure CloudFlare Analytics
**Platform:** CloudFlare Dashboard  
**Time:** 10 minutes  
**Impact:** Medium - CDN optimization

1. CloudFlare Dashboard → Analytics & Logs
2. Enable Web Analytics (if not already enabled)

**Monitor Daily:**
- **Bandwidth usage:** Track growth, predict costs
- **Cache hit ratio:** Target > 80%
  - If < 80%: Review cache rules, increase TTL
- **Threats blocked:** Monitor for attacks
- **Response time (p95):** Target < 500ms

**Create Dashboard Alert:**
- CloudFlare → Notifications → Add
- Alert: Cache hit ratio < 70% → Email to `devops@shoutout.us`

**Weekly Review:**
- Check top URLs by traffic
- Identify optimization opportunities
- Review security events

---

### Task 8.3: Set up User Analytics (Optional)
**Platform:** Google Analytics 4 or PostHog  
**Time:** 1 hour  
**Impact:** Low - Business insights (not critical for scale)

**Option A: Google Analytics 4 (Free)**
1. Create GA4 property at [analytics.google.com](https://analytics.google.com)
2. Get Measurement ID (e.g., G-XXXXXXXXXX)
3. Add to Vercel environment variables:
   ```
   REACT_APP_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
4. Developer implements tracking (code task, not DevOps)

**Option B: PostHog (Self-hosted or Cloud)**
1. Sign up at [posthog.com](https://posthog.com) or self-host
2. Get API key
3. Add to Vercel environment variables
4. Developer implements tracking

**Cost:** Free (GA4) or $0-450/mo (PostHog)

---

## 📋 Priority 9: Cost Optimization

### Task 9.1: Set up Budget Alerts
**Platform:** Various dashboards  
**Time:** 30 minutes  
**Impact:** Medium - Cost control

**Vercel:**
1. Dashboard → Usage → Spending Limit
2. Set alert at: $50/mo
3. Email to: `devops@shoutout.us`

**Supabase:**
1. Dashboard → Settings → Billing
2. Set usage alert at: $100/mo
3. Email notification enabled

**Wasabi:**
1. Console → Billing → Alerts
2. Set alert at: $20/mo
3. Email to: `devops@shoutout.us`

**Mailgun:**
1. Dashboard → Billing → Usage Notifications
2. Set alert at: $50/mo
3. Email to: `devops@shoutout.us`

**CloudFlare:**
- No overage risk (flat Pro plan at $20/mo)

**Monthly Cost Review Checklist:**
- [ ] Review all invoices first week of month
- [ ] Identify any unexpected charges
- [ ] Optimize if any service > 110% of budget
- [ ] Document cost trends in spreadsheet
- [ ] Forecast next month's costs

---

### Task 9.2: Optimize CloudFlare Caching
**Platform:** CloudFlare Dashboard  
**Time:** 20 minutes  
**Impact:** Medium - Reduce origin requests = lower costs

**1. Create Cache Rules:**

CloudFlare → Caching → Cache Rules

**Rule 1: Static Assets**
```
If: Request URL matches "shoutout.us/static/*"
Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 month
  - Browser TTL: 7 days
```

**Rule 2: Images**
```
If: Request URL matches "images.shoutout.us/*"
Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 month
  - Browser TTL: 1 day
```

**Rule 3: Videos**
```
If: Request URL matches "videos.shoutout.us/*"
Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 6 months
  - Browser TTL: 7 days
```

**Rule 4: API Responses (selective caching)**
```
If: Request URL matches "shoutout.us/api/talent/*"
Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 5 minutes
  - Browser TTL: 1 minute
```

**2. Enable Argo Smart Routing (Optional, +$5/mo):**
- CloudFlare → Traffic → Argo
- Enable for faster routing
- Cost: $0.10 per GB after first 1GB

**3. Monitor cache performance:**
- Target: > 80% cache hit rate
- Check weekly in CloudFlare Analytics
- If < 80%: Review rules, adjust TTL

---

### Task 9.3: Optimize Wasabi Storage Costs
**Platform:** Wasabi Console + AWS CLI  
**Time:** 1 hour (setup) + 1 hour/month (maintenance)  
**Impact:** Low - Saves ~$2-5/mo

**1. Create cleanup script:**
```bash
#!/bin/bash
# wasabi-cleanup.sh - Run monthly

BUCKET="shoutoutorders"
ENDPOINT="https://s3.us-central-1.wasabisys.com"

# 1. Delete incomplete multipart uploads > 7 days
echo "Cleaning up incomplete uploads..."
aws s3api list-multipart-uploads \
  --bucket $BUCKET \
  --endpoint-url $ENDPOINT | \
  jq -r '.Uploads[] | select(.Initiated < "'$(date -d '7 days ago' -I)'") | "\(.Key) \(.UploadId)"' | \
  while read key uploadid; do
    echo "Aborting: $key"
    aws s3api abort-multipart-upload \
      --bucket $BUCKET \
      --key "$key" \
      --upload-id "$uploadid" \
      --endpoint-url $ENDPOINT
  done

# 2. List files by size (identify large files)
echo "Top 20 largest files:"
aws s3 ls s3://$BUCKET --recursive --summarize --human-readable \
  --endpoint-url=$ENDPOINT | \
  sort -k 1 -h | \
  tail -20

# 3. Calculate total storage
aws s3 ls s3://$BUCKET --recursive --summarize \
  --endpoint-url=$ENDPOINT | \
  grep "Total Size"

echo "Cleanup complete!"
```

**2. Archive old promo videos (Optional, only if storage > 500GB):**
```bash
# Move videos > 2 years old to cheaper storage tier
# CAUTION: Ensure talent agreement allows archival
aws s3 ls s3://$BUCKET/videos/ --recursive \
  --endpoint-url=$ENDPOINT | \
  awk '$1 < "'$(date -d '2 years ago' '+%Y-%m-%d')'" {print $4}' | \
  while read file; do
    echo "Archiving: $file"
    # Move to immutable storage or delete
  done
```

**3. Monitor storage growth:**
```bash
# Get total bucket size monthly
aws s3 ls s3://$BUCKET --recursive --summarize \
  --endpoint-url=$ENDPOINT | \
  grep "Total Size" >> /var/log/wasabi-usage.log
```

**4. Set up Wasabi lifecycle policies** (see Task 7.2)

---

## 📋 Priority 10: Compliance & Legal

### Task 10.1: GDPR Compliance
**Platform:** Application + Database  
**Time:** 2-4 hours  
**Impact:** Critical - Legal requirement (EU users)

**1. Data Retention Policy:**
```sql
-- Create function to delete inactive users after 2 years
CREATE OR REPLACE FUNCTION delete_inactive_users()
RETURNS void AS $$
BEGIN
  DELETE FROM users
  WHERE last_sign_in_at < NOW() - INTERVAL '2 years'
    AND user_type = 'user' -- Don't auto-delete talent
    AND id NOT IN (SELECT DISTINCT user_id FROM orders); -- Keep users with orders
    
  RAISE NOTICE 'Deleted % inactive users', ROW_COUNT;
END;
$$ LANGUAGE plpgsql;

-- Test function
SELECT delete_inactive_users();

-- Schedule to run monthly (create cron job or Supabase scheduled function)
```

**2. Data Anonymization:**
```sql
-- Anonymize deleted user data
CREATE OR REPLACE FUNCTION anonymize_deleted_user(user_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE users SET
    email = 'deleted_' || gen_random_uuid() || '@deleted.local',
    full_name = 'Deleted User',
    avatar_url = NULL,
    phone = NULL
  WHERE id = user_uuid;
  
  -- Keep orders but anonymize personal data
  UPDATE orders SET
    recipient_name = 'Anonymous',
    recipient_email = 'deleted@deleted.local',
    message = '[Message deleted]'
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;
```

**3. Data Export Feature:**
- Developer task: Add "Export My Data" button in user profile
- Exports: User data, orders, reviews, messages to JSON
- Complies with GDPR "Right to Data Portability"

**4. Cookie Consent Banner:**
- Developer task: Implement cookie consent banner
- Use: [cookieconsent.orestbida.com](https://cookieconsent.orestbida.com) (free)
- Must appear before any cookies are set

**5. Document Data Processing Activities:**
Create `GDPR_DATA_PROCESSING.md`:
- What data is collected (email, name, payment info, IP address)
- How it's used (service delivery, analytics, marketing)
- Where it's stored (Supabase = AWS US East)
- Third-party processors (Mailgun, Cloudinary, Fortis, etc.)
- Data retention periods
- User rights (access, deletion, portability, rectification)

**6. Update Privacy Policy:**
- Add GDPR-specific sections
- Add data subject rights
- Add contact for data protection officer: privacy@shoutout.us
- Have lawyer review

---

### Task 10.2: PCI Compliance
**Platform:** Application Architecture  
**Time:** 1 hour (review)  
**Impact:** Critical - Payment security

**✅ Current Status: SAQ-A Eligible**
- No card data stored in database ✅
- Using Fortis/LunarPay for payment processing ✅
- Payment data never touches your servers ✅

**Action Items:**

**1. Complete SAQ-A Questionnaire:**
- Download from: [pcisecuritystandards.org](https://www.pcisecuritystandards.org/document_library/)
- Complete 22 questions (all should be "Yes" or "N/A")
- Document: No card data stored
- Sign and date attestation
- Store securely (expires annually)

**2. Verify Third-Party Compliance:**
- [ ] **Fortis/LunarPay:** Verify PCI Level 1 certification (request certificate)
- [ ] **Supabase:** SOC 2 Type II certified (check compliance page)
- [ ] **Mailgun:** SOC 2 Type II certified
- [ ] **Vercel:** SOC 2 Type II certified

**3. Document Payment Flow:**
```
User → Frontend (no card data) → LunarPay API → Fortis
                                              ↓
                                    Payment Success/Fail
                                              ↓
                                    Webhook to Supabase
                                              ↓
                                    Order Created (no card data)
```

**4. Annual Security Review:**
- Schedule: Every 12 months (set calendar reminder)
- Review: All payment flows
- Ensure: No card data ever enters your system
- Update SAQ-A questionnaire
- Verify third-party certifications still valid

**5. Security Scan:**
- Run PCI ASV scan (Approved Scanning Vendor)
- Recommended: Qualys or Trustwave
- Frequency: Quarterly
- Cost: ~$200/year

**Documentation:** Store SAQ-A attestation in secure location (password manager + physical safe)

---

### Task 10.3: Terms of Service & Privacy Policy Review
**Platform:** Website + Legal  
**Time:** 2-4 hours (with lawyer)  
**Impact:** High - Legal protection

**1. Hire Legal Counsel:**
- Find lawyer specializing in tech/SaaS/e-commerce
- Budget: $1,500-3,000 for comprehensive review
- Recommended: UpCounsel, Rocket Lawyer, or local tech attorney

**2. Review Current Documents:**
- Terms of Service (currently at `/terms`)
- Privacy Policy (currently at `/privacy`)

**3. Add/Update Sections:**

**Terms of Service Updates:**
- [ ] Arbitration clause (reduces lawsuit costs)
- [ ] Class action waiver
- [ ] Limitation of liability (cap at amount paid)
- [ ] User content ownership (promo videos - who owns what)
- [ ] Refund policy (100% money-back guarantee terms)
- [ ] Service-level agreement (SLA) - delivery times
- [ ] Termination rights (for both parties)
- [ ] Intellectual property (ShoutOut trademarks, talent content)
- [ ] Indemnification clause
- [ ] Force majeure (acts of God, etc.)

**Privacy Policy Updates:**
- [ ] GDPR compliance section (EU users)
- [ ] CCPA compliance section (California users)
- [ ] Data breach notification procedure
- [ ] Third-party service providers list:
  - Supabase (database, auth)
  - Wasabi (video storage)
  - Mailgun (email)
  - Fortis/LunarPay (payment)
  - Cloudinary (video processing)
  - CloudFlare (CDN)
  - Sentry (error tracking)
  - ActiveCampaign (marketing)
- [ ] Cookie policy (types of cookies used)
- [ ] Children's privacy (COPPA - likely N/A if 18+ only)
- [ ] Data retention periods
- [ ] User rights and how to exercise them
- [ ] Contact: privacy@shoutout.us

**4. Data Breach Response Plan:**
Create `DATA_BREACH_RESPONSE.md`:

```markdown
# Data Breach Response Plan

## Detection Procedures
- Monitor Sentry for unusual activity
- Check Supabase audit logs weekly
- Alert if > 1000 failed login attempts/hour
- Alert if unauthorized database access detected

## Containment Steps (Immediate - within 1 hour)
1. Isolate affected systems
2. Change all API keys and passwords
3. Enable Supabase firewall to block all traffic except office IP
4. Preserve logs and evidence
5. Contact Supabase support

## Assessment (within 4 hours)
1. Determine scope of breach
2. Identify affected users
3. Determine what data was accessed
4. Document timeline of breach

## Notification Requirements
- **GDPR:** Notify supervisory authority within 72 hours
- **CCPA:** Notify California AG if > 500 CA residents affected
- **Users:** Notify affected users within 72 hours (email)

## Communication Templates
**Email to Affected Users:**
```
Subject: Important Security Notice - ShoutOut

Dear [User],

We are writing to inform you of a security incident that may have 
affected your account. On [date], we discovered unauthorized access 
to [system]. 

What happened: [Brief description]
What information was involved: [Specific data types]
What we're doing: [Steps taken]
What you should do: [User actions - change password, etc.]

We sincerely apologize for this incident. Your security is our top 
priority, and we are taking additional measures to prevent this 
from happening again.

If you have questions: security@shoutout.us

Sincerely,
ShoutOut Security Team
```

## Post-Incident Review (within 2 weeks)
1. Root cause analysis
2. Document lessons learned
3. Implement preventive measures
4. Update security policies
5. Re-train team on security best practices
```

**5. User Notification of Policy Changes:**
- Email all existing users about updated Terms/Privacy
- Subject: "Updated Terms of Service and Privacy Policy"
- Give 30 days notice before enforcement
- Developer task: Require re-acceptance on next login

**6. Create Privacy@ Email Alias:**
- Set up: privacy@shoutout.us
- Forward to: Legal team or designated data protection officer
- Response time: Within 48 hours for data requests

---

## 📊 Summary Checklist

### Week 1-2: Critical Infrastructure ⚡
**Total Time:** ~5 hours

- [ ] Task 1.1: Add database indexes (30 min) ⚠️ CRITICAL
- [ ] Task 1.2: Enable connection pooling (10 min) ⚠️ CRITICAL
- [ ] Task 1.4: Set up database backups (15 min) ⚠️ CRITICAL
- [ ] Task 2.1: Set up Vercel account (30 min)
- [ ] Task 2.2: Configure environment variables (15 min)
- [ ] Task 2.3: Configure custom domain (20 min)
- [ ] Task 2.4: Set up preview deployments (5 min)
- [ ] Task 2.5: Cutover to Vercel (30 min)
- [ ] Task 3.1: Configure CloudFlare CDN (20 min)
- [ ] Task 5.1: Enable RLS on all tables (20 min) ⚠️ CRITICAL
- [ ] Task 5.2: Rotate all API keys (45 min)

---

### Week 3-4: Monitoring & Security 🔒
**Total Time:** ~5 hours

- [ ] Task 6.1: Set up UptimeRobot (15 min)
- [ ] Task 6.2: Configure Supabase alerts (10 min)
- [ ] Task 6.3: Set up Sentry (20 min)
- [ ] Task 5.4: Enable 2FA on all accounts (30 min) ⚠️ CRITICAL
- [ ] Task 5.3: Configure firewall rules (15 min)
- [ ] Task 7.1: Database backup strategy (1 hour)
- [ ] Task 7.2: Video storage lifecycle (30 min)
- [ ] Task 7.3: Create disaster recovery plan (2 hours)
- [ ] Task 4.1: Upgrade Mailgun plan (5 min)
- [ ] Task 4.2: Verify email authentication (10 min)
- [ ] Task 4.3: Set up email monitoring (10 min)

---

### Week 5-6: Optimization & Compliance 📈
**Total Time:** ~6 hours

- [ ] Task 8.1: Enable Vercel Analytics (5 min)
- [ ] Task 8.2: Configure CloudFlare Analytics (10 min)
- [ ] Task 8.3: Set up user analytics (1 hour, optional)
- [ ] Task 9.1: Set up budget alerts (30 min)
- [ ] Task 9.2: Optimize CloudFlare caching (20 min)
- [ ] Task 9.3: Optimize Wasabi storage (1 hour)
- [ ] Task 10.1: GDPR compliance (2-4 hours)
- [ ] Task 10.2: PCI compliance review (1 hour)
- [ ] Task 10.3: Legal review with attorney (2-4 hours)

---

### Ongoing Maintenance 🔄
**Weekly:**
- [ ] Monitor costs (15 min/week)
- [ ] Review error logs (10 min/day)
- [ ] Check uptime reports (5 min/week)
- [ ] Review CloudFlare analytics (10 min/week)

**Monthly:**
- [ ] Test database backups (30 min/month)
- [ ] Run Wasabi cleanup script (1 hour/month)
- [ ] Review security events (30 min/month)
- [ ] Cost optimization review (30 min/month)

**Quarterly:**
- [ ] Rotate credentials (45 min/quarter)
- [ ] Security audit (2 hours/quarter)
- [ ] Test disaster recovery (4 hours/quarter)
- [ ] Update documentation (1 hour/quarter)

---

## 💰 Infrastructure Cost Summary

### Monthly Recurring Costs
```
Supabase Pro:              $25/mo  (Database, Auth, Edge Functions)
Vercel Pro:                $20/mo  (Frontend hosting, CDN, Analytics)
Wasabi Storage (300GB):    $6/mo   (Video/Image storage)
CloudFlare Pro:            $20/mo  (CDN, Security, DDoS protection)
Mailgun Foundation:        $35/mo  (50k emails/month)
Cloudinary Pro:            $89/mo  (Video watermarking, transformations)
Sentry Team:               $26/mo  (Error tracking, 50k events)
UptimeRobot:               $0      (Free tier - 50 monitors)
Domain & SSL:              $2/mo   (Domain renewal)
─────────────────────────────────────────────────────────────────
TOTAL:                     $223/mo
```

### At Target Scale (100k users, 500 orders/mo)
```
Revenue (500 orders @ $50 avg):  $25,000/mo
Infrastructure costs:            -$223/mo
Infrastructure % of revenue:     0.89% ✅
```

### Growth Projections
```
At 1M users (10x):
- Supabase: $100/mo (Team tier)
- Vercel: $50/mo (increased bandwidth)
- Wasabi: $20/mo (1TB storage)
- Other services: Similar
──────────────────────────────
TOTAL: ~$500/mo (still < 2% of revenue)
```

**Scalability Headroom:** Infrastructure can handle 10x growth (1M users) with minimal cost increase.

---

## 🚨 Critical Incidents Contact

### Escalation Chain
1. **On-call Engineer:** [Your phone/email]
2. **Tech Lead:** [Phone/email]
3. **CTO:** jb@shoutout.us

### Service Support Contacts
- **Supabase Support:** support@supabase.io (24/7 for Pro+)
- **Vercel Support:** support@vercel.com (24/7 for Pro+)
- **CloudFlare Support:** [Dashboard ticket system]
- **Wasabi Support:** support@wasabi.com
- **Mailgun Support:** support@mailgun.com

### Status Pages to Monitor
- Supabase: https://status.supabase.com
- Vercel: https://vercel-status.com
- CloudFlare: https://cloudflarestatus.com
- Wasabi: https://status.wasabi.com
- Mailgun: https://status.mailgun.com

### Internal Status Communication
- Create status page: status.shoutout.us (use Statuspage.io, free tier)
- Update during incidents
- Link from main site footer

---

## 📝 Notes & Best Practices

### Testing Strategy
- Test all infrastructure changes in staging first
- Use Vercel preview deployments for testing
- Keep Railway as backup during migration
- Document all changes

### Security Mindset
- Assume breach will happen - prepare response
- Principle of least privilege (minimum access needed)
- Regular security audits
- Keep all software updated

### Cost Management
- Review bills first week of each month
- Set alerts before hitting limits
- Optimize aggressively if > 5% of revenue
- Consider reserved pricing for stable services

### Documentation
- Keep this document updated
- Review quarterly
- Share with all team members with infrastructure access
- Version control in Git

---

## 📅 Implementation Timeline

### Week 1: Foundation
**Goal:** Secure and optimize core infrastructure

**Monday-Tuesday:**
- [ ] Add database indexes
- [ ] Enable connection pooling
- [ ] Set up database backups
- [ ] Enable RLS verification

**Wednesday-Thursday:**
- [ ] Set up Vercel account
- [ ] Configure environment variables
- [ ] Test deployment on Vercel staging

**Friday:**
- [ ] Configure custom domain
- [ ] Test cutover plan
- [ ] Document any issues

---

### Week 2: Migration
**Goal:** Move to Vercel, enable CDN

**Monday-Tuesday:**
- [ ] Final pre-cutover testing
- [ ] Cutover to Vercel (during maintenance window)
- [ ] Monitor for issues
- [ ] Keep Railway as backup

**Wednesday-Thursday:**
- [ ] Configure CloudFlare CDN
- [ ] Enable CloudFlare security
- [ ] Test video/image delivery
- [ ] Verify cache hit rates

**Friday:**
- [ ] Upgrade Mailgun plan
- [ ] Verify email authentication
- [ ] Set up email monitoring

---

### Week 3: Monitoring
**Goal:** Full visibility into system health

**Monday-Tuesday:**
- [ ] Set up UptimeRobot
- [ ] Configure Supabase alerts
- [ ] Set up Sentry
- [ ] Test alert delivery

**Wednesday-Thursday:**
- [ ] Enable Vercel Analytics
- [ ] Configure CloudFlare Analytics
- [ ] Set up budget alerts
- [ ] Create monitoring dashboard

**Friday:**
- [ ] Enable 2FA on all accounts
- [ ] Rotate API keys
- [ ] Document credentials in password manager

---

### Week 4: Compliance & Optimization
**Goal:** Legal compliance, cost optimization

**Monday-Tuesday:**
- [ ] GDPR compliance implementation
- [ ] PCI compliance review
- [ ] Create data retention policies
- [ ] Data anonymization functions

**Wednesday-Thursday:**
- [ ] Optimize CloudFlare caching
- [ ] Set up Wasabi lifecycle policies
- [ ] Create cleanup scripts
- [ ] Test disaster recovery procedures

**Friday:**
- [ ] Schedule legal review
- [ ] Create disaster recovery plan
- [ ] Document all changes
- [ ] Final system health check

---

## ✅ Go-Live Checklist

**Before Scaling to 100k Users:**

### Infrastructure
- [ ] Database indexes added and verified
- [ ] Connection pooling enabled
- [ ] Backups automated and tested
- [ ] Migrated to Vercel successfully
- [ ] CloudFlare CDN configured and cache hit > 80%
- [ ] All monitoring and alerts active

### Security
- [ ] RLS enabled on all tables
- [ ] API keys rotated
- [ ] 2FA enabled on all accounts
- [ ] Security headers configured
- [ ] Firewall rules in place

### Compliance
- [ ] Terms of Service reviewed by lawyer
- [ ] Privacy Policy updated for GDPR/CCPA
- [ ] Data retention policies implemented
- [ ] PCI SAQ-A completed
- [ ] Cookie consent banner live

### Monitoring
- [ ] UptimeRobot monitoring all services
- [ ] Sentry capturing errors
- [ ] Analytics tracking performance
- [ ] Budget alerts configured
- [ ] Incident response plan documented

### Testing
- [ ] Load test with 1000 concurrent users
- [ ] Payment flow tested end-to-end
- [ ] Video upload tested at scale
- [ ] Email delivery tested
- [ ] Disaster recovery tested

---

## 🎯 Success Metrics

### Week 1-2 (Post-Migration)
- [ ] 99.9% uptime
- [ ] Page load time < 2s (p95)
- [ ] Database query time < 100ms (p95)
- [ ] Zero critical errors in Sentry
- [ ] CloudFlare cache hit ratio > 75%

### Month 1 (Post-Launch)
- [ ] 99.95% uptime
- [ ] Infrastructure costs < 2% of revenue
- [ ] All alerts firing correctly
- [ ] Zero data breaches
- [ ] All backups successful

### Month 3 (Ongoing)
- [ ] 99.99% uptime
- [ ] Infrastructure costs < 1% of revenue
- [ ] Average response time < 500ms
- [ ] Email delivery rate > 98%
- [ ] Customer satisfaction > 4.5/5

---

**Last Updated:** [Date]  
**Next Review:** [Date + 3 months]  
**Owner:** DevOps Team

