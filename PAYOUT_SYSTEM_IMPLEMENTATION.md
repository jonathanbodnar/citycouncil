# Complete Payout System Implementation Guide

## Overview
The ShoutOut payout system automatically calculates, tracks, and batches talent earnings for weekly processing. It handles completed orders, refunds, and integrates with Moov for final payouts.

## Database Setup

### 1. Run the SQL Migration
Execute `database/create_payouts_system.sql` in your Supabase SQL Editor:

```bash
# This script creates:
# - payouts table (individual payout records)
# - payout_batches table (weekly groupings)
# - Automated triggers for order completion and refunds
# - RLS policies for security
# - Helper functions and views
```

**What it does:**
- ✅ Creates payout tables with proper relationships
- ✅ Adds `total_earnings` to talent_profiles
- ✅ Sets up triggers to auto-create payouts when orders complete
- ✅ Handles refunds automatically (removes from batch totals)
- ✅ Batches payouts by week (Monday-Sunday)

## How It Works

### 1. Order Completion → Payout Creation
When an order status changes to `completed`:

```sql
1. Get talent's admin_fee_percentage (default 25%)
2. Calculate:
   - admin_fee_amount = order_amount × (admin_fee_percentage / 100)
   - payout_amount = order_amount - admin_fee_amount
3. Create payout record with week dates
4. Update talent's total_earnings
5. Create or update weekly batch
```

**Example:**
- Order Amount: $100
- Admin Fee (25%): $25
- Talent Payout: $75

### 2. Weekly Batching
Payouts are automatically grouped by week (Monday-Sunday):

```
Week 1: Jan 1-7, 2024
├─ Order #1: $75
├─ Order #2: $50
└─ Order #3: $100
Total Batch: $225
```

### 3. Refund Handling
When an order is refunded:

```sql
1. Mark payout as refunded
2. Subtract from talent's total_earnings
3. Update weekly batch:
   - total_refunded_amount += payout_amount
   - net_payout_amount = total_payout - total_refunded
```

**Example:**
- Original Batch: $225
- Refund Order #2: -$50
- New Net Total: $175

## Frontend Components

### Talent Dashboard (`/dashboard?tab=payouts`)
**Component:** `TalentPayoutsDashboard`

**Features:**
- 📊 Total earnings summary card
- 📅 Weekly batch view with expand/collapse
- 💰 Individual payout details
- ❌ Refunded payouts shown with strikethrough
- 🔵 Status indicators (pending, batched, processing, paid, failed)

**What Talent Sees:**
```
Your Earnings: $1,225.00

Week Jan 15-21, 2024
├─ 5 orders | $300.00 (2 refunded)
└─ Click to expand for details

All Payouts Table:
- Date | Order | Week | Order Amount | Admin Fee | Your Payout | Status
```

### Admin Dashboard (`/admin?tab=payouts`)
**Component:** `AdminPayoutsManagement`

**Features:**
- 🎯 Filter by talent
- 📈 Stats dashboard (total, pending, paid)
- 📅 Weekly batch management
- 🔍 Click batch to see itemized payouts
- 💳 Ready for Moov integration

**What Admin Sees:**
```
Total Payouts: $15,340.00
Pending: $2,450.00
Paid Out: $12,890.00

Weekly Payout Batches:
├─ @jonathanbodnar - Jan 15-21 | 8 orders | $450.00 [pending]
└─ Click to see itemized list
```

## Payout Status Flow

```
pending → batched → processing → paid
                 ↘ failed
```

### Status Meanings:
- **pending**: Payout created, waiting for weekly batch
- **batched**: Grouped with others for processing
- **processing**: Being sent to Moov
- **paid**: Successfully paid out
- **failed**: Payment failed, needs retry

## Database Schema

### `payouts` Table
```sql
- id: UUID (primary key)
- talent_id: UUID (foreign key to talent_profiles)
- order_id: UUID (foreign key to orders)
- order_amount: DECIMAL (original order amount)
- admin_fee_percentage: DECIMAL (% at time of order)
- admin_fee_amount: DECIMAL (calculated fee)
- payout_amount: DECIMAL (talent receives this)
- status: VARCHAR (pending, batched, processing, paid, failed)
- week_start_date: DATE (Monday of the week)
- week_end_date: DATE (Sunday of the week)
- batch_id: UUID (links to payout_batches)
- is_refunded: BOOLEAN
- refunded_at: TIMESTAMP
- refund_reason: TEXT
- created_at, updated_at: TIMESTAMP
```

### `payout_batches` Table
```sql
- id: UUID (primary key)
- talent_id: UUID (foreign key to talent_profiles)
- week_start_date: DATE
- week_end_date: DATE
- total_orders: INTEGER
- total_payout_amount: DECIMAL (sum before refunds)
- total_refunded_amount: DECIMAL (sum of refunds)
- net_payout_amount: DECIMAL (total - refunded)
- status: VARCHAR (pending, processing, paid, failed)
- moov_transfer_id: VARCHAR (for Moov integration)
- moov_transfer_status: VARCHAR
- processed_at: TIMESTAMP
- created_at, updated_at: TIMESTAMP
```

## Integration Points

### Current: Automatic
- ✅ Order completion triggers payout creation
- ✅ Refunds update payout records
- ✅ Weekly batching is automatic
- ✅ Talent earnings tracked in real-time

### Future: Moov Integration
When ready to process payouts:

```typescript
// Pseudo-code for Moov integration
async function processBatch(batchId: string) {
  const batch = await getBatch(batchId);
  const talent = await getTalent(batch.talent_id);
  
  // Call Moov API to transfer funds
  const transfer = await moov.createTransfer({
    amount: batch.net_payout_amount,
    destination: talent.moov_account_id,
    description: `ShoutOut payout for week ${batch.week_start_date}`
  });
  
  // Update batch with Moov details
  await updateBatch(batchId, {
    status: 'processing',
    moov_transfer_id: transfer.id,
    moov_transfer_status: transfer.status,
    processed_at: new Date()
  });
}
```

## Key Features

### ✅ Automated Calculations
- Admin fees calculated at time of order
- Payout amounts calculated automatically
- Weekly totals updated in real-time

### ✅ Refund Handling
- Refunds tracked separately
- Batch totals adjusted automatically
- Talent earnings decremented

### ✅ Security
- RLS policies enforce data access
- Talent can only see their own payouts
- Admin has full access for management

### ✅ Performance
- Indexed on talent_id, status, week_start_date
- Efficient queries for dashboard views
- Materialized view for summaries

## Testing

### 1. Create a Test Order
```sql
-- Complete an order to trigger payout creation
UPDATE orders 
SET status = 'completed' 
WHERE id = '<order-id>';
```

### 2. Verify Payout Created
```sql
SELECT * FROM payouts 
WHERE order_id = '<order-id>';
```

### 3. Check Weekly Batch
```sql
SELECT * FROM payout_batches 
WHERE talent_id = '<talent-id>' 
ORDER BY week_start_date DESC 
LIMIT 1;
```

### 4. Test Refund
```sql
-- Refund an order to test adjustment
UPDATE orders 
SET status = 'refunded' 
WHERE id = '<order-id>';

-- Check batch was updated
SELECT 
  total_payout_amount,
  total_refunded_amount,
  net_payout_amount
FROM payout_batches
WHERE talent_id = '<talent-id>' 
  AND week_start_date = '<week-start>';
```

## Helpful Queries

### See All Pending Payouts
```sql
SELECT 
  p.*,
  tp.username,
  o.amount as order_amount
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'pending'
ORDER BY p.created_at DESC;
```

### Weekly Batch Summary
```sql
SELECT 
  tp.username,
  pb.week_start_date,
  pb.week_end_date,
  pb.total_orders,
  pb.net_payout_amount,
  pb.status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
WHERE pb.status = 'pending'
ORDER BY pb.week_start_date DESC;
```

### Talent Earnings Summary
```sql
SELECT 
  tp.username,
  tp.total_earnings,
  COUNT(p.id) as total_payouts,
  SUM(CASE WHEN p.is_refunded THEN 0 ELSE p.payout_amount END) as net_earnings,
  SUM(CASE WHEN p.is_refunded THEN p.payout_amount ELSE 0 END) as refunded_amount
FROM talent_profiles tp
LEFT JOIN payouts p ON p.talent_id = tp.id
GROUP BY tp.id, tp.username, tp.total_earnings
ORDER BY tp.total_earnings DESC;
```

## Next Steps

### Immediate:
1. ✅ Run SQL migration (`create_payouts_system.sql`)
2. ✅ Deploy frontend changes
3. ✅ Test with existing completed orders

### Future Enhancements:
1. 🔄 Integrate with Moov for automated transfers
2. 📧 Email notifications for payouts
3. 📊 Payout analytics and reporting
4. 💳 Payout history export (CSV)
5. 🔔 Weekly payout summary emails to talent

## Support

For issues or questions:
- Check Supabase logs for trigger errors
- Verify RLS policies are enabled
- Ensure talent has valid admin_fee_percentage
- Contact support with batch_id for specific issues

