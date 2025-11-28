# Mark Walker Order Failure Analysis

## Issue Summary
- **Customer**: Mark Walker (trainleader21@gmail.com)
- **Device**: Samsung S25+ on Chrome
- **Talent**: Gerald Morgan
- **Result**: Payment charged, but order NOT created in database

## Payment Flow (Based on Code)
1. ✅ User fills out order form
2. ✅ Fortis payment form loads
3. ✅ Payment processed by Fortis (card charged)
4. ✅ `handlePaymentSuccess()` called with payment result
5. ❌ **Order INSERT fails** (line 308-338 in OrderPage.tsx)
6. ⚠️ Generic error shown: "Failed to process order. Please contact support."
7. ❌ User's money is taken but NO order created

## Potential Failure Points

### 1. **RLS (Row Level Security) Policy Violation**
- The user might not have permission to INSERT into orders table
- Check: `diagnose_order_insert_failure.sql` section 3-4

### 2. **Missing Required Fields**
Possible NULL values that violate NOT NULL constraints:
- `user.id` - should exist
- `talent.id` - should exist  
- `request_details` - required
- `fulfillment_deadline` - required
- `status` - required
- Check: `diagnose_order_insert_failure.sql` section 6

### 3. **Foreign Key Constraint Violation**
- `user_id` FK to users table
- `talent_id` FK to talent_profiles table
- If either doesn't exist or is inactive, insert fails
- Check: `diagnose_order_insert_failure.sql` section 5

### 4. **Data Type Mismatch**
- `amount` field expects INTEGER but receives wrong type
- Check: `diagnose_order_insert_failure.sql` section 6

### 5. **Trigger Failure**
- A BEFORE INSERT trigger might be rejecting the insert
- Example: `create_payout_on_order_completion` trigger
- Check: `diagnose_order_insert_failure.sql` section 8

### 6. **Browser/Device Specific Issues**
- Samsung browser might have different timeout behavior
- Network interruption during INSERT
- Database connection timeout (takes too long)

### 7. **Session/Auth Issue**
- User's session might have expired during checkout
- RLS checks use current user session - if expired, insert fails
- Supabase client might not have valid JWT token

## Most Likely Causes (Ranked)

### 🔴 **#1: RLS Policy Blocking Insert**
**Probability: HIGH**

Samsung S25+ / Chrome might handle sessions differently. If the user's auth session expired or wasn't properly passed to the Supabase client during the INSERT, RLS would block it.

**Test**: Run `test_order_insert_simulation.sql` to see if insert works with Mark's user_id

### 🟠 **#2: Database Timeout**
**Probability: MEDIUM**

Mobile network (especially on Samsung device) might be slower. If the INSERT takes >30s, the request might timeout while Fortis payment already succeeded.

**Evidence**: No error shown to user means catch block executed but didn't specify exact error

### 🟡 **#3: Trigger Failure**
**Probability: MEDIUM**

The `create_payout_on_order_completion` trigger or other AFTER INSERT triggers might have failed, rolling back the entire transaction.

**Test**: Check trigger functions for SECURITY DEFINER and error handling

### 🟢 **#4: Foreign Key Violation**
**Probability: LOW**

User and talent both exist (confirmed by screenshots), so FKs should be valid.

## Diagnostic Scripts to Run

Run these in order:

```sql
-- 1. Check all potential issues
database/diagnose_order_insert_failure.sql

-- 2. Simulate the exact insert Mark attempted
database/test_order_insert_simulation.sql

-- 3. Verify no orders exist for Mark
database/search_mark_walker_all_orders.sql
```

## Frontend Logging

The code has extensive logging. Check browser console for:
- `🔄 Inserting order…` - Shows what data was sent
- `✅ Order insert result:` - Shows success/failure and error details
- Any error messages with `orderError` object

**Action**: Ask Mark to try again with browser console open (F12) and send screenshot of errors

## Recommended Fixes

### Immediate Fix (for Mark)
1. Get Fortis transaction ID from dashboard
2. Manually create order in database with correct data
3. Trigger notifications to Gerald Morgan
4. Send confirmation email to Mark

### Long-term Fixes
1. **Better Error Handling**: Show specific error message to user
2. **Idempotency**: Check if order with same transaction_id exists before inserting
3. **Retry Logic**: Auto-retry failed inserts with exponential backoff
4. **Payment Hold**: Use Fortis "authorize" instead of "charge", only capture after successful DB insert
5. **Dead Letter Queue**: Log failed order attempts to separate table for manual review
6. **Health Check**: Verify DB connection before processing payment

## Next Steps

1. Run diagnostic SQL scripts
2. Check Fortis dashboard for Mark's transaction details
3. Review browser console logs (if available)
4. Check Supabase logs for INSERT errors around the time of order
5. Manually create order for Mark with proper transaction linkage

