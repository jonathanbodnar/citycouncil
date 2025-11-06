# Mobile Onboarding Optimization Plan

## Issues Identified:
1. ❌ Steps require scrolling on mobile
2. ❌ Image upload blocked by CSP (FIXED)
3. ❌ Forms too tall for mobile viewport
4. ❌ Progress indicator takes too much space

## Optimizations Needed:

### 1. Compact Progress Indicator
- Change from horizontal stepper to small dots/circles
- Make it sticky at top
- Reduce height from ~80px to ~40px

### 2. Reduce Form Field Sizes
- Smaller labels (text-xs instead of text-sm)
- Compact inputs (py-2 instead of py-3)
- Tighter spacing (gap-3 instead of gap-4)
- Use placeholders instead of floating labels

### 3. Step-Specific Optimizations

#### Step 1: Create Account
- Remove unnecessary description text
- Stack fields vertically with minimal gaps
- Make "Sign In" toggle more compact

#### Step 2: Profile Info
- Use native dropdowns instead of custom selects
- Reduce bio textarea rows (3 instead of 5)
- Make image upload area smaller (120px instead of 200px)
- Inline pricing fields (2 columns)

#### Step 3: Charity
- Make toggle more prominent
- Hide fields when toggle is off
- Use minimal spacing

#### Step 4: Promo Video
- Reduce instruction text
- Make video upload button more compact
- Show recording tips in a collapsible section

#### Step 5: MFA
- Keep existing compact design
- Make it optional/skippable

### 4. Mobile-First Styles
```css
/* Container */
- max-height: calc(100vh - 60px)
- overflow-y: auto
- padding: 12px (instead of 24px)

/* Form Fields */
- text-sm (instead of text-base)
- py-2 px-3 (instead of py-3 px-4)
- mb-3 (instead of mb-4)

/* Buttons */
- py-2.5 (instead of py-3)
- text-sm font-medium
```

## Implementation Priority:
1. ✅ Fix CSP for image uploads (DONE)
2. 🔄 Compact progress indicator
3. 🔄 Reduce form field sizes
4. 🔄 Optimize each step for mobile
5. 🔄 Test on actual mobile device

## Target:
- Each step fits in 667px height (iPhone SE)
- No scrolling required within steps
- Fast, thumb-friendly interactions

