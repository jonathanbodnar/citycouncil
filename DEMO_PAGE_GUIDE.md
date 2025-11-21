# Demo Page - Instagram Reels Style Interface

## Overview
The `/demo` page is a mobile-first, full-screen video browsing experience inspired by Instagram Reels and TikTok. It provides an immersive way to discover talent through completed videos.

## Features

### 1. **Vertical Video Feed** (Main View)
- Full-screen video player with auto-play
- Swipe up/down or scroll to navigate between videos
- Tap video to play/pause
- Videos loop automatically

### 2. **Interactive Elements**
- **Heart Button**: Like videos (works without login)
  - Displays like count
  - Animates when liked
  - Persists in session

- **Talent Avatar**: Tap to view talent list
  - Shows current talent profile picture
  - Acts as navigation to talent panel

- **Order CTA**: Bottom banner with pricing
  - Shows talent name and price
  - Links to ordering (future enhancement)

- **Talent Circles**: Horizontal scrollable row at bottom
  - Quick preview of available talent
  - Tap any to go to talent panel

### 3. **Horizontal Navigation** (Swipe Left/Right)
Four main panels accessible via swipe gestures:

#### Panel 1: Feed (Default)
- Vertical scrolling video feed
- Main discovery interface

#### Panel 2: Talent
- Grid view of all active talent
- Same cards as homepage
- Browse and select talent profiles

#### Panel 3: Orders
- View your order history
- Status indicators (pending, in progress, completed)
- Video previews for completed orders
- Requires login

#### Panel 4: Profile
- User account management
- Links to dashboard, notifications, help
- Sign in/out functionality

## Navigation

### Touch Gestures
- **Swipe Up**: Next video (in feed)
- **Swipe Down**: Previous video (in feed)
- **Swipe Left**: Next panel (Feed → Talent → Orders → Profile)
- **Swipe Right**: Previous panel (Profile → Orders → Talent → Feed)
- **Tap Video**: Play/Pause

### Desktop Controls
- **Mouse Wheel**: Navigate videos
- **Click**: Interact with buttons and links

## Technical Implementation

### Components Created
1. **`DemoPage.tsx`** - Main page component
   - Manages state for videos, panels, navigation
   - Handles touch/swipe gestures
   - Fetches video feed data

2. **`ReelsVideoPlayer.tsx`** - Video player component
   - Auto-play/pause based on active state
   - Loop playback
   - Click to play/pause

3. **`TalentPanel.tsx`** - Talent browsing panel
   - Displays talent cards in grid
   - Navigation controls

4. **`OrdersPanel.tsx`** - Orders history panel
   - Fetches user orders from Supabase
   - Shows order status and videos
   - Handles unauthenticated state

5. **`ProfilePanel.tsx`** - User profile panel
   - Account management
   - Sign in/out
   - Navigation to other features

### Data Flow
```
DemoPage (Main)
├── Fetches completed orders with videos
├── Fetches all active talent
├── Manages current video index
├── Manages current panel view
└── Passes data to child panels
```

### State Management
- Local component state (no global state needed)
- Touch gesture tracking via refs
- Panel position managed by CSS transform

### Styling
- Full-screen layout (100vh/100vw)
- Black background for video immersion
- Glass morphism UI overlays
- Smooth transitions between panels
- Mobile-first responsive design

## URL Structure
```
/demo - Main demo interface
```

## No Header/Footer
The demo page is standalone without the typical app header, footer, or mobile navigation. This provides a fully immersive, app-like experience.

## Future Enhancements
1. **Persistent Likes**: Store likes in database
2. **Share Functionality**: Share videos to social media
3. **Comments**: Add comment system
4. **Deep Linking**: Link to specific videos
5. **Analytics**: Track engagement metrics
6. **Order Flow**: Direct ordering from video view
7. **Filters**: Filter by category/talent
8. **Search**: Search videos by content

## Browser Compatibility
- Modern browsers (Chrome, Safari, Firefox, Edge)
- Mobile Safari (iOS 13+)
- Chrome Mobile (Android 8+)
- Supports touch events and mouse wheel

## Performance Considerations
- Videos fetched with limit (20 max)
- Lazy video loading (browser native)
- Efficient state updates
- CSS transforms for smooth animations
- No heavy dependencies

## Database Queries
```sql
-- Fetches completed orders with videos
SELECT orders.*, talent_profiles.*
FROM orders
JOIN talent_profiles ON orders.talent_id = talent_profiles.id
WHERE orders.status = 'completed'
AND orders.video_url IS NOT NULL
ORDER BY orders.created_at DESC
LIMIT 20;
```

## Usage
Simply navigate to `/demo` in your browser. No authentication required to browse videos and talent. Authentication required to view personal orders.

