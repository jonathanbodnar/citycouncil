# Ben Moat Order Failure Diagnosis

## Error Reported
**User**: benmoat@hotmail.co.uk  
**Error**: "Edge Function returned a non-2xx status code"  
**Payment Methods Tested**: Debit card and Google Pay (both failed)  
**Target Talent**: Gerald Morgan

## Key Finding
User doesn't have an SMS/phone number registered.

## Possible Root Causes

### 1. **fortis-verify Edge Function Failure** (Most Likely)
The `fortis-verify` Edge Function may be failing to verify the Fortis transaction. This happens at line 279 in `OrderPage.tsx`:

```typescript
const verify = await verifyFortisTransaction(transactionId);
```

**Potential Issues:**
- Missing Fortis environment variables (`FORTIS_DEVELOPER_ID`, `FORTIS_USER_ID`, `FORTIS_USER_API_KEY`)
- Fortis API is down or returning errors
- Transaction ID format mismatch between Commerce.js and Fortis API
- Network timeout or rate limiting

**Impact**: This is wrapped in a try-catch with `logger.warn`, so it **shouldn't block** the order, but if there's an unhandled error path, it could.

### 2. **SMS Notification Failure** (Less Likely)
If SMS notifications are being sent and the user has no phone number, this could cause an error. However:
- Notifications are sent in a `Promise.all().catch()` which shouldn't block
- The code shows these are "fire and forget" 
- But if there's a bug in the notification service, it could throw before reaching the catch

### 3. **Missing Phone Number in Order Creation** (Unlikely)
The `orders` table doesn't require a phone number, and the insert at line 308-339 doesn't reference phone at all, so this shouldn't be the issue.

## Recommended Actions

### Immediate Fix
1. **Check Edge Function Logs**:
   ```bash
   # Check logs for fortis-verify function around the time of Ben's attempts
   supabase functions logs fortis-verify --limit 100
   ```

2. **Run Diagnostic SQL** to check Ben's account:
   ```sql
   -- See database/check_ben_moat_account.sql
   ```

3. **Test Order Creation Without Fortis Verification**:
   The verification is already wrapped in try-catch, but we should add more detailed logging to see where exactly it's failing.

### Short-term Fix
Make the `fortis-verify` call more robust with better error handling:

```typescript
// In OrderPage.tsx, around line 277-284
if (transactionId) {
  try {
    const verify = await verifyFortisTransaction(transactionId);
    logger.log('✅ Fortis verify status:', verify.statusCode);
  } catch (e) {
    logger.warn('⚠️ Fortis verification failed (non-blocking):', e);
    // Explicitly continue - verification failure shouldn't block order
  }
}
```

### Long-term Fix
1. **Make fortis-verify truly optional** - payment already succeeded via Commerce.js
2. **Add retry logic** for Edge Function calls
3. **Add phone number validation** during signup/order flow
4. **Improve error messages** - show user-friendly errors instead of technical Edge Function messages

## Testing Steps

1. Check if Ben Moat's account exists and has required fields
2. Check Edge Function logs for specific errors
3. Test order creation for Gerald Morgan with a test account (with and without phone)
4. Consider manually creating Ben's order if payment was actually captured

## Questions for User
1. Did Ben's payment actually go through? Check Fortis dashboard for charges
2. Are the Fortis Edge Function env vars properly set in production?
3. Have other users successfully ordered from Gerald Morgan recently?

