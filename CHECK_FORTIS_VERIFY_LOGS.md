# Check fortis-verify Edge Function Logs

## What to Check:

The error "Edge Function returned a non-2xx status code" is likely coming from **`fortis-verify`**, not `fortis-intention`.

---

## Steps:

### 1. Check fortis-verify Logs

**Go to:** Supabase Dashboard → Edge Functions → **`fortis-verify`** → Logs tab

**Look for:**
- Recent errors around the time you tried to order
- 502, 424, or 500 status codes
- Detailed error messages from Fortis API

---

### 2. Common fortis-verify Errors:

**Error:** `"Fortis credentials not configured"`
- **Cause:** Missing environment variables
- **Fix:** Add FORTIS_DEVELOPER_ID, FORTIS_USER_ID, FORTIS_USER_API_KEY to fortis-verify

**Error:** `"transaction_id is required"`
- **Cause:** Frontend not passing transaction ID
- **Fix:** Frontend issue, check OrderPage.tsx

**Error:** `404 Not Found` or `"Transaction not found"`
- **Cause:** Fortis transaction ID doesn't exist in Fortis
- **Fix:** Payment may have failed before verification

**Error:** `401 Unauthorized`
- **Cause:** Invalid Fortis API keys
- **Fix:** Update Fortis credentials in Supabase env vars

---

### 3. Check if fortis-verify Has Environment Variables

**Go to:** Supabase Dashboard → Edge Functions → `fortis-verify` → Settings → Environment Variables

**Verify these exist:**
- `FORTIS_DEVELOPER_ID`
- `FORTIS_USER_ID`
- `FORTIS_USER_API_KEY`

**NOTE:** Each Edge Function needs its own copy of env vars!

If `fortis-intention` has them but `fortis-verify` doesn't, that's the problem!

---

### 4. Compare Environment Variables

| Edge Function | Env Vars Needed | Status |
|---------------|----------------|--------|
| `fortis-intention` | ✅ Has them (no errors) | ✅ Working |
| `fortis-verify` | ❓ Check if missing | ❓ May be broken |

---

## Quick Fix:

If `fortis-verify` is missing env vars:

1. Go to `fortis-intention` → Settings → Environment Variables
2. **Copy** all 3 variables:
   - FORTIS_DEVELOPER_ID
   - FORTIS_USER_ID  
   - FORTIS_USER_API_KEY
3. Go to `fortis-verify` → Settings → Environment Variables
4. **Paste** the same 3 variables
5. Click **Save**
6. Test order again

---

## Why This Might Be The Issue:

The payment flow is:
1. ✅ `fortis-intention` creates payment intention (working - no errors in logs)
2. User enters card details
3. Fortis processes payment
4. ❌ `fortis-verify` tries to verify transaction (fails - missing credentials?)
5. ❌ Frontend shows "Edge Function returned non-2xx status code"

Even though payment succeeds in Fortis, if `fortis-verify` fails, the order doesn't get created in our database.

---

## What to Report:

1. **Check `fortis-verify` logs** - what errors do you see?
2. **Check `fortis-verify` env vars** - are they set?
3. **Share** any error messages from `fortis-verify` logs

---

## Hypothesis:

Since `fortis-intention` works (no errors), but orders still fail:
- ✅ Fortis credentials are valid
- ✅ Payment intention works
- ❌ `fortis-verify` may be missing credentials
- ❌ Or `fortis-verify` getting different error from Fortis

**Next:** Check `fortis-verify` specifically, not just `fortis-intention`!

