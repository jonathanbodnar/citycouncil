# Promo Graphic Generator - Setup Guide

## Overview
The promo graphic generator creates shareable Instagram-ready graphics for talent to promote their ShoutOut profiles.

## Features
✅ Canvas-based image generation (1080x1350px - Instagram 4:5 ratio)
✅ Loads talent avatar and fits it to white space with featured card alignment
✅ Overlays transparent BackgroundNew.png frame
✅ Adds talent name with TT Ramillas font (or Playfair Display fallback)
✅ Adds profile URL with Open Sans font
✅ Download as PNG with talent name in filename

## Setup Required

### 1. Add BackgroundNew.png Overlay Image

**Location:** `/public/BackgroundNew.png`

**Specifications:**
- Dimensions: 1080x1350px (4:5 aspect ratio)
- Format: PNG with transparency
- Design: 
  - White/semi-transparent frame in top 70% (for talent photo)
  - Gradient background in bottom 30% (red-to-purple gradient)
  - ShoutOut logo in top left
  - Three dots in top right
  - ShoutOut icon in bottom left

**How to create:**
1. Use the mockup provided as reference
2. Create the frame overlay in Figma/Photoshop/Canva
3. Export as PNG with transparency
4. Save to `/public/BackgroundNew.png`

**Alternative:** If you have the source file, share it and I can help optimize it.

### 2. TT Ramillas Font (Optional Premium Upgrade)

**Current State:** Using Playfair Display (free Google Font) as fallback
**Upgrade Path:**
1. Purchase TT Ramillas font license
2. Add font files to `/public/fonts/` directory
3. Update `/src/index.css` with @font-face declarations:

```css
@font-face {
  font-family: 'TT Ramillas';
  src: url('/fonts/TT-Ramillas-Bold.woff2') format('woff2'),
       url('/fonts/TT-Ramillas-Bold.woff') format('woff');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

4. Remove the TODO comment from `/public/index.html`

## How It Works

### User Flow:
1. Talent visits `/welcome` page
2. Clicks "Download your promo graphic" button
3. Generator:
   - Fetches talent avatar from Supabase
   - Creates 1080x1350px canvas
   - Draws avatar fitted to white space (top 70%)
   - Overlays BackgroundNew.png frame
   - Adds text: "Get your personalized ShoutOut video from [Talent Name]"
   - Adds profile URL: "ShoutOut.us/[username]"
4. Downloads as PNG: `ShoutOut-[Talent-Name].png`

### Technical Details:

**Avatar Fitting:**
- Uses featured card alignment (object-top crop)
- Maintains aspect ratio
- Centers horizontally, crops from top for face-focused framing

**Text Rendering:**
- Talent name: TT Ramillas (or Playfair Display), 700 weight, 52px, white with shadow
- Profile URL: Open Sans, 400 weight, 28px, bottom left next to icon
- Word wrapping for long talent names

**Error Handling:**
- Checks if avatar exists before generating
- Shows loading state during generation
- Toast notifications for success/errors
- Disables button if no profile photo

## Testing

### Test Locally:
1. Ensure BackgroundNew.png is in `/public/`
2. Log in as a talent user with a profile photo
3. Visit `/welcome` page
4. Click "Download your promo graphic"
5. Check downloaded PNG matches mockup design

### Test Cases:
- ✅ Talent with profile photo → Should generate and download
- ✅ Talent without profile photo → Should show error message
- ✅ Long talent names → Should word wrap properly
- ✅ Different username formats → Should display correctly
- ✅ Avatar aspect ratios (square, portrait, landscape) → Should crop correctly

## Files Modified

### New Files:
- `/src/services/promoGraphicGenerator.ts` - Canvas-based graphic generator

### Updated Files:
- `/src/pages/WelcomePage.tsx` - Added button handler and state management
- `/public/index.html` - Added Google Fonts (Open Sans, Playfair Display)

### Pending:
- `/public/BackgroundNew.png` - **NEEDS TO BE ADDED**

## Deployment Checklist

- [ ] Add BackgroundNew.png to `/public/` directory
- [ ] Test graphic generation with various talent profiles
- [ ] Verify fonts load correctly (Open Sans, Playfair Display)
- [ ] Test download on mobile and desktop
- [ ] Verify CORS settings for avatar images (if hosted externally)
- [ ] (Optional) Purchase and add TT Ramillas font for premium look
- [ ] Update CSP headers if needed for font loading

## CSP Considerations

Current CSP should allow:
- ✅ Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
- ✅ Supabase avatar images (already allowed)
- ✅ Canvas blob generation (no external resources)

## Future Enhancements

- [ ] Add preview modal before download
- [ ] Multiple template options (different backgrounds/layouts)
- [ ] Custom color schemes per talent
- [ ] Batch generation for multiple sizes (Instagram, Facebook, Twitter)
- [ ] QR code integration for easy profile access
- [ ] Analytics tracking for graphic downloads

## Support

If graphic generation fails:
1. Check browser console for errors
2. Verify BackgroundNew.png exists and is accessible
3. Confirm avatar_url is valid in talent_profiles table
4. Test with different browsers (Canvas API compatibility)
5. Check image CORS settings if loading from external CDN

---

**Status:** ⚠️ Pending BackgroundNew.png overlay image
**Priority:** High (needed for soft launch)
**Estimated Setup Time:** 10 minutes (once overlay image is ready)

