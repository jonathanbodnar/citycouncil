# Mailchimp Email Template - SANTA25 Promo

## Overview
This email template promotes the **SANTA25** discount code (25% OFF) to customers, encouraging them to order personalized ShoutOuts from conservative personalities, comedians, and influencers.

## Template File
`mailchimp-promo-template.html`

## What's Included

### 1. **Promo Banner**
- Highlights the SANTA25 code for 25% OFF
- Holiday-themed messaging
- Gradient background matching the site design

### 2. **Example ShoutOuts**
Four real examples showcasing what customers receive:
- **Shawn Farash** - Political Commentator (Birthday message)
- **Hayley Caronia** - Journalist (Congratulations message)
- **Nick Di Paolo** - Comedian (Anniversary message)
- **Dave Landau** - Comedian (Encouragement message)

### 3. **Featured Talent Grid**
Top 6 personalities getting the most orders:
- Shawn Farash
- Hayley Caronia
- Nick Di Paolo
- Dave Landau
- Josh Firestine
- Larry Elder

Each talent photo links directly to their profile page with UTM tracking.

### 4. **Call-to-Action Buttons**
- Primary CTA: "Browse Talent & Order Now"
- Secondary CTA: "See All Talent"
- All links include UTM parameters for tracking

## How to Upload to Mailchimp

### Step 1: Create New Campaign
1. Log into Mailchimp
2. Click **Create** → **Email**
3. Choose **Regular** campaign
4. Name it: "SANTA25 Holiday Promo"

### Step 2: Import Template
1. In the **Design Email** step, click **Code your own**
2. Choose **Paste in code**
3. Copy the entire contents of `mailchimp-promo-template.html`
4. Paste into the code editor
5. Click **Save**

### Step 3: Replace Image URLs (Important!)
The template currently uses placeholder image paths. You need to:

1. **Upload talent photos to Mailchimp's Content Studio:**
   - Go to **Content Studio** in Mailchimp
   - Create a folder called "talent-images"
   - Upload photos for:
     - shawn-farash.jpg
     - hayley-caronia.jpg
     - nick-dipaolo.jpg
     - dave-landau.jpg
     - josh-firestine.jpg
     - larry-elder.jpg

2. **Replace image URLs in the template:**
   Find all instances of:
   ```html
   src="https://shoutout.us/talent-images/[name].jpg"
   ```
   
   Replace with your Mailchimp CDN URLs:
   ```html
   src="https://mcusercontent.com/YOUR-ID/images/[name].jpg"
   ```

### Step 4: Customize Subject Line
Suggested subject lines:
- 🎄 Get 25% OFF ShoutOuts This Holiday Season!
- 🎅 SANTA25: Give the Gift of a Personalized ShoutOut
- 🎁 Holiday Special: 25% OFF All ShoutOuts
- Your Favorite Personalities Want to Say Hi - 25% OFF!

### Step 5: Preview Text
Add engaging preview text (appears after subject line):
```
Use code SANTA25 for 25% off personalized videos from top conservative voices & comedians 🎄
```

### Step 6: Test the Email
1. Send test emails to yourself
2. Check on both desktop and mobile
3. Verify all links work correctly
4. Test the coupon code on the actual site
5. Ensure images load properly

### Step 7: Set Up Audience
Choose your target audience:
- All subscribers
- Or segment by: Previous customers, Active subscribers, etc.

### Step 8: Schedule or Send
- **Send immediately** for urgent promotions
- **Schedule** for optimal send time (Mailchimp suggests Tuesdays at 10 AM)

## UTM Tracking
All links include UTM parameters for Google Analytics tracking:
```
?utm_source=email&utm_medium=promo&utm_campaign=santa25
```

Track performance in Google Analytics under:
`Acquisition → Campaigns → All Campaigns → santa25`

## Design Features

### Color Scheme (Matches ShoutOut Site)
- **Primary Gradient**: Red (#a70809) to Purple (#3c108b)
- **Background**: Dark theme with gradient (#111827 to #1f1b2e)
- **Glass Morphism**: Frosted glass effect on cards
- **Accents**: Yellow (#fde047) for promo code

### Mobile Responsive
- Stacks vertically on mobile
- Optimized font sizes for small screens
- Touch-friendly buttons
- 2-column talent grid on mobile (vs 3-column on desktop)

### Email Client Compatibility
Tested and optimized for:
- Gmail (Desktop & Mobile)
- Apple Mail (iOS & macOS)
- Outlook (Windows & Mac)
- Yahoo Mail
- Mobile devices (iOS & Android)

## Customization Tips

### To Change the Discount
1. Find all instances of "25% OFF"
2. Update to your new discount percentage
3. Update the code from "SANTA25" to your new code

### To Add More Talent
Copy one of the existing talent blocks:
```html
<div class="talent-item">
    <a href="https://shoutout.us/USERNAME?utm_source=email&utm_medium=promo&utm_campaign=santa25" class="talent-avatar-link">
        <img src="IMAGE_URL" alt="NAME" class="talent-avatar">
        <div class="talent-name">NAME</div>
        <div class="talent-category-badge">CATEGORY</div>
    </a>
</div>
```

### To Change Example Shoutouts
Edit the text in the `shoutout-text` div while keeping the HTML structure intact.

## Best Practices

### Sending Strategy
1. **A/B Test Subject Lines**: Create 2-3 variations
2. **Optimal Send Times**: Tuesday-Thursday, 10 AM - 2 PM EST
3. **Segment Your List**: Send to engaged subscribers first
4. **Follow-Up**: Send reminder 3-4 days before promo ends

### Legal Compliance
- CAN-SPAM compliant (unsubscribe link included)
- GDPR compliant (preference center link included)
- Physical address required (add in Mailchimp campaign settings)

### Performance Metrics to Track
- **Open Rate**: Aim for 20-25%
- **Click Rate**: Aim for 3-5%
- **Conversion Rate**: Track SANTA25 code usage
- **Revenue Generated**: Monitor order value from email traffic

## Troubleshooting

### Images Not Loading
- Ensure images are uploaded to Mailchimp Content Studio
- Check image URLs are correct
- Verify images are publicly accessible
- Use fallback images in `onerror` attribute

### Template Looks Broken in Preview
- Some email clients strip certain CSS
- Always send test emails to verify
- Use inline styles when possible (already done)

### Links Not Working
- Ensure all URLs start with `https://`
- Test each link individually
- Check for extra spaces in URLs

### Promo Code Not Working
- Verify SANTA25 code is active in your e-commerce system
- Check start/end dates
- Ensure 25% discount is correctly configured

## Need Help?

If you encounter issues:
1. Check Mailchimp's documentation
2. Send test emails to troubleshoot
3. Contact Mailchimp support
4. Review email client compatibility

## Version History

- **v1.0** (2024-12) - Initial SANTA25 holiday promo template
  - Dark theme matching ShoutOut site
  - 4 example shoutouts
  - 6 featured talent
  - Mobile responsive
  - UTM tracking enabled

