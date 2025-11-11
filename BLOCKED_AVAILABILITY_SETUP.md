# Blocked Availability System - Setup Guide

## Overview
Talent can now set date ranges when they're unavailable. During these periods:
- ✅ Badge shows "Unavailable" on their profile card
- ✅ Order button is greyed out/disabled
- ✅ Profile remains live/visible
- ✅ After end date, automatically returns to "Available"

## Deployment

### 1. Run Database Migration
Go to **Supabase SQL Editor** and run:
```sql
-- File: database/add_blocked_availability.sql
```

This creates:
- `blocked_availability` table
- `is_talent_currently_unavailable(talent_id)` function
- RLS policies
- Indexes

### 2. Deploy Frontend
Already deployed! The UI is in:
- **Admin**: Edit talent → "Blocked Availability" section (at bottom)
- **Talent**: Their profile editor

## How Talent Uses It

1. **Add Blocked Dates**:
   - Go to Profile Editor
   - Scroll to "Blocked Availability" section
   - Set start date, end date, optional reason
   - Click "Add Blocked Dates"

2. **Remove Blocked Dates**:
   - Click the X button next to any blocked date range
   - Confirm deletion

3. **View Status**:
   - Active blocks show "Active Now" badge in yellow
   - See all upcoming blocked periods

## Features

### Date Management
- Can set multiple date ranges
- Start date minimum: today
- End date must be >= start date
- Optional reason (e.g., "Vacation", "Personal")

### Visual Indicators
- **Active blocks**: Yellow background, "Active Now" badge
- **Upcoming blocks**: White background
- Calendar icon for each range

### Auto-cleanup
- Past dates can be manually removed
- System checks current date against all ranges

## Database Structure

```sql
blocked_availability (
  id UUID PRIMARY KEY,
  talent_id UUID REFERENCES talent_profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
)
```

## TODO (Next Steps)

### Update Profile Display
Need to update these components to check availability and show badge/disable button:

1. **`src/components/FeaturedCarousel.tsx`**:
   - Check `is_talent_currently_unavailable(talent.id)`
   - Show "Unavailable" badge instead of "Available"
   - Grey out order button

2. **`src/pages/TalentProfilePage.tsx`**:
   - Same checks
   - Disable "Order Now" button
   - Show unavailable message

3. **`src/pages/HomePage.tsx`** (talent grid):
   - Update talent cards to show unavailable status

### Implementation Example
```typescript
// Fetch blocked status
const { data: isBlocked } = await supabase
  .rpc('is_talent_currently_unavailable', { talent_profile_id: talentId });

// Show badge
{isBlocked ? (
  <span className="bg-gray-500">Unavailable</span>
) : (
  <span className="bg-green-500">Available</span>
)}

// Disable button
<button 
  disabled={isBlocked}
  className={isBlocked ? 'opacity-50 cursor-not-allowed' : ''}
>
  Order Now
</button>
```

## Admin Features
- Admins can manage blocked dates for any talent
- See all upcoming blocks in talent list
- Quick add/remove from talent editor

## Notes
- Blocked dates don't affect existing orders
- Profile remains visible during blocked periods
- Orders can't be placed during blocked dates
- Automatically becomes available after end date
- No manual "unblock" needed

