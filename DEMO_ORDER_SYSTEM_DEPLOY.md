## Demo Order System - Deployment Guide

### Overview
Automatically creates a demo order for each talent when they complete onboarding, so they can practice fulfilling an order before going live.

### Features
- ✅ Auto-creates demo order when talent completes onboarding
- ✅ Random realistic customer names (John Smith, Sarah Johnson, etc.)
- ✅ Random realistic requests ("Wish my mother Linda a happy 90th birthday", etc.)
- ✅ Sends notification: "Hey [FirstName], here's your demo order, please fulfill it to activate live orders!"
- ✅ Notification type shows as "Demo Order" in admin dashboard
- ✅ Excludes: Nick Di Palo, Shawn Farash, Gerald Morgan
- ✅ Only creates one demo order per talent (tracked by `demo_order_created` flag)

### Deployment Steps

#### 1. Run the SQL Migration
Go to **Supabase SQL Editor** and run:
```sql
database/create_demo_orders_system.sql
```

This will:
- Add `demo_order_created` column to `talent_profiles`
- Create helper functions for random names/requests
- Create `create_demo_order_for_talent()` function
- Create trigger to auto-create demo orders on onboarding completion

#### 2. Backfill Existing Talents (Optional)
If you want to create demo orders for talents who already finished onboarding:

```sql
DO $$
DECLARE
  talent_record RECORD;
BEGIN
  FOR talent_record IN 
    SELECT id, full_name 
    FROM talent_profiles 
    WHERE onboarding_completed = TRUE 
    AND demo_order_created = FALSE
    AND full_name NOT IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
  LOOP
    PERFORM create_demo_order_for_talent(talent_record.id);
    RAISE NOTICE 'Created demo order for: %', talent_record.full_name;
  END LOOP;
END $$;
```

#### 3. Verify
After deployment, check:
1. New talent completes onboarding → demo order created automatically
2. Notification sent to talent with link to order
3. Order shows in talent dashboard as "pending"
4. Admin can see notification marked as "Demo Order"

### How It Works

1. **Trigger fires** when `onboarding_completed` changes to `TRUE`
2. **Checks conditions**:
   - Talent not in exclusion list
   - Demo order not already created
3. **Creates demo user** with email: `demo-order-{username}@shoutout.internal`
4. **Generates random**:
   - Customer name (e.g., "Sarah Johnson")
   - Order request (e.g., "Wish my mother, Linda a happy 90th birthday!")
5. **Creates order** with talent's pricing
6. **Sends notification** to talent
7. **Marks** `demo_order_created = TRUE`

### Demo Order Details
- **Amount**: Talent's regular pricing
- **Status**: `pending`
- **Transaction ID**: `DEMO-{random}`
- **Customer Email**: `demo-order-{username}@shoutout.internal`
- **Fulfillment Time**: 48 hours
- **Corporate**: `false`

### Example Requests
- "Wish my mother, Linda a happy 90th birthday!"
- "What's the best life advice for a 22 year old who doesn't want to go to college?"
- "Congratulate my son, Michael on his graduation!"
- "Give my wife, Sarah some motivation for her new business venture"
- And 8 more variations...

### Example Customer Names
- John Smith, Sarah Johnson, Michael Williams
- Jennifer Brown, David Jones, Emily Garcia
- Robert Miller, Amanda Davis, James Rodriguez
- Lisa Martinez

### Troubleshooting

**Demo order not created?**
- Check if `demo_order_created` is already `TRUE`
- Verify talent name not in exclusion list
- Check trigger is enabled: `SELECT * FROM pg_trigger WHERE tgname = 'auto_create_demo_order';`

**Want to manually create for a specific talent?**
```sql
SELECT create_demo_order_for_talent('talent_profile_id_here');
```

**Want to reset and recreate?**
```sql
UPDATE talent_profiles SET demo_order_created = FALSE WHERE id = 'talent_id';
-- Then complete onboarding again or run create_demo_order_for_talent()
```

### Notes
- Demo users have internal email addresses (won't conflict with real users)
- Each talent gets exactly ONE demo order (prevents duplicates)
- Order appears in talent dashboard like a real order
- Talent must fulfill it (upload video) to practice the workflow
- After fulfilling demo order, they're ready for live orders!

