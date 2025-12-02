# Fix for Ben Moat's Order Issue

## Root Cause Identified ✅

The error **"Edge Function returned a non-2xx status code"** is coming from the `fortis-intention` Edge Function, which is called BEFORE the payment form even loads.

Location: `src/components/FortisPaymentForm.tsx` line 71
```typescript
const intention = await createFortisIntention(cents); // ← Failing here
```

This means Ben never even got to the payment form - it failed during initialization.

## Most Likely Causes

### 1. **Missing Fortis Environment Variables in Production** ⚠️
The Edge Function requires these env vars:
- `FORTIS_DEVELOPER_ID`
- `FORTIS_USER_ID`
- `FORTIS_USER_API_KEY`  
- `FORTIS_LOCATION_ID`

**Check**: Verify these are set in your Supabase production environment.

### 2. **Fortis API Failure**
The function calls Fortis API at line 81:
```typescript
const body = await fortisFetch('/elements/transaction/intention', {...});
```

If Fortis API is down or returning errors, this will fail.

### 3. **Rate Limiting**
The function has rate limiting enabled (line 112). If Ben tried multiple times, he might have hit the limit.

### 4. **Invalid Amount**
If the amount is `<= 0` or not a valid number, it will fail (line 72).

## Immediate Actions

### 1. Check Supabase Edge Function Environment Variables

```bash
# Via Supabase Dashboard
# Go to: Project Settings > Edge Functions > Secrets
# Verify these exist:
FORTIS_DEVELOPER_ID
FORTIS_USER_ID  
FORTIS_USER_API_KEY
FORTIS_LOCATION_ID
```

### 2. Check Edge Function Logs

```bash
supabase functions logs fortis-intention --limit 100
```

Look for errors around the time Ben tried to order (recently).

### 3. Run Diagnostic SQL

```bash
# Run the check_ben_moat_account.sql to see if Ben's account exists
```

### 4. Test the Payment Flow

Try ordering from Gerald Morgan with a test account to see if you can reproduce the error.

## The Missing Phone Number

The missing SMS number is **NOT** the cause of this error, because:
- The error happens BEFORE order creation
- Phone number is not required for the Fortis intention API
- Notifications are sent AFTER the order is created

However, you should still add a phone number requirement to avoid notification failures later.

## Quick Fix Options

### Option 1: Better Error Handling (Recommended)

Update `FortisPaymentForm.tsx` to show a more helpful error message:

```typescript
// Around line 157-159
catch (err) {
  console.error('Failed to initialize payment:', err);
  const errorMsg = err instanceof Error ? err.message : 'Failed to load payment form';
  setError(`Unable to initialize payment: ${errorMsg}. Please try again or contact support.`);
  onPaymentError(errorMsg);
}
```

### Option 2: Add Retry Logic

Add automatic retry for Edge Function failures:

```typescript
const createFortisIntentionWithRetry = async (cents: number, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await createFortisIntention(cents);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Failed after retries');
};
```

### Option 3: Fallback Payment Method

If Fortis continues to fail, implement a fallback or maintenance mode.

## For Ben Specifically

### If Payment Was Captured
1. Check Fortis dashboard for any charges from Ben's card
2. If payment went through, manually create the order using the script
3. Send Ben an apology email with a discount code for the inconvenience

### If Payment Was NOT Captured
1. Fix the Edge Function env vars
2. Email Ben that the issue is resolved and ask him to try again
3. Offer a discount code (`SORRY25` for 25% off) as an apology

## Testing Checklist

- [ ] Verify all 4 Fortis env vars are set in production
- [ ] Check Edge Function logs for specific errors
- [ ] Test order flow with a test account
- [ ] Confirm Gerald Morgan's profile is properly configured
- [ ] Test with and without phone number
- [ ] Check rate limiting isn't blocking legitimate users
- [ ] Verify Fortis API is operational

## Long-term Improvements

1. **Add Health Check Endpoint** for Fortis connection
2. **Better Error Messages** to users (don't show technical errors)
3. **Retry Logic** for transient failures
4. **Monitoring/Alerts** when Edge Functions fail repeatedly
5. **Fallback Payment** method if Fortis is down
6. **Phone Number Validation** during signup/checkout

