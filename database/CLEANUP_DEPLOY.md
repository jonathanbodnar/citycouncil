# Database Cleanup & Demo Order Exclusion

## Overview
This deployment performs two critical tasks:
1. Delete all orders for `jonathanbodnar` talent profile
2. Create views/functions to exclude demo orders from all statistics

## Prerequisites
- Access to Supabase SQL Editor
- Backup recommended (optional, but safe)

---

## Step 1: Delete jonathanbodnar Orders

### What This Does:
- Finds all orders for the `jonathanbodnar` talent profile
- Deletes related records: notifications, reviews, short links, auth tokens
- Finally deletes the orders themselves
- Shows verification at the end

### Run This Script:
📁 `database/delete_jonathanbodnar_orders.sql`

### Steps:
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create **New Query**
3. Copy/paste contents of `delete_jonathanbodnar_orders.sql`
4. **Read the output** - it will show:
   - Current order count
   - List of orders to be deleted
   - Deletion progress
   - Final verification (should show 0 orders)
5. Click **Run**

### Expected Output:
```
✅ All orders for jonathanbodnar have been deleted
remaining_orders: 0
```

---

## Step 2: Exclude Demo Orders from Stats

### What This Does:
Creates database views and functions that automatically exclude demo orders from:
- Total earnings calculations
- Order counts
- Platform statistics
- Talent rankings
- Any future stats queries

### Run This Script:
📁 `database/exclude_demo_orders_from_stats.sql`

### Steps:
1. In **SQL Editor**, create another **New Query**
2. Copy/paste contents of `exclude_demo_orders_from_stats.sql`
3. Click **Run**

### What Gets Created:

#### 1. **`real_orders` View**
- Filters out demo orders
- Use this instead of `orders` table for stats

#### 2. **`talent_stats` View**
- Complete talent statistics (no demos)
- Includes: completed orders, earnings, ratings, reviews

#### 3. **`get_talent_earnings(talent_id)` Function**
- Get earnings for a specific talent
- Excludes demo orders automatically

#### 4. **`get_platform_stats()` Function**
- Overall platform statistics
- Total talents, orders, revenue (no demos)

#### 5. **`top_earning_talents` View**
- Top 10 highest earning talents
- Excludes demo orders

### Expected Output:
```
✅ View created: real_orders
✅ View created: talent_stats
✅ Function created: get_talent_earnings
✅ Function created: get_platform_stats
✅ View created: top_earning_talents

Orders including demos: 156
Orders excluding demos: 142
Demo orders only: 14
```

---

## Step 3: Update Frontend to Use New Views (Optional)

If you want to use these views in the frontend, update queries like this:

### Before:
```typescript
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('talent_id', talentId);
```

### After (Excluding Demos):
```typescript
const { data } = await supabase
  .from('real_orders')  // ← Use the view
  .select('*')
  .eq('talent_id', talentId);
```

### Or Use the Function:
```typescript
const { data } = await supabase
  .rpc('get_talent_earnings', { p_talent_id: talentId });

// Returns: { total_earnings, completed_orders, pending_amount }
```

---

## Verification

### Check jonathanbodnar Orders Deleted:
```sql
SELECT COUNT(*) as count
FROM orders
WHERE talent_id IN (
  SELECT id FROM talent_profiles WHERE username = 'jonathanbodnar'
);
-- Should return: 0
```

### Check Demo Orders Excluded from Stats:
```sql
-- All orders
SELECT COUNT(*) FROM orders;

-- Orders without demos
SELECT COUNT(*) FROM real_orders;

-- Difference should equal demo order count
SELECT COUNT(*) FROM orders WHERE order_type = 'demo';
```

### View Talent Stats (No Demos):
```sql
SELECT * FROM talent_stats
ORDER BY total_earnings_cents DESC
LIMIT 10;
```

---

## Rollback (If Needed)

If you need to reverse the demo order exclusion:

```sql
-- Drop views
DROP VIEW IF EXISTS real_orders CASCADE;
DROP VIEW IF EXISTS talent_stats CASCADE;
DROP VIEW IF EXISTS top_earning_talents CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_talent_earnings(UUID);
DROP FUNCTION IF EXISTS get_platform_stats();
```

**Note:** You cannot rollback deleted orders. Make sure you want to delete them before running Step 1.

---

## Summary

✅ **After This Deployment:**
- All `jonathanbodnar` orders deleted
- Demo orders excluded from all stats calculations
- Database views/functions ready for clean reporting
- No code changes required (but available if needed)

🎯 **Impact:**
- More accurate earnings reports
- Cleaner analytics
- Demo orders still exist (for testing) but don't pollute stats
- Easy to query with or without demos

---

## Questions?

**Q: Will this affect existing orders?**  
A: No. Only jonathanbodnar orders are deleted. Demo orders stay but are filtered out of stats.

**Q: Can I still see demo orders?**  
A: Yes! Query the `orders` table directly and filter `WHERE order_type = 'demo'`.

**Q: Do I need to update frontend code?**  
A: No, it's optional. The views are available if you want to use them.

**Q: What if I want to include demos in a specific query?**  
A: Just use the `orders` table instead of `real_orders` view.

