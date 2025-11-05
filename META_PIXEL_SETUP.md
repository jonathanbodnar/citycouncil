# Meta (Facebook) Pixel Tracking Setup

## Overview
Meta Pixel is now installed and tracking landing page email submissions as "Lead" events.

---

## Pixel Details

**Dataset/Pixel ID:** `3119170601701547`

**Events Tracked:**
1. **PageView** - Automatically tracks all page visits
2. **Lead** - Tracks landing page email form submissions

---

## Installation

### 1. Base Pixel Code (`public/index.html`)
```javascript
<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '3119170601701547');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=3119170601701547&ev=PageView&noscript=1"/>
</noscript>
<!-- End Meta Pixel Code -->
```

### 2. Lead Event Tracking (`ComingSoonPage.tsx`)
```typescript
// Track Meta Pixel Lead event
if (typeof window !== 'undefined' && (window as any).fbq) {
  console.log('📊 Tracking Meta Pixel Lead event');
  (window as any).fbq('track', 'Lead', {
    content_name: 'Beta Waitlist Signup',
    content_category: 'Landing Page',
    value: 0.00,
    currency: 'USD'
  });
}
```

---

## Event Trigger Flow

### Landing Page Email Submission:
1. User enters email in form
2. Clicks "Claim Beta Spot"
3. Email saved to `email_waitlist` table ✅
4. Email added to ActiveCampaign ✅
5. Spots counter decrements ✅
6. **Meta Pixel 'Lead' event fires** 🎯
7. Success message shown to user
8. Form resets

### Event Parameters:
- **Event Name:** `Lead`
- **content_name:** `Beta Waitlist Signup`
- **content_category:** `Landing Page`
- **value:** `0.00` (free signup)
- **currency:** `USD`

---

## Verify Tracking

### Method 1: Browser Console
1. Open landing page (https://shoutout.us)
2. Open DevTools (F12) → Console
3. Submit email form
4. Look for: `📊 Tracking Meta Pixel Lead event`

### Method 2: Meta Pixel Helper (Chrome Extension)
1. Install "Meta Pixel Helper" extension
2. Visit https://shoutout.us
3. Click extension icon
4. Should show:
   - ✅ Pixel loaded: `3119170601701547`
   - ✅ PageView event fired
5. Submit email form
6. Should show:
   - ✅ Lead event fired with parameters

### Method 3: Meta Events Manager
1. Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Select Dataset ID: `3119170601701547`
3. Click "Test Events" tab
4. Enter your website URL
5. Submit email form
6. Should see Lead event appear in real-time

### Method 4: Facebook Ads Manager
1. Go to [Meta Ads Manager](https://www.facebook.com/adsmanager)
2. Navigate to Events Manager
3. Select your pixel: `3119170601701547`
4. View "Overview" dashboard
5. Check for:
   - PageView events (should be consistent)
   - Lead events (email submissions)

---

## Debugging

### Issue: No events showing up

**Check 1: Pixel Loaded?**
```javascript
// Run in browser console
console.log(typeof fbq);
// Should output: "function"
```

**Check 2: Pixel Initialized?**
```javascript
// Run in browser console
console.log(window._fbq);
// Should output: object with loaded: true
```

**Check 3: Events Firing?**
```javascript
// Submit email form and watch console
// Should see: "📊 Tracking Meta Pixel Lead event"
```

### Issue: Events showing in Test Events but not Overview

**Reason:** There's a delay (up to 20 minutes) before events appear in the main dashboard.

**Solution:** Wait 20-30 minutes and refresh.

### Issue: Pixel Helper shows error

**Common Errors:**
- "No pixel found" → Check if pixel code is in `<head>` tag
- "Invalid Pixel ID" → Verify ID is `3119170601701547`
- "PageView not fired" → Check for JavaScript errors blocking execution

---

## Use Cases

### 1. **Track Beta Signups**
- Monitor how many leads are generated daily
- See conversion rate from visitors to signups
- Identify peak signup times

### 2. **Build Audiences**
- Create Custom Audience: "People who submitted email form"
- Create Lookalike Audience: Based on your leads
- Retarget visitors who didn't sign up

### 3. **Optimize Ads**
- Set "Lead" as conversion goal in ad campaigns
- Let Meta optimize for people likely to sign up
- Track cost per lead (CPL)

### 4. **A/B Testing**
- Test different landing page variations
- Compare lead generation rates
- Optimize copy, design, and CTA placement

---

## Custom Audiences Setup

### Audience 1: Email Submitters
1. Go to Audiences in Ads Manager
2. Create Custom Audience → Website
3. Include: `Lead` event
4. Time: Last 30 days
5. Name: "Landing Page Email Signups"

### Audience 2: Visitors Who Didn't Submit
1. Create Custom Audience → Website
2. Include: `PageView` on landing page
3. Exclude: `Lead` event
4. Time: Last 7 days
5. Name: "Landing Page Visitors - No Email"

### Audience 3: Lookalike - Beta Leads
1. Create Lookalike Audience
2. Source: "Landing Page Email Signups"
3. Location: United States
4. Size: 1% (most similar)
5. Name: "Lookalike - Beta Leads (1%)"

---

## Campaign Optimization

### Step 1: Set Up Lead Generation Campaign
1. Campaign Objective: "Leads"
2. Conversion Location: "Website"
3. Conversion Event: "Lead" (Dataset: 3119170601701547)
4. Budget: $50/day (recommended starting point)

### Step 2: Target Audiences
- **Cold Traffic:** Lookalike Audience (1%)
- **Warm Traffic:** Engaged visitors (didn't submit)
- **Retargeting:** PageView visitors (last 7 days)

### Step 3: Optimize
- Let pixel collect 50+ Lead events
- Meta will optimize delivery for people likely to convert
- Monitor CPL (Cost Per Lead)
- Scale winners, pause losers

---

## Event Parameters Guide

### Current Parameters:
```javascript
{
  content_name: 'Beta Waitlist Signup',
  content_category: 'Landing Page',
  value: 0.00,
  currency: 'USD'
}
```

### Optional Parameters You Could Add:
```javascript
{
  content_name: 'Beta Waitlist Signup',
  content_category: 'Landing Page',
  content_type: 'product', // or 'service'
  predicted_ltv: 25.00, // If you offer 25% off first order
  value: 0.00,
  currency: 'USD',
  status: 'beta_lead' // Custom parameter
}
```

---

## Advanced Tracking (Future)

### Additional Events to Track:

#### 1. **InitiateCheckout** (Order Page Visit)
```typescript
fbq('track', 'InitiateCheckout', {
  content_name: talentName,
  content_category: 'ShoutOut Order',
  value: orderAmount,
  currency: 'USD'
});
```

#### 2. **Purchase** (Order Completed)
```typescript
fbq('track', 'Purchase', {
  content_name: talentName,
  content_category: 'ShoutOut Order',
  value: orderAmount,
  currency: 'USD',
  content_ids: [orderId],
  content_type: 'product'
});
```

#### 3. **CompleteRegistration** (Account Created)
```typescript
fbq('track', 'CompleteRegistration', {
  content_name: 'User Signup',
  status: 'new_user'
});
```

#### 4. **ViewContent** (Talent Profile View)
```typescript
fbq('track', 'ViewContent', {
  content_name: talentName,
  content_category: 'Talent Profile',
  content_ids: [talentId],
  content_type: 'product'
});
```

---

## Privacy & Compliance

### GDPR/CCPA Considerations:
- Meta Pixel only tracks anonymous visitor behavior
- No personal data (email, name, phone) is sent to Meta by default
- Consider adding cookie consent banner if targeting EU
- Privacy Policy should mention use of Meta Pixel

### Advanced Matching (Optional):
You can send hashed email for better matching:
```javascript
fbq('init', '3119170601701547', {
  em: 'hashed_email@example.com' // SHA-256 hash
});
```

**Note:** Not currently implemented. Would require server-side hashing.

---

## Troubleshooting Checklist

- [ ] Pixel code is in `<head>` section of `public/index.html`
- [ ] Pixel ID is correct: `3119170601701547`
- [ ] No JavaScript errors in browser console
- [ ] `fbq` function is defined globally
- [ ] PageView event fires on page load
- [ ] Lead event fires after email submission
- [ ] Console shows: "📊 Tracking Meta Pixel Lead event"
- [ ] Meta Pixel Helper extension shows events
- [ ] Test Events in Meta Events Manager shows activity
- [ ] Wait 20-30 minutes for events to appear in Overview

---

## Summary

✅ **Installed:** Meta Pixel base code  
✅ **Tracking:** PageView (all pages) + Lead (email signups)  
✅ **Pixel ID:** 3119170601701547  
✅ **Event Parameters:** Content name, category, value, currency  
✅ **Debugging:** Console logs for verification  
✅ **Use Cases:** Audience building, retargeting, campaign optimization  

**Next Steps:**
1. Verify tracking with Meta Pixel Helper
2. Wait for 50+ Lead events to accumulate
3. Create Custom Audiences
4. Set up Lead Generation campaigns
5. Optimize based on CPL and conversion data

---

**Need Help?**
- [Meta Pixel Documentation](https://developers.facebook.com/docs/meta-pixel)
- [Events Manager Guide](https://www.facebook.com/business/help/898185560232180)
- [Custom Audiences Help](https://www.facebook.com/business/help/744354708981227)

