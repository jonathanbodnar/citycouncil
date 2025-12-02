# Quick Start: SANTA25 Email Campaign

## 🎯 Campaign Goal
Drive ShoutOut orders with a **25% OFF holiday promotion** using code **SANTA25**

## 📧 What You're Sending
A promotional email featuring:
- 🎄 Holiday-themed 25% OFF banner
- 🎬 4 real ShoutOut examples (Shawn, Hayley, Nick, Dave)
- ⭐ 6 top personalities customers can order from
- 🎁 Clear call-to-action buttons

---

## ⚡ 5-Minute Setup

### 1. Upload to Mailchimp
```
1. Create new email campaign
2. Choose "Code your own" → "Paste in code"
3. Copy/paste: mailchimp-promo-template.html
4. Save
```

### 2. Replace Placeholder Images
**Current URLs in template:**
```
https://shoutout.us/talent-images/shawn-farash.jpg
https://shoutout.us/talent-images/hayley-caronia.jpg
https://shoutout.us/talent-images/nick-dipaolo.jpg
https://shoutout.us/talent-images/dave-landau.jpg
https://shoutout.us/talent-images/josh-firestine.jpg
https://shoutout.us/talent-images/larry-elder.jpg
```

**Action Required:**
1. Get actual talent photos from your site
2. Upload to Mailchimp Content Studio
3. Replace URLs with Mailchimp CDN links

**OR** use the actual image URLs from your Wasabi/CDN storage if available.

### 3. Subject Line Ideas
```
✅ 🎄 Get 25% OFF ShoutOuts This Holiday Season!
✅ 🎅 SANTA25: Personalized Videos from Your Favorites
✅ 🎁 Holiday Special: 25% OFF All ShoutOuts
```

### 4. Preview Text
```
Use code SANTA25 for 25% off personalized videos from top conservative voices & comedians 🎄
```

### 5. Send Test & Review
- Send to yourself first
- Check mobile view
- Click all links
- Verify images load

### 6. Send or Schedule
- **Best time**: Tuesday-Thursday, 10 AM - 2 PM EST
- **A/B test**: Try 2 different subject lines

---

## 📊 What to Track

### In Mailchimp
- Open rate (target: 20-25%)
- Click rate (target: 3-5%)
- Unsubscribes

### On Your Site
- Traffic from email (check UTM: `utm_campaign=santa25`)
- SANTA25 code usage
- Conversion rate
- Revenue generated

---

## 🎨 Template Features

### Matches Your Site Design
- ✅ Dark gradient background
- ✅ Glass morphism cards
- ✅ Red-to-purple gradient banners
- ✅ Same colors and style as shoutout.us

### Mobile Optimized
- ✅ Responsive layout
- ✅ Touch-friendly buttons
- ✅ Readable text sizes
- ✅ Optimized images

### Smart Details
- ✅ UTM tracking on all links
- ✅ Talent photos link to profiles
- ✅ Fallback images if loading fails
- ✅ CAN-SPAM & GDPR compliant

---

## 🔧 Quick Edits

### Change the Discount
Find/replace in template:
- `25% OFF` → Your new percentage
- `SANTA25` → Your new code

### Add More Talent
Copy this block and customize:
```html
<div class="talent-item">
    <a href="https://shoutout.us/USERNAME?utm_source=email&utm_medium=promo&utm_campaign=santa25">
        <img src="IMAGE_URL" alt="NAME" class="talent-avatar">
        <div class="talent-name">NAME</div>
        <div class="talent-category-badge">CATEGORY</div>
    </a>
</div>
```

### Update Example Shoutout
Edit the text inside `<div class="shoutout-text">` while keeping HTML intact.

---

## ✅ Pre-Flight Checklist

Before sending:
- [ ] Subject line is compelling
- [ ] Preview text is set
- [ ] All talent images load correctly
- [ ] All links work (especially to talent profiles)
- [ ] SANTA25 code is active on your site
- [ ] Test email sent and reviewed on desktop & mobile
- [ ] Unsubscribe link works
- [ ] Audience selected correctly
- [ ] Scheduled for optimal send time

---

## 🚀 Expected Results

### Good Email Performance
- **20-25% open rate** (email clients showing interest)
- **3-5% click rate** (people clicking through to site)
- **1-2% conversion rate** (email recipients placing orders)

### Revenue Impact
If sending to 10,000 subscribers:
- 2,000-2,500 opens
- 300-500 clicks to site  
- 100-200 orders (estimated)

*Adjust expectations based on your list size and engagement*

---

## 💡 Pro Tips

1. **Segment Your List**: Send to most engaged subscribers first
2. **A/B Test**: Try different subject lines on 10% of list
3. **Timing**: Don't send on Mondays (inbox overwhelm) or Fridays (weekend mode)
4. **Follow-Up**: Send reminder email 3-4 days before promo ends
5. **Create Urgency**: Add expiration date to increase conversions

---

## 📞 Need Help?

### Common Issues

**Images not showing?**
- Upload images to Mailchimp Content Studio
- Update URLs in template
- Check image file sizes (keep under 1MB)

**Template looks broken?**
- Send test email (preview can be misleading)
- Check in Gmail, Apple Mail, Outlook
- Some CSS is stripped by email clients (normal)

**Links not working?**
- Verify URLs have `https://`
- Check for typos
- Test each link individually

**Code not applying discount?**
- Verify SANTA25 is active in your system
- Check date range
- Test on actual checkout

---

## 📁 Files Included

1. **mailchimp-promo-template.html** - The email template
2. **MAILCHIMP_EMAIL_SETUP.md** - Detailed setup guide
3. **MAILCHIMP_QUICK_START.md** - This quick reference (you are here)

---

Ready to send? Good luck with your campaign! 🚀🎄


