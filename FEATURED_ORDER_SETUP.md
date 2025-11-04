# Featured Order Setup Guide

This feature allows admins to manually control the order of featured talent in the carousel on the homepage.

## Database Migration

**Run this SQL in Supabase SQL Editor:**

```sql
-- Add featured_order column to talent_profiles table
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_talent_profiles_featured_order 
ON talent_profiles(featured_order) 
WHERE is_featured = true;

-- Update existing featured talent to have sequential orders
WITH featured_talents AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM talent_profiles
  WHERE is_featured = true
)
UPDATE talent_profiles
SET featured_order = featured_talents.row_num
FROM featured_talents
WHERE talent_profiles.id = featured_talents.id;

-- Add comment for documentation
COMMENT ON COLUMN talent_profiles.featured_order IS 'Order position for featured talent in carousel (1 = first, 2 = second, etc.)';
```

## How It Works

### Admin Panel
1. Click the star (⭐) button to mark a talent as featured
2. Once featured, a dropdown appears showing "Order..."
3. Select a position (1, 2, 3, etc.) from the dropdown
4. The system automatically shifts other featured talent:
   - If you select position 2, and someone was already at position 2, they move to position 3
   - Everyone else shifts down accordingly

### Homepage
- Featured talent now display in the order you set (1 = first, 2 = second, etc.)
- The carousel respects the `featured_order` field
- Talent without an order still appear, but after ordered ones

## Features

### Automatic Shifting
When you set a featured order:
- **New featured talent**: All existing featured talent at or after that position shift down by 1
- **Moving existing**: Talent between old and new position shift appropriately
- **Removing featured**: The `featured_order` is set to `null`

### Example Scenario
Current order:
1. Tucker Carlson
2. Josh Firestine
3. Jane Smith

You want to feature "John Doe" at position 2:

Result:
1. Tucker Carlson (unchanged)
2. John Doe (newly added)
3. Josh Firestine (shifted from 2 to 3)
4. Jane Smith (shifted from 3 to 4)

## Code Changes

### Files Modified
1. `src/components/TalentManagement.tsx`
   - Added `setFeaturedOrder()` function
   - Modified `toggleTalentStatus()` to handle featured_order
   - Added dropdown UI for selecting order

2. `src/pages/HomePage.tsx`
   - Updated `fetchFeaturedTalent()` to order by `featured_order`

3. `src/types/index.ts`
   - Added `featured_order?: number | null` to `TalentProfile`

4. `database/add_featured_order.sql`
   - Migration script for database changes

## Testing

1. Go to Admin Dashboard → Talent Management
2. Click the star (⭐) on any talent to make them featured
3. Use the "Order..." dropdown to select a position
4. Check another featured talent - they should have shifted
5. Go to Homepage - verify the carousel shows them in the correct order
6. Click the star again to unfeature - order should be removed

## Notes

- Featured order is only visible/editable for featured talent
- The dropdown shows up to 10 positions (or more if you have more featured talent)
- Unfeaturing a talent removes their order and doesn't affect other positions
- The database migration automatically assigns orders to existing featured talent

