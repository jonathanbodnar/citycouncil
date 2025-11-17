# 🔥 Pricing Urgency System

## Overview
The pricing urgency system creates FOMO (fear of missing out) by showing users how many orders are left at the current price before it increases. This encourages immediate purchases and increases conversion rates.

---

## How It Works

### Monthly Pricing Tiers
Every month, each talent starts with a fresh counter. After every 10 orders, the price increases:

| Tier | Orders | Price Multiplier | Example (\$100 base) | Fire Icon Status |
|------|--------|------------------|---------------------|------------------|
| **Tier 1** | 0-9 | 1.00x (Base) | $100 | 🔥 Shows when 0-9 orders |
| **Tier 2** | 10-19 | 1.05x (+5%) | $105 | 🔥 Shows when 10-19 orders |
| **Tier 3** | 20-29 | 1.10x (+10%) | $110 | 🔥 Shows when 20-29 orders |
| **Tier 4** | 30+ | 1.00x (Reset) | $100 | 🔥 Cycle repeats |

### Monthly Reset
- **1st of each month**: Counter resets to 0
- Price goes back to base price
- Cycle starts fresh

---

## Database Structure

### New Columns (`talent_profiles`)
```sql
current_month_orders     INT      -- Order count this month (resets monthly)
last_order_reset_date    DATE     -- Last order or reset date
base_pricing            DECIMAL   -- Original price (never changes)
current_pricing_tier    INT       -- Current tier (1-3, cycles)
```

### View: `talent_pricing_urgency`
Exposes pricing data to frontend:
```sql
SELECT 
  id,
  base_pricing,
  current_pricing,
  current_month_orders,
  current_pricing_tier,
  orders_remaining_at_price,  -- Used in UI
  next_tier_price,
  tier_description
FROM talent_pricing_urgency;
```

### Trigger: `update_talent_pricing_on_order()`
Automatically fires when order status = 'completed':
1. Checks if new month (resets counter if needed)
2. Increments `current_month_orders`
3. Calculates new tier
4. Updates `pricing` to match tier multiplier
5. Updates `last_order_reset_date`

---

## Frontend Implementation

### UI Display
Fire icon appears below price on talent profile:

```
┌─────────────────────────┐
│       $105              │
│      Personal           │
│                         │
│  🔥 7 more orders       │
│     available at this   │
│     price               │
└─────────────────────────┘
```

### Features
- **Fire icon** (🔥) with pulsing animation
- **Dynamic text**: "X more orders available at this price"
- **Orange color** (#fb923c) for urgency
- **Only shows** when orders remaining ≤ 10
- **Updates in real-time** as orders are placed

### Code Location
- **Component**: `src/pages/TalentProfilePage.tsx`
- **State**: `ordersRemaining` (fetched from `talent_pricing_urgency` view)
- **Display**: Lines 521-529

---

## Example Scenarios

### Scenario 1: New Month
```
Date: December 1, 2025
Orders this month: 0
Current price: $100 (base)
Display: 🔥 "10 more orders available at this price"
```

### Scenario 2: Mid-Tier
```
Date: December 15, 2025
Orders this month: 7
Current price: $100 (base)
Display: 🔥 "3 more orders available at this price"
```

### Scenario 3: Tier Transition
```
Date: December 20, 2025
Orders this month: 10 (just hit tier 2)
Current price: $105 (+5%)
Display: 🔥 "10 more orders available at this price"
Next price: $110 after 10 more orders
```

### Scenario 4: High Volume
```
Date: December 28, 2025
Orders this month: 32 (tier 4 - cycled back)
Current price: $100 (base again)
Display: 🔥 "8 more orders available at this price"
```

---

## Migration Steps

### 1. Run Database Migration
```bash
# In Supabase SQL Editor or via CLI
psql -h <host> -U postgres -d postgres -f database/add_pricing_urgency_system.sql
```

### 2. Initialize Existing Talents
All existing talents will automatically have:
- `base_pricing` = current `pricing`
- `current_month_orders` = 0
- `current_pricing_tier` = 1
- `last_order_reset_date` = today

### 3. Deploy Frontend
```bash
git pull origin development
npm run build
# Deploy to production
```

---

## Testing

### Manual Testing
```sql
-- View current pricing status for all talents
SELECT * FROM talent_pricing_urgency;

-- Test tier calculation for various order counts
SELECT 
  monthly_orders,
  calculate_pricing_tier(monthly_orders) as tier,
  get_orders_remaining_at_price(monthly_orders) as remaining,
  get_price_multiplier(calculate_pricing_tier(monthly_orders)) as multiplier
FROM generate_series(0, 35) as monthly_orders;

-- Simulate completing an order (trigger will fire)
UPDATE orders 
SET status = 'completed' 
WHERE id = '<order_id>';

-- Check updated pricing
SELECT * FROM talent_pricing_urgency WHERE id = '<talent_id>';
```

### Testing Monthly Reset
```sql
-- Manually trigger monthly reset for a talent
UPDATE talent_profiles
SET 
  current_month_orders = 0,
  last_order_reset_date = CURRENT_DATE,
  current_pricing_tier = 1,
  pricing = base_pricing
WHERE id = '<talent_id>';
```

---

## Benefits

### For Business
- **Increased urgency** → Higher conversion rates
- **Dynamic pricing** → Automatic revenue optimization
- **Fair pricing** → Popular talents earn more
- **Monthly reset** → Fresh start each month

### For Users
- **Transparency** → Know exactly how many orders left
- **Incentive** → Buy now to save money
- **Fair** → Everyone sees the same pricing
- **Predictable** → Price changes are automatic, not arbitrary

### For Talents
- **Automatic** → No manual price adjustments needed
- **Reward popularity** → Busy talents earn premium
- **Fresh start** → Monthly reset prevents perpetual high prices
- **Transparent** → Talents can see their tier status

---

## Monitoring

### Key Metrics to Track
1. **Conversion rate** before/after urgency indicator
2. **Orders per tier** distribution
3. **Revenue per talent** month-over-month
4. **Time to purchase** (urgency effect)
5. **Tier transitions** (how often talents hit tier 2/3)

### Dashboard Queries
```sql
-- Orders per tier distribution
SELECT 
  current_pricing_tier as tier,
  COUNT(*) as talent_count,
  AVG(current_month_orders) as avg_orders
FROM talent_profiles
WHERE is_active = true
GROUP BY current_pricing_tier
ORDER BY tier;

-- Talents approaching next tier
SELECT 
  users.full_name,
  base_pricing,
  current_pricing,
  orders_remaining_at_price
FROM talent_pricing_urgency tpu
JOIN talent_profiles tp ON tpu.id = tp.id
JOIN users ON tp.user_id = users.id
WHERE orders_remaining_at_price <= 3
ORDER BY orders_remaining_at_price ASC;
```

---

## Future Enhancements

### Possible Improvements
1. **Email notifications** when talent hits new tier
2. **Admin dashboard** showing tier distribution
3. **Custom tier thresholds** per talent (VIP pricing)
4. **Seasonal multipliers** (holiday pricing)
5. **Flash sales** (temporary base price reduction)
6. **Tier badges** on talent cards (show tier status)

---

## Support

### Common Issues

**Q: Fire icon not showing?**
- Check if `ordersRemaining` is being fetched correctly
- Verify `talent_pricing_urgency` view has data
- Ensure talent has `base_pricing` set

**Q: Price not updating after order?**
- Verify order status is 'completed'
- Check trigger is enabled: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_pricing_on_order';`
- Look for errors in database logs

**Q: Monthly reset not happening?**
- Trigger only resets on new order completion
- Can manually reset via SQL query above
- Consider adding cron job for automatic monthly reset

---

## Configuration

### Adjusting Tier Thresholds
To change from 10 orders per tier to different amount:

```sql
-- Update get_orders_remaining_at_price function
CREATE OR REPLACE FUNCTION get_orders_remaining_at_price(monthly_orders INT)
RETURNS INT AS $$
BEGIN
  RETURN 15 - (monthly_orders % 15);  -- Changed from 10 to 15
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update calculate_pricing_tier function
CREATE OR REPLACE FUNCTION calculate_pricing_tier(monthly_orders INT)
RETURNS INT AS $$
BEGIN
  IF monthly_orders < 15 THEN RETURN 1;
  ELSIF monthly_orders < 30 THEN RETURN 2;
  ELSIF monthly_orders < 45 THEN RETURN 3;
  ELSE RETURN 1;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Adjusting Price Multipliers
```sql
-- Change from +5%/+10% to +10%/+20%
CREATE OR REPLACE FUNCTION get_price_multiplier(tier INT)
RETURNS DECIMAL(3,2) AS $$
BEGIN
  CASE tier
    WHEN 1 THEN RETURN 1.00;   -- Base
    WHEN 2 THEN RETURN 1.10;   -- +10% (was 1.05)
    WHEN 3 THEN RETURN 1.20;   -- +20% (was 1.10)
    ELSE RETURN 1.00;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

