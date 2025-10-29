# Email Template for Wasabi Public Access Request

---

**Subject:** Request for Public Access Approval - Video Marketplace Platform

---

**Dear Wasabi Support Team,**

I am writing to request approval for public access configuration on my Wasabi storage buckets for my production application.

## **Use Case Overview**

I operate **ShoutOut** (https://shoutout.us), a video marketplace platform that connects users with public figures, celebrities, and influencers for personalized video messages. Our platform allows:

- **Talent** (verified public figures) to upload promotional videos and profile images
- **Users** to order custom video messages for personal occasions or business purposes
- **Delivered videos** to be viewed directly by customers who purchased them

All content is user-generated and needs to be accessible via direct URLs for:
1. **Profile pages** displaying talent promotional videos and avatars
2. **Customer dashboards** where users can view and download their purchased videos
3. **Order confirmation emails** with embedded video links
4. **Social media sharing** of promotional content

## **Storage Details**

- **Buckets:** 
  - `shoutout-assets` (images, profile pictures, promotional content)
  - `shoutoutorders` (customer order videos)
- **Expected Storage Volume:** Starting with ~10-50GB, scaling to 500GB+ over the next 12 months
- **Expected Monthly Egress:** ~100-200GB initially
- **Average File Sizes:** 
  - Images: 500KB - 5MB
  - Videos: 5MB - 50MB per video

## **Infrastructure & Compliance**

To ensure compliance with Wasabi's egress policy and terms of service:

1. **CDN Implementation:** We will implement CloudFlare CDN caching to minimize direct Wasabi egress
2. **Caching Strategy:** All static assets (images, videos) will be cached at the edge with appropriate TTLs
3. **No Direct Hosting:** Videos are not streamed directly from Wasabi; they're cached and delivered via CDN
4. **Access Control:** While buckets are public, all uploads require authenticated API calls
5. **Abuse Prevention:** We have content moderation policies and user verification for talent accounts

## **Contact Information**

- **Name:** [Your Name]
- **Email:** [Your Email]
- **Phone:** [Your Phone Number] ← **Required by Wasabi**
- **Company:** ShoutOut
- **Website:** https://shoutout.us

## **Commitment**

I understand and agree to:
- Maintain compliance with Wasabi's egress policy (storage:egress ratio requirements)
- Implement CDN/caching to reduce direct bandwidth usage
- Provide immediate response if any abuse complaints are received
- Accept that public access may be disabled if policy violations occur

I appreciate your consideration of this request. Please let me know if you need any additional information or documentation about our use case.

Thank you for your time and support.

**Best regards,**  
[Your Name]  
[Your Title]  
ShoutOut  
[Your Phone Number]  
[Your Email]

---

## **Where to Send This Email**

Send to: **support@wasabi.com**

**Alternative:** You can also submit via their support portal:
- Go to: https://console.wasabisys.com/
- Click "Support" in the top navigation
- Click "Submit a Ticket"
- Category: "Account Management" or "Technical Support"

---

## **Expected Timeline**

- Typical response: 24-48 hours (business days)
- Approval decision: 1-3 business days
- May require follow-up questions about CDN setup or storage projections

---

## **What Happens After Approval?**

Once approved, you'll need to:

1. **Update bucket policies** (I'll help with this)
2. **Switch from pre-signed URLs back to direct URLs** in the code
3. **Optional:** Set up CloudFlare CDN for better performance and egress compliance

Let me know once you get approval and I'll help implement the changes!

---

## **If They Deny Public Access**

If Wasabi denies the request, we have fallback options:
1. Implement automatic pre-signed URL regeneration (7-day refresh cycle)
2. Switch to a different storage provider (AWS S3, Backblaze B2, Cloudflare R2)
3. Use Supabase Storage (built-in, simpler, but more expensive)

