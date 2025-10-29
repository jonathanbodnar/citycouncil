# Landing Page Redesign - Deployment Guide

## 🎨 What's New

### Landing Page (`/`)
- **Dark Glass Morphism Theme**: Beautiful gradient background (gray-900 → blue-900)
- **White Logo**: Cleaner, modern header
- **25% Off Offer**: Email capture with exclusive discount code incentive
- **Video Carousel**: Swipeable promo video showcase below email field
  - Rounded borders with white/20 opacity
  - Left/Right navigation buttons
  - Dot indicators for multiple videos
  - Autoplay, muted, loop
- **Redesigned Benefits**: 3 glass-effect cards with colored icons
- **Dark Footer**: Matches new theme

### Admin Features
- **New "Landing Videos" Tab**: Upload and manage promo videos for landing page
- **Video Management**:
  - Upload videos with titles/descriptions
  - Reorder display sequence (up/down arrows)
  - Toggle visibility (show/hide from public)
  - Delete videos
  - Preview thumbnails

---

## 📋 Deployment Steps

### 1. Run Database Migration

Go to **Supabase Dashboard** → **SQL Editor** → **New Query**

Paste and run the contents of `/database/landing_page_tables.sql`:

```sql
-- Creates two tables:
-- 1. email_waitlist (for 25% off signups)
-- 2. landing_promo_videos (for admin-managed promo videos)
```

This will:
- Create `email_waitlist` table
- Create `landing_promo_videos` table
- Set up RLS policies
- Add indexes for performance

---

### 2. Upload Promo Videos (Admin Only)

1. Log in as admin
2. Go to `/admin`
3. Click **"Landing Videos"** tab
4. Upload 2-3 example promo videos:
   - Short clips (5-30 seconds recommended)
   - Examples of different types of shoutouts
   - Birthday, celebration, motivational, etc.
5. Add optional titles/descriptions
6. Reorder them as desired

**Video Requirements:**
- Max 100MB per file
- Any video format (mp4, mov, webm, etc.)
- Will be uploaded to Wasabi automatically

---

### 3. Test the Landing Page

1. **Visit the root URL** (`https://shoutout.us/`)
2. **Check the new design**:
   - Dark gradient background
   - White "ShoutOut" logo
   - "Get 25% Off Your First ShoutOut!" headline
   - Email input + "Get My 25% Off" button
   - Video carousel (if videos uploaded)
   - 3 benefit cards at bottom

3. **Test Email Signup**:
   - Enter an email
   - Click "Get My 25% Off"
   - Should see success toast: "🎉 You're in! Check your email for your 25% off code."
   - Check Supabase → `email_waitlist` table for the entry

4. **Test Video Carousel**:
   - Videos should autoplay (muted)
   - Click left/right arrows to navigate
   - Click dots to jump to specific video
   - Videos should have rounded borders

---

## 🎬 Video Carousel Features

- **Autoplay**: Videos start playing automatically (muted for browser compatibility)
- **Loop**: Videos repeat continuously
- **Navigation**: Left/Right arrows (only shown if multiple videos)
- **Indicators**: Dots at bottom show which video is active
- **Responsive**: Works on mobile with touch swipe support
- **Fallback**: If no videos uploaded, carousel section is hidden

---

## 📊 Admin Video Management

### Upload Process:
1. Select video file (max 100MB)
2. Add title (optional) - e.g., "Birthday Shoutout Example"
3. Add description (optional) - e.g., "See how personalities deliver birthday messages"
4. Click "Upload Video"
5. Video is uploaded to Wasabi and added to carousel

### Manage Videos:
- **Reorder**: Use ↑↓ arrows to change display sequence
- **Toggle**: Click 👁️ to show/hide from landing page
- **Delete**: Click trash icon to permanently remove

---

## 🔧 Technical Details

### New Database Tables:

**`email_waitlist`**
- `id` (UUID)
- `email` (unique, indexed)
- `source` (e.g., 'landing_page')
- `discount_code` (e.g., '25OFF')
- `created_at`

**`landing_promo_videos`**
- `id` (UUID)
- `video_url` (Wasabi URL)
- `title` (optional)
- `description` (optional)
- `display_order` (for carousel sequence)
- `is_active` (show/hide toggle)
- `created_at`, `updated_at`

### Frontend Components:
- `/src/pages/ComingSoonPage.tsx` - Redesigned landing page
- `/src/components/LandingPromoVideos.tsx` - Admin video management
- `/src/components/AdminManagementTabs.tsx` - Added "Landing Videos" tab

### Video Storage:
- Uses existing Wasabi S3 integration (`/src/services/videoUpload.ts`)
- Videos served via CloudFlare CDN (`https://videos.shoutout.us/`)

---

## 🚀 Next Steps

1. **Deploy Database Migration** (run SQL)
2. **Test Landing Page** (visit root URL)
3. **Upload 2-3 Promo Videos** (via admin panel)
4. **Test Email Signup** (enter email, verify in database)
5. **Test Video Carousel** (swipe, click arrows, check responsive)

---

## 💡 Future Enhancements

- Email automation for 25% off code delivery (Mailgun integration)
- Analytics tracking for video views/engagement
- A/B testing different video orders
- Video upload from URL (in addition to file upload)
- Thumbnail customization for videos

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify database tables were created
3. Ensure videos are uploading to Wasabi
4. Check Supabase RLS policies are active

Enjoy your new landing page! 🎉

