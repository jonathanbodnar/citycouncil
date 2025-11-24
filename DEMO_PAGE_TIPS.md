# Demo Page - Tips & Customization

## Quick Start

### Access the Demo Page
Simply navigate to: `https://yoursite.com/demo`

No authentication required to browse videos and talent!

## Customization Guide

### 1. Change Video Feed Limit
**File**: `src/pages/DemoPage.tsx`

```typescript
// Current: Loads 20 videos
.limit(20);

// Change to 50:
.limit(50);

// Load all (remove limit):
// .limit(20); // <- Remove this line
```

### 2. Modify Like Behavior
**File**: `src/pages/DemoPage.tsx`

To make likes persistent in database:
```typescript
const handleLike = async (videoId: string) => {
  // Add database insert/update here
  const { error } = await supabase
    .from('video_likes')
    .upsert({
      user_id: user?.id || 'anonymous',
      video_id: videoId,
      liked_at: new Date().toISOString()
    });
    
  if (!error) {
    setVideos(prev => /* update state */);
  }
};
```

### 3. Add Direct Ordering from Video
**File**: `src/pages/DemoPage.tsx`

Make the CTA button functional:
```typescript
// Change this:
<div className="bg-blue-600/80 ...">
  Order now: {talent.name} - ${talent.pricing}
</div>

// To this:
<Link 
  to={`/order/${currentVideo.talent.id}`}
  className="bg-blue-600/80 ..."
>
  Order now: {talent.name} - ${talent.pricing}
</Link>
```

### 4. Filter Videos by Talent
Add a filter state:
```typescript
const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null);

// In your query:
let query = supabase
  .from('orders')
  .select(/* ... */)
  .eq('status', 'completed');

if (selectedTalentId) {
  query = query.eq('talent_id', selectedTalentId);
}
```

### 5. Add Share Functionality
**File**: `src/pages/DemoPage.tsx`

Add a share button:
```typescript
const handleShare = async () => {
  if (navigator.share) {
    await navigator.share({
      title: `Check out ${currentVideo.talent.name}`,
      url: window.location.href,
    });
  }
};

// Add button in UI:
<button onClick={handleShare}>
  <ShareIcon className="w-10 h-10 text-white" />
</button>
```

### 6. Infinite Scroll
Add "Load More" functionality:
```typescript
const [offset, setOffset] = useState(0);

const loadMoreVideos = async () => {
  const { data } = await supabase
    .from('orders')
    .select(/* ... */)
    .range(offset, offset + 19);
    
  setVideos(prev => [...prev, ...data]);
  setOffset(prev => prev + 20);
};

// Trigger when reaching last video
if (currentVideoIndex === videos.length - 1) {
  loadMoreVideos();
}
```

### 7. Add Comments
Create a comments panel:
```typescript
// Add new state
const [showComments, setShowComments] = useState(false);

// Add comments icon in video overlay
<button onClick={() => setShowComments(true)}>
  <ChatBubbleIcon />
</button>

// Render comments modal
{showComments && <CommentsModal videoId={currentVideo.id} />}
```

### 8. Video Analytics
Track video views:
```typescript
useEffect(() => {
  if (currentVideo) {
    // Track view
    supabase
      .from('video_views')
      .insert({
        video_id: currentVideo.id,
        user_id: user?.id || null,
        viewed_at: new Date().toISOString()
      });
  }
}, [currentVideo]);
```

### 9. Change Swipe Sensitivity
**File**: `src/pages/DemoPage.tsx`

```typescript
// Current threshold: 50px
if (Math.abs(deltaX) > 50) {

// Make it more sensitive (easier to swipe):
if (Math.abs(deltaX) > 30) {

// Make it less sensitive (harder to swipe):
if (Math.abs(deltaX) > 80) {
```

### 10. Customize Talent Circles Count
**File**: `src/pages/DemoPage.tsx`

```typescript
// Current: Shows first 10 talent
{talent.slice(0, 10).map(/* ... */)}

// Show more:
{talent.slice(0, 20).map(/* ... */)}

// Show all:
{talent.map(/* ... */)}
```

## Performance Tips

### 1. Optimize Video Loading
Use video preloading:
```typescript
<video 
  preload="metadata"  // Faster initial load
  // or
  preload="auto"      // Preload entire video
/>
```

### 2. Lazy Load Talent Cards
```typescript
import { lazy, Suspense } from 'react';

const TalentCard = lazy(() => import('./TalentCard'));

<Suspense fallback={<LoadingCard />}>
  <TalentCard talent={t} />
</Suspense>
```

### 3. Memoize Expensive Computations
```typescript
import { useMemo } from 'react';

const sortedTalent = useMemo(
  () => talent.sort((a, b) => /* sort logic */),
  [talent]
);
```

### 4. Debounce Scroll Events
```typescript
import { debounce } from 'lodash';

const handleScroll = debounce((e) => {
  // scroll logic
}, 100);
```

## Styling Customization

### Change Gradient Colors
**File**: `src/pages/DemoPage.tsx` or respective panel files

```typescript
// Current blue-red gradient:
className="bg-gradient-to-br from-gray-900 via-blue-900 to-red-900"

// Purple theme:
className="bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900"

// Green theme:
className="bg-gradient-to-br from-gray-900 via-green-900 to-blue-900"
```

### Adjust Animation Speed
```css
/* In component className */
transition-transform duration-300  // Current

transition-transform duration-500  // Slower
transition-transform duration-150  // Faster
```

### Change Glass Effect Opacity
**File**: `src/index.css`

```css
.glass {
  background: rgba(255, 255, 255, 0.1);  /* Current */
  
  /* More transparent: */
  background: rgba(255, 255, 255, 0.05);
  
  /* More opaque: */
  background: rgba(255, 255, 255, 0.2);
}
```

## Debugging Tips

### 1. Console Log Current State
```typescript
useEffect(() => {
  console.log('Current Video Index:', currentVideoIndex);
  console.log('Current Panel:', currentPanel);
  console.log('Videos Count:', videos.length);
}, [currentVideoIndex, currentPanel, videos]);
```

### 2. Show Touch Coordinates
```typescript
const handleTouchStart = (e: React.TouchEvent) => {
  console.log('Touch Start:', e.touches[0].clientX, e.touches[0].clientY);
  // ... rest of code
};
```

### 3. Monitor Video Events
```typescript
<video
  onPlay={() => console.log('Video playing')}
  onPause={() => console.log('Video paused')}
  onError={(e) => console.error('Video error:', e)}
/>
```

### 4. Test Swipe Thresholds
```typescript
const handleTouchEnd = (e: React.TouchEvent) => {
  const deltaX = touchEndX - touchStartX.current;
  console.log('Swipe Delta X:', deltaX);
  // Shows how far user swiped
};
```

## Common Issues & Solutions

### Issue: Videos Not Playing
**Solution**: Check autoplay policies
```typescript
// Add user interaction before playing
<video muted autoPlay playsInline />
```

### Issue: Swipe Not Working
**Solution**: Check z-index and pointer-events
```typescript
// Make sure container has pointer-events
<div className="..." style={{ pointerEvents: 'auto' }}>
```

### Issue: Videos Loading Slowly
**Solution**: Add loading state
```typescript
const [videoLoading, setVideoLoading] = useState(true);

<video
  onLoadedData={() => setVideoLoading(false)}
  onWaiting={() => setVideoLoading(true)}
/>

{videoLoading && <LoadingSpinner />}
```

### Issue: Panel Transitions Jerky
**Solution**: Use transform instead of left/right
```typescript
// Good (uses GPU):
style={{ transform: `translateX(-${panelIndex * 100}vw)` }}

// Bad (doesn't use GPU):
style={{ left: `-${panelIndex * 100}vw` }}
```

## Testing Checklist

- [ ] Test on iPhone Safari
- [ ] Test on Android Chrome
- [ ] Test on desktop Chrome/Firefox
- [ ] Test with/without authentication
- [ ] Test with 0 videos (empty state)
- [ ] Test with slow network (3G)
- [ ] Test video play/pause
- [ ] Test all swipe directions
- [ ] Test all panel navigations
- [ ] Test like functionality

## Browser Support

### Supported
✅ Chrome 90+
✅ Safari 14+
✅ Firefox 88+
✅ Edge 90+
✅ iOS Safari 13+
✅ Chrome Mobile 90+

### Known Issues
⚠️ IE11: Not supported (use modern browsers)
⚠️ Old Android (< v8): Limited support

## Future Roadmap

### Phase 1 (Current) ✅
- [x] Vertical video scrolling
- [x] Horizontal panel navigation
- [x] Like functionality
- [x] Talent browsing
- [x] Orders viewing

### Phase 2 (Planned)
- [ ] Persistent likes in database
- [ ] Direct ordering from video
- [ ] Share functionality
- [ ] Comments system
- [ ] Deep linking

### Phase 3 (Future)
- [ ] Video search
- [ ] Category filters
- [ ] Trending section
- [ ] Recommendations
- [ ] Analytics dashboard

## Support

For issues or questions, check:
1. `DEMO_PAGE_GUIDE.md` - Full documentation
2. `DEMO_PAGE_LAYOUT.md` - Visual layouts
3. `DEMO_PAGE_SUMMARY.md` - Implementation details

Or contact your development team!

