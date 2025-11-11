# 🚨 URGENT: Fix Talent Onboarding NOW

## Issue
Talent registration is failing at MFA step with error:
```
column "order_type" does not exist
```

## Root Cause
The demo order trigger tries to insert orders with `order_type = 'demo'`, but the `orders` table doesn't have this column yet.

## Fix Steps (Run in this exact order)

### Step 1: Add order_type column
**Run this in Supabase SQL Editor:**
```sql
-- File: database/add_order_type_column.sql
```
Copy and paste the entire contents of `database/add_order_type_column.sql`

### Step 2: Fix the demo order trigger
**Run this in Supabase SQL Editor:**
```sql
-- File: database/fix_demo_order_trigger.sql
```
Copy and paste the entire contents of `database/fix_demo_order_trigger.sql`

## What These Do

1. **add_order_type_column.sql**:
   - Adds `order_type` column to `orders` table
   - Sets default to 'standard'
   - Adds constraint: only 'standard', 'demo', or 'corporate' allowed
   - Updates existing orders to 'standard'
   - Adds index for performance

2. **fix_demo_order_trigger.sql**:
   - Fixes the `ON CONFLICT (email)` error
   - Creates demo orders for newly onboarded talent
   - Excludes specific talent (Nick Di Palo, Shawn Farash, Gerald Morgan)

## Verification

After running both SQL files, try registering a new talent. You should:
1. ✅ Complete MFA step without errors
2. ✅ Get redirected to `/welcome`
3. ✅ See a demo order notification
4. ✅ See the demo order in pending orders

## Time to Fix
⏱️ **2 minutes** - Just copy/paste two SQL files!

