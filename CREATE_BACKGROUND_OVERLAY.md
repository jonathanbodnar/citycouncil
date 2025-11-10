# Create BackgroundNew.png Overlay - Quick Guide

## Exact Specifications

### Canvas Size
- **Width:** 1080px
- **Height:** 1350px
- **Format:** PNG with transparency
- **File size:** Keep under 500KB

## Design Layout (Based on Your Mockup)

### Top Section (0-950px) - Semi-transparent white/light overlay
**Purpose:** Frame for talent avatar photo

**Elements:**
1. **ShoutOut Logo** (top left)
   - Position: ~80px from left, ~80px from top
   - Size: ~150px wide
   - Color: White with slight transparency (rgba(255,255,255,0.9))

2. **Three Dots** (top right)
   - Position: ~80px from right, ~80px from top
   - Size: 3 circles, ~40px diameter each
   - Color: Light purple/mauve (rgba(200,180,200,0.5))
   - Spacing: ~20px between circles

3. **Frame Border** (optional)
   - Rounded corners matching mockup (border-radius: ~60px)
   - Can add subtle border or just transparency

### Bottom Section (950-1350px) - Solid gradient background
**Purpose:** Text and branding area

**Gradient:**
- Start color (top): `#991b1b` (red-900) or similar red
- End color (bottom): `#6b21a8` (purple-800) or similar purple
- Direction: Top to bottom (180deg)

**Elements:**
1. **ShoutOut Icon** (bottom left)
   - Position: ~100px from left, ~80px from bottom
   - Size: ~60px square
   - Icon: Megaphone/speaker icon (white)

2. **Text Area** (centered)
   - Leave space for: "Get your personalized ShoutOut video from [talent name]"
   - Position: Centered horizontally, ~200-350px from bottom
   - Note: Text is rendered by code, so just ensure background is clear

3. **URL Area** (bottom left, next to icon)
   - Leave space for: "ShoutOut.us/[profile]"
   - Position: ~160px from left, ~80px from bottom
   - Note: Text is rendered by code

## Color Palette

```
White overlay:        rgba(255, 255, 255, 0.95)
Mauve dots:          rgba(200, 180, 200, 0.5)
Red gradient start:  #991b1b or #b91c1c
Purple gradient end: #6b21a8 or #7e22ce
White text/icons:    #ffffff
```

## How to Create

### Option 1: Figma
1. Create new frame: 1080x1350px
2. Add rectangle for top section (1080x950px)
   - Fill: White with 95% opacity
   - Corner radius: 60px (top corners)
3. Add rectangle for bottom section (1080x400px)
   - Fill: Linear gradient (red to purple, 180deg)
   - Position at bottom
4. Add ShoutOut logo (top left)
5. Add three dots (top right)
6. Add megaphone icon (bottom left)
7. Export as PNG

### Option 2: Canva
1. Create custom size: 1080x1350px
2. Use rectangle tool for white overlay section
3. Use gradient tool for bottom section
4. Add text/icons as shapes
5. Download as PNG (transparent background)

### Option 3: Photoshop
1. New document: 1080x1350px, transparent background
2. Create white rectangle layer (0-950px height) at 95% opacity
3. Create gradient layer (950-1350px height)
4. Add logo and icon layers
5. Save as PNG-24 with transparency

## Assets Needed

**ShoutOut Logo:**
- Can extract from existing site header
- Or use text "ShoutOut" in TT Ramillas/Playfair Display

**Megaphone Icon:**
- Use Heroicons `MegaphoneIcon` as reference
- Or similar icon from Font Awesome/Feather Icons

**Three Dots:**
- Simple circles, no special icon needed

## Quick Check Before Export

- [ ] Canvas size is exactly 1080x1350px
- [ ] Top section allows talent photo to be visible (semi-transparent or just border)
- [ ] Bottom gradient is solid (no transparency)
- [ ] ShoutOut logo is visible in top left
- [ ] Three dots are visible in top right
- [ ] Megaphone icon is visible in bottom left
- [ ] File is PNG format with transparency preserved
- [ ] File name is exactly `BackgroundNew.png`

## Installation

Once created:
```bash
# Save file as BackgroundNew.png
# Move to public folder
mv BackgroundNew.png /Users/jonathanbodnar/ShoutOut/public/

# Test locally
npm start
# Visit /welcome page and click "Download your promo graphic"
```

## Example Mockup Reference

Your mockup shows:
- Clean white frame in top 70%
- Vibrant red-to-purple gradient in bottom 30%
- ShoutOut branding clearly visible
- Professional, Instagram-ready look

## Need Help?

If you have the design file (Figma/PSD/AI), share it and I can:
- Optimize the export settings
- Ensure dimensions are correct
- Verify transparency is preserved
- Confirm it matches the code expectations

---

**Next Steps:**
1. Create BackgroundNew.png using one of the methods above
2. Save to `/public/BackgroundNew.png`
3. Test graphic generation on `/welcome` page
4. Adjust positioning/colors if needed

