# Backfill Short Links for Existing Orders

## Overview
This script creates short links for all existing orders that don't have them yet. This allows admin to copy shorter, more manageable fulfillment URLs.

## What It Does

1. **Finds Orders Without Short Links**
   - Queries all orders with `fulfillment_token`
   - Excludes demo orders
   - Filters out orders that already have short links

2. **Creates Magic Auth Tokens (if needed)**
   - Checks if a valid magic token exists for the order
   - Creates a new one if missing (90-day expiry)

3. **Generates Short Links**
   - Creates a unique 6-character short code
   - Builds long URL: `https://shoutout.us/fulfill/{token}?auth={magic_token}`
   - Stores in `short_links` table with 90-day expiry

4. **Progress Tracking**
   - Shows progress every 10 orders
   - Displays final count at the end

## Prerequisites

✅ `short_links` table exists
✅ `magic_auth_tokens` table exists
✅ `generate_unique_short_code()` function exists
✅ `generate_unique_magic_token()` function exists

## How to Run

### Option 1: Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Open `backfill_short_links_for_orders.sql`
3. Review the `v_base_url` variable (line 9) - change if not using `shoutout.us`
4. Click **Run**
5. Check the output for confirmation

### Option 2: Command Line (psql)

```bash
psql -h <your-supabase-host> \
     -U postgres \
     -d postgres \
     -f database/backfill_short_links_for_orders.sql
```

## Expected Output

```
NOTICE: 🔗 Starting short link backfill for existing orders...
NOTICE:   ✅ Created magic token for order abc-123
NOTICE:   ✅ Created magic token for order def-456
NOTICE:   📊 Progress: 10 short links created...
NOTICE:   📊 Progress: 20 short links created...
NOTICE: 
NOTICE: ✅ Short link backfill complete!
NOTICE: 📊 Created 25 short links for existing orders
NOTICE: 

┌────────────────────────────┬───────┐
│          metric            │ count │
├────────────────────────────┼───────┤
│ Total Orders               │    25 │
│ Orders with Short Links    │    25 │
│ Orders without Short Links │     0 │
└────────────────────────────┴───────┘
```

## Verification

After running, the script automatically shows a summary table with:
- **Total Orders**: All orders with fulfillment tokens (excluding demos)
- **Orders with Short Links**: Orders that now have short links
- **Orders without Short Links**: Should be 0 after backfill

## Testing

1. **Check Short Links Created:**
```sql
SELECT 
  sl.short_code,
  sl.order_id,
  o.fulfillment_token,
  sl.created_at
FROM short_links sl
JOIN orders o ON sl.order_id = o.id
ORDER BY sl.created_at DESC
LIMIT 10;
```

2. **Test a Short Link:**
```sql
SELECT short_code, long_url
FROM short_links
LIMIT 1;
```

Copy the `short_code` and test: `https://shoutout.us/s/{short_code}`

3. **Verify Admin Dashboard:**
   - Go to Admin Dashboard → Orders tab
   - Click "Copy Link" on any order
   - Should now copy short link format: `shoutout.us/s/ABC123`

## Re-running the Script

✅ **Safe to re-run** - The script only creates short links for orders that don't have them yet. It will skip orders that already have short links.

## Rollback (if needed)

To remove all backfilled short links:

```sql
-- DELETE WITH CAUTION!
DELETE FROM short_links
WHERE order_id IS NOT NULL;
```

## Notes

- **Short links expire after 90 days** (matching magic token expiry)
- **Magic tokens are one-time use** for security
- **Demo orders are excluded** from short link generation
- **Short codes are 6 characters** (e.g., `A1b2C3`)
- **Base URL** can be changed in the script (line 9)

## Admin Dashboard Integration

The admin dashboard (`OrdersManagement.tsx`) already checks for short links:
1. First tries to fetch short link from `short_links` table
2. If found, uses short URL: `shoutout.us/s/{code}`
3. Otherwise, falls back to full URL: `shoutout.us/fulfill/{token}`

After running this backfill, all "Copy Link" buttons will use short links! 🎉

## Troubleshooting

### Error: "function generate_unique_short_code does not exist"
Run the `add_link_shortener.sql` migration first.

### Error: "function generate_unique_magic_token does not exist"
Run the `add_fulfillment_magic_tokens.sql` migration first.

### Error: "table short_links does not exist"
Run both migrations above in order.

### No short links created (count = 0)
This is normal if:
- All orders are demo orders
- All orders already have short links
- No orders have fulfillment tokens

Check with:
```sql
SELECT COUNT(*) FROM orders 
WHERE fulfillment_token IS NOT NULL 
AND order_type IS DISTINCT FROM 'demo';
```

## Post-Deployment

After running this backfill, new orders will automatically get short links via the trigger created in `add_link_shortener.sql`:
- `on_magic_token_insert_create_short_link` trigger
- Runs when a magic token is created for an order
- Automatically creates corresponding short link

This backfill is a **one-time operation** for existing orders! 🚀

