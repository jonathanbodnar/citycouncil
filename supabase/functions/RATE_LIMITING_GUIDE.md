# Rate Limiting Guide for Supabase Edge Functions

## Overview
Rate limiting has been implemented across all critical Edge Functions to prevent abuse, DoS attacks, and excessive API costs.

## ✅ Rate Limiting Implemented

### Protected Functions:
1. **send-email** - EMAIL preset (5 requests/hour)
2. **fortis-intention** - PAYMENT preset (5 requests/5 minutes)
3. **fortis-verify** - PAYMENT preset (5 requests/5 minutes)

### Rate Limit Presets:

| Preset | Max Requests | Time Window | Use Case |
|--------|--------------|-------------|----------|
| **STRICT** | 3 | 15 minutes | MFA, sensitive operations |
| **MODERATE** | 10 | 1 minute | General API endpoints |
| **LENIENT** | 30 | 1 minute | Public endpoints |
| **AUTHENTICATED** | 100 | 1 minute | Logged-in users |
| **EMAIL** | 5 | 1 hour | Email sending (spam prevention) |
| **SMS** | 3 | 15 minutes | SMS/MFA (expensive operations) |
| **PAYMENT** | 5 | 5 minutes | Payment operations (very strict) |

## How It Works

### 1. In-Memory Store
Rate limits are tracked in-memory per Edge Function instance:
- Automatically cleans up expired entries every 60 seconds
- Resets on cold starts (acceptable for Edge Functions)
- Low overhead (~1KB per tracked IP)

### 2. Identifier Extraction
Requests are identified by IP address (extracted from headers):
- CloudFlare: `cf-connecting-ip`
- Railway/Vercel: `x-forwarded-for`
- Generic: `x-real-ip`
- Fallback: `'unknown'`

### 3. Response Headers
Rate-limited responses include headers:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 2025-11-05T20:30:00.000Z
```

### 4. 429 Error Response
When limit exceeded:
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45,
  "resetTime": 1699214400000
}
```

## Usage Examples

### Basic Usage

```typescript
import { withRateLimit, RateLimitPresets } from '../_shared/rateLimiter.ts';

Deno.serve(withRateLimit(async (req) => {
  // Your handler code
  return new Response('Hello World');
}, RateLimitPresets.MODERATE));
```

### Custom Configuration

```typescript
Deno.serve(withRateLimit(async (req) => {
  // Your handler code
}, {
  maxRequests: 20,
  windowMs: 2 * 60 * 1000, // 2 minutes
}, {
  keyPrefix: 'custom-endpoint'
}));
```

### User-Based Rate Limiting

```typescript
import { withRateLimit, RateLimitPresets } from '../_shared/rateLimiter.ts';

Deno.serve(withRateLimit(async (req) => {
  // Your handler code
}, RateLimitPresets.AUTHENTICATED, {
  getIdentifier: (req) => {
    // Extract user ID from JWT or header
    const authHeader = req.headers.get('authorization');
    // Parse JWT and extract user_id
    return userId || 'anonymous';
  },
  keyPrefix: 'user-action'
}));
```

## Adding Rate Limiting to New Functions

### Step 1: Import the utility
```typescript
import { withRateLimit, RateLimitPresets } from '../_shared/rateLimiter.ts';
```

### Step 2: Wrap your handler
```typescript
Deno.serve(withRateLimit(async (req) => {
  // Existing handler code
}, RateLimitPresets.MODERATE));
```

### Step 3: Choose appropriate preset
- Public endpoints → `LENIENT` or `MODERATE`
- Authenticated actions → `AUTHENTICATED`
- Email/SMS → `EMAIL` or `SMS`
- Payments → `PAYMENT` or `STRICT`

## Testing Rate Limits

### Test with cURL

```bash
# Test email rate limiting (5 per hour)
for i in {1..6}; do
  curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/send-email \
    -H "Authorization: Bearer [ANON_KEY]" \
    -H "Content-Type: application/json" \
    -d '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}' \
    && echo "Request $i: Success" \
    || echo "Request $i: Failed"
  sleep 1
done

# Expected: First 5 succeed, 6th returns 429
```

### Test with Apache Bench

```bash
# Load test with 100 requests
ab -n 100 -c 10 \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -p payload.json \
  https://[PROJECT_ID].supabase.co/functions/v1/send-email

# Check how many returned 429
```

## Monitoring Rate Limits

### Check Logs in Supabase Dashboard

1. Go to **Edge Functions** → Select function
2. Check **Logs** tab
3. Filter for status `429`
4. Review blocked requests

### Common Patterns to Watch:

#### Legitimate Users Hitting Limits
**Symptom:** Normal users reporting errors  
**Solution:** Increase `maxRequests` or `windowMs`

#### DDoS Attack
**Symptom:** Many IPs hitting limit from different sources  
**Solution:** Rate limiting is working! Consider lowering limits further.

#### Bot/Scraper
**Symptom:** Same IP hitting limit repeatedly  
**Solution:** Consider IP blocking at CloudFlare/Railway level

## Performance Impact

### Memory Usage:
- ~1 KB per tracked IP
- 1000 IPs = ~1 MB
- Automatically cleans up every 60s

### Latency Overhead:
- ~0.1ms per request (negligible)
- No external API calls
- In-memory lookups only

### Cold Start Behavior:
- Rate limits reset on cold starts
- Acceptable for Edge Functions (infrequent)
- For persistent limits, consider Redis/Upstash

## Security Benefits

### 1. DoS Protection
Prevents attackers from exhausting resources:
- Database connections
- API quotas
- Server CPU/memory

### 2. Cost Control
Limits expensive operations:
- Email sending ($0.001/email × 1M = $1,000)
- SMS sending ($0.0075/SMS × 1M = $7,500)
- Payment processing fees

### 3. Spam Prevention
Blocks malicious automation:
- Email spam campaigns
- Fake order creation
- Account enumeration

### 4. API Quota Protection
Prevents exceeding third-party limits:
- Mailgun: 10,000 emails/month (free tier)
- Twilio: $15 trial credit
- Fortis: Payment processing limits

## Future Enhancements

### 1. Persistent Storage (Redis/Upstash)
For cross-instance rate limiting:
```typescript
// Use Redis instead of in-memory Map
const rateLimitStore = new Redis(REDIS_URL);
```

### 2. IP Allowlist/Blocklist
Skip limits for trusted IPs:
```typescript
const ALLOWLIST = ['1.2.3.4', '5.6.7.8'];
if (ALLOWLIST.includes(ip)) {
  // Skip rate limiting
}
```

### 3. Dynamic Rate Limits
Adjust based on user tier:
```typescript
const limits = {
  free: { maxRequests: 10, windowMs: 60000 },
  pro: { maxRequests: 100, windowMs: 60000 },
  enterprise: { maxRequests: 1000, windowMs: 60000 },
};
```

### 4. Rate Limit Dashboard
Track limits across all functions:
- Total requests blocked
- Top blocked IPs
- Functions hit most often

## Troubleshooting

### "Rate limit exceeded" for legitimate users

**Cause:** Limits too strict for normal usage  
**Solution:** Increase `maxRequests` or `windowMs`

```typescript
// Before: 10 requests/minute
RateLimitPresets.MODERATE

// After: 30 requests/minute
RateLimitPresets.LENIENT
```

### Rate limits reset unexpectedly

**Cause:** Cold start or function redeployment  
**Solution:** Expected behavior. For persistent limits, use Redis.

### Same IP making many requests

**Cause:** Users behind corporate NAT/proxy  
**Solution:** Use user-based rate limiting instead of IP:

```typescript
withRateLimit(handler, preset, {
  getIdentifier: (req) => {
    // Extract user ID from auth token
    return userId || getIP(req);
  }
})
```

### Rate limits not working

**Cause:** Function not redeployed after adding rate limiting  
**Solution:** Redeploy Edge Function:

```bash
cd supabase/functions
./deploy.sh send-email
```

## Cost Savings

### Without Rate Limiting:
- Bot sends 1M emails → **$1,000** in Mailgun costs
- Attacker creates 10K orders → **$3,000** in payment fees
- SMS spam attack → **$7,500** in Twilio costs

### With Rate Limiting:
- Email attacks capped at 5/hour/IP → Max **$0.12/hour**
- Payment spam blocked → **$0** fraudulent charges
- SMS abuse prevented → **$0** wasted credits

**Total Potential Savings:** $10,000+ per attack

## Deployment

### Deploy Updated Functions

```bash
cd supabase/functions

# Deploy all rate-limited functions
./deploy.sh send-email
./deploy.sh fortis-intention
./deploy.sh fortis-verify

# Or deploy all at once
for func in send-email fortis-intention fortis-verify; do
  ./deploy.sh $func
done
```

### Verify Deployment

```bash
# Test rate limiting works
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}' \
  -i | grep "X-RateLimit"

# Should see headers:
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 4
# X-RateLimit-Reset: ...
```

## Compliance & Legal

### GDPR Considerations
IP addresses are personal data under GDPR:
- ✅ Legitimate interest: Security & fraud prevention
- ✅ Temporary storage: Cleaned up automatically
- ✅ No external sharing: Stored in-memory only
- ✅ Privacy policy: Document rate limiting usage

### Rate Limit Disclosure
Update Terms of Service/API docs:
```
Our API endpoints are rate-limited to prevent abuse:
- Email: 5 requests per hour
- Payments: 5 requests per 5 minutes
- General API: 30 requests per minute
```

## Support

### Documentation:
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

### Implementation:
- File: `supabase/functions/_shared/rateLimiter.ts`
- Protected functions: `send-email`, `fortis-intention`, `fortis-verify`

---

**Implementation Date:** November 2025  
**Status:** ✅ Active on Production  
**Security Impact:** Prevents $10,000+ in potential abuse costs

