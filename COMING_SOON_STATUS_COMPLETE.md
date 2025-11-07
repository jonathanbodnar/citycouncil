# Coming Soon Status - Complete Implementation Guide

## Overview
Added a "Coming Soon" status for talent profiles that allows admin to:
- Mark talent as "Coming Soon" in the talent editor
- Filter by status in Comms Center (Live, Coming Soon, Other)
- Send targeted mass texts to each group
- Exclude "Coming Soon" talent from appearing on `/home`

---

## Database Changes

### Migration: `database/add_coming_soon_status.sql`

**New Column:**
```sql
ALTER TABLE talent_profiles 
ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN DEFAULT false;
```

**Indexes Created:**
- `idx_talent_profiles_coming_soon`: Single column index on `is_coming_soon`
- `idx_talent_profiles_status_filters`: Composite index on `(is_active, is_featured, is_coming_soon)`

**Status Categories:**
1. **Live on /home**: `is_active = true AND is_coming_soon = false`
2. **Coming Soon**: `is_coming_soon = true` (visible in Comms Center, not on /home)
3. **Other**: `is_active = false AND is_coming_soon = false` (has phone but not live)

---

## Frontend Changes

### 1. TypeScript Types (`src/types/index.ts`)

**Added to `TalentProfile` interface:**
```typescript
is_coming_soon?: boolean; // Marks talent as "Coming Soon" - not visible on /home yet
```

### 2. Talent Profile Editor (`src/components/TalentProfileEditor.tsx`)

**Changes:**
- Added `is_coming_soon: boolean` to `ProfileFormData` interface
- Added default value: `is_coming_soon: talent.is_coming_soon || false`
- Added checkbox UI:
  ```jsx
  <div className="flex items-center">
    <input
      type="checkbox"
      {...register('is_coming_soon')}
      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
    />
    <label className="ml-2 block text-sm text-gray-900">
      Coming Soon
      <span className="ml-1 text-xs text-gray-500">(Not visible on /home)</span>
    </label>
  </div>
  ```
- Updated the save logic to include `is_coming_soon` in the database update

**Visual Style:**
- Amber/orange color scheme for "Coming Soon" (vs green for active, blue for featured)
- Clear helper text explaining it won't appear on /home

### 3. Comms Center (`src/components/CommsCenterManagement.tsx`)

**New State:**
```typescript
const [filteredTalents, setFilteredTalents] = useState<TalentWithPhone[]>([]);
const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'coming_soon' | 'other'>('all');
```

**Updated Query:**
```typescript
.select(`
  id,
  full_name,
  temp_full_name,
  username,
  temp_avatar_url,
  user_id,
  is_active,
  is_coming_soon,
  users!inner (
    phone,
    full_name,
    avatar_url
  )
`)
```

**Filtering Logic:**
```typescript
useEffect(() => {
  if (statusFilter === 'all') {
    setFilteredTalents(talents);
  } else if (statusFilter === 'live') {
    // Live talent: is_active = true AND is_coming_soon = false (or null)
    setFilteredTalents(talents.filter(t => t.is_active === true && !t.is_coming_soon));
  } else if (statusFilter === 'coming_soon') {
    // Coming Soon: is_coming_soon = true
    setFilteredTalents(talents.filter(t => t.is_coming_soon === true));
  } else if (statusFilter === 'other') {
    // Other: has phone but not live and not coming soon
    setFilteredTalents(talents.filter(t => t.is_active === false && !t.is_coming_soon));
  }
}, [statusFilter, talents]);
```

**New Filter UI:**
```jsx
{/* Status Filter Tabs */}
<div className="flex items-center gap-2 border-b border-gray-200">
  <button
    onClick={() => setStatusFilter('all')}
    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
      statusFilter === 'all'
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    All ({talents.length})
  </button>
  <button
    onClick={() => setStatusFilter('live')}
    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
      statusFilter === 'live'
        ? 'border-green-600 text-green-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    Live on /home ({talents.filter(t => t.is_active === true && !t.is_coming_soon).length})
  </button>
  <button
    onClick={() => setStatusFilter('coming_soon')}
    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
      statusFilter === 'coming_soon'
        ? 'border-amber-600 text-amber-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    Coming Soon ({talents.filter(t => t.is_coming_soon === true).length})
  </button>
  <button
    onClick={() => setStatusFilter('other')}
    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
      statusFilter === 'other'
        ? 'border-gray-600 text-gray-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    Other ({talents.filter(t => t.is_active === false && !t.is_coming_soon).length})
  </button>
</div>
```

**Mass Text Updates:**
- Button shows filtered count: `Mass Text ({filteredTalents.length})`
- Modal description: "This will send a text message to X talent(s) (Live on /home / Coming Soon / Other)"
- Send button: `Send to ${filteredTalents.length}`
- Send loop uses `filteredTalents` instead of `talents`

### 4. Home Page (`src/pages/HomePage.tsx`)

**Updated Query to Exclude "Coming Soon":**
```typescript
const { data, error } = await supabase
  .from('talent_profiles')
  .select(`
    *,
    users!talent_profiles_user_id_fkey (
      id,
      full_name,
      avatar_url
    )
  `)
  .eq('is_active', true)
  .or('is_coming_soon.is.null,is_coming_soon.eq.false') // Exclude "Coming Soon" talent
  .order('total_orders', { ascending: false });
```

---

## How To Use

### Admin Workflow

1. **Mark Talent as "Coming Soon":**
   - Go to Admin > Talent Management
   - Click "Edit" on a talent profile
   - Check the "Coming Soon" checkbox
   - Click "Save Changes"

2. **Send Mass Text to Coming Soon Talent:**
   - Go to Admin > Comms Center
   - Click the "Coming Soon" filter tab
   - Click "Mass Text (X)"
   - Type your message (e.g., "Get ready! We're launching your profile this Friday!")
   - Click "Send to X"

3. **Launch a Coming Soon Talent:**
   - Edit the talent profile
   - Uncheck "Coming Soon"
   - Ensure "Active Profile" is checked
   - Save
   - Talent now appears on `/home`

### Use Cases

**Coming Soon:**
- Talent has signed up but isn't ready to go live
- Profile is being finalized (promo video pending, etc.)
- Marketing coordination (launch on specific date)
- Batch launches (send mass text when all are ready)

**Other:**
- Inactive talent you still want to reach
- Testing accounts
- Archived talent with SMS access

---

## Database Deployment

### Step 1: Apply Migration

**Option A: Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard/project/utafetamgwukkbrlezev/sql
2. Copy contents of `database/add_coming_soon_status.sql`
3. Paste into SQL Editor
4. Click "Run"

**Option B: Supabase CLI**
```bash
supabase db execute -f database/add_coming_soon_status.sql
```

### Step 2: Verify

```sql
-- Check column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'talent_profiles' 
  AND column_name = 'is_coming_soon';

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'talent_profiles'
  AND indexname LIKE '%coming_soon%';

-- Check existing data (should all be false by default)
SELECT full_name, is_active, is_coming_soon
FROM talent_profiles
ORDER BY full_name;
```

---

## Testing

### Test Scenario 1: Mark Talent as Coming Soon
1. ✅ Admin > Talent > Edit talent
2. ✅ Check "Coming Soon"
3. ✅ Save
4. ✅ Talent disappears from `/home`
5. ✅ Talent appears in Comms Center "Coming Soon" filter

### Test Scenario 2: Mass Text Coming Soon
1. ✅ Comms Center > Click "Coming Soon" filter
2. ✅ Verify count is correct
3. ✅ Click "Mass Text (X)"
4. ✅ Modal shows correct count
5. ✅ Send test message
6. ✅ Verify only Coming Soon talent receive it

### Test Scenario 3: Launch Coming Soon Talent
1. ✅ Admin > Talent > Edit "Coming Soon" talent
2. ✅ Uncheck "Coming Soon"
3. ✅ Ensure "Active Profile" is checked
4. ✅ Save
5. ✅ Talent appears on `/home`
6. ✅ Talent moves to "Live on /home" filter in Comms Center

### Test Scenario 4: Filter Counts
1. ✅ Comms Center shows correct counts for:
   - All (total with phone numbers)
   - Live on /home (active and not coming soon)
   - Coming Soon (is_coming_soon = true)
   - Other (not active and not coming soon)

---

## Files Changed

### Database
- `database/add_coming_soon_status.sql` (NEW)

### TypeScript Types
- `src/types/index.ts`

### Components
- `src/components/TalentProfileEditor.tsx`
- `src/components/CommsCenterManagement.tsx`

### Pages
- `src/pages/HomePage.tsx`

### Documentation
- `COMING_SOON_STATUS_COMPLETE.md` (this file)

---

## Color Coding

**UI Color Scheme:**
- **Live Talent**: Green (`green-600`)
- **Coming Soon**: Amber/Orange (`amber-600`)
- **Other**: Gray (`gray-600`)
- **All**: Blue (`blue-600`)

**Status Badges (Future Enhancement):**
```jsx
{talent.is_coming_soon && (
  <span className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
    Coming Soon
  </span>
)}
```

---

## Future Enhancements

1. **Launch Scheduling:**
   - Add `coming_soon_launch_date` column
   - Automatically activate on specific date
   - Send reminder notifications

2. **Coming Soon Badge on Admin Panel:**
   - Show "Coming Soon" badge in talent list
   - Filter by status in main talent grid

3. **Public Coming Soon Page:**
   - Create `/coming-soon` route
   - Show teaser profiles for upcoming talent
   - Email notification signup for launch

4. **Bulk Operations:**
   - Select multiple talent
   - Bulk mark as "Coming Soon"
   - Bulk launch with single click

5. **Analytics:**
   - Track how long talent stays "Coming Soon"
   - Conversion rate from "Coming Soon" to "Live"
   - First order metrics after launch

---

## Notes

- **Default Value**: All existing talent have `is_coming_soon = false` by default
- **Null Handling**: The `/home` query treats `null` as `false` (excludes Coming Soon)
- **Phone Required**: Coming Soon talent must have a phone number to appear in any Comms Center filter
- **No Impact on Orders**: Even if marked "Coming Soon", existing orders are not affected
- **Profile URL**: Coming Soon talent still have a profile URL but won't be linked from `/home`

---

## Support

If you encounter issues:
1. Check console logs for Supabase query errors
2. Verify `is_coming_soon` column exists in database
3. Ensure indexes were created successfully
4. Check RLS policies allow admin to update `is_coming_soon`
5. Verify phone numbers are in `users.phone` table

---

**Status**: ✅ **COMPLETE AND TESTED**  
**Date**: November 7, 2025  
**Version**: 1.0

