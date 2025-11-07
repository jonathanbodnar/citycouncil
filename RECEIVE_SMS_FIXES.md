# 🔧 receive-sms Function Fixes - Content Type + Phone Lookup

## Problems Fixed:

### **Problem 1: "Missing content type" Error** ❌
```
TypeError: Missing content type
    at packageData (ext:deno_fetch/22_body.js:405:13)
    at Request.formData (ext:deno_fetch/22_body.js:336:16)
```

**Cause:** Twilio might not be sending proper `Content-Type` header, causing `req.formData()` to fail.

**Fix:** Added fallback parsing logic:
- Check `Content-Type` header
- If `application/x-www-form-urlencoded`, use `formData()`
- Otherwise, parse as text and convert to FormData manually

---

### **Problem 2: "User not found for phone: +14692079703"** ❌

**Cause:** Phone number format mismatch in database!

**Database has mixed formats:**
- Some with `+1`: `+14692079703` ✅ (Your number)
- Some without: `6319438186` ✅ (Shawn's number)
- Some with `+`: `+12342342342`
- Some with `1` prefix: `14802455685`

**Old Code:** Only looked for 10-digit format (`4692079703`)  
**Your Phone:** Stored as `+14692079703`  
**Result:** No match! ❌

**Fix:** Try ALL possible phone formats:
1. `4692079703` (10 digits, no prefix)
2. `14692079703` (11 digits with 1)
3. `+4692079703` (+ prefix)
4. `+14692079703` (Full international format)
5. Original Twilio format (whatever they send)

Now uses `.in('phone', phoneVariations)` to match any format!

---

## Changes Made:

### **`supabase/functions/receive-sms/index.ts`**

#### **1. Better Content-Type Handling (Lines 18-37)**
```typescript
console.log('📞 Webhook received from:', req.headers.get('user-agent'));
console.log('📋 Content-Type:', req.headers.get('content-type'));

// Parse Twilio's form data
const contentType = req.headers.get('content-type') || '';
let formData: FormData;

if (contentType.includes('application/x-www-form-urlencoded')) {
  formData = await req.formData();
} else {
  // Fallback: try to parse as text and convert to FormData
  const text = await req.text();
  console.log('📝 Raw body:', text);
  formData = new FormData();
  const params = new URLSearchParams(text);
  params.forEach((value, key) => {
    formData.append(key, value);
  });
}
```

#### **2. Multiple Phone Format Lookup (Lines 50-83)**
```typescript
// Try multiple phone formats to find the user
const phoneVariations = [
  cleanPhone,                    // 4692079703
  `1${cleanPhone}`,              // 14692079703
  `+${cleanPhone}`,              // +4692079703
  `+1${cleanPhone}`,             // +14692079703
  from                           // Original format from Twilio
];

console.log('Trying phone variations:', phoneVariations);

// Find the talent by phone number (try all variations)
const { data: users, error: userError } = await supabase
  .from('users')
  .select('id, full_name, phone')
  .in('phone', phoneVariations);

const user = users && users.length > 0 ? users[0] : null;
```

---

## Deployment:

### **Deploy via Supabase Dashboard:**

1. **Go to Edge Functions:**
   ```
   https://supabase.com/dashboard/project/utafetamgwukkbrlezev/functions/receive-sms
   ```

2. **Click "Deploy New Version"** or **"Edit"**

3. **Copy-paste the entire updated `index.ts` file**

4. **Click "Deploy"**

5. **Wait for deployment** (takes ~30 seconds)

6. **Test immediately!**

---

## Testing:

### **Test 1: Send SMS Reply**

1. Send SMS from Comms Center to your phone: `(469) 207-9703`
2. Reply with: `"Test from my phone"`
3. Check logs: https://supabase.com/dashboard/project/utafetamgwukkbrlezev/logs/edge-functions
4. **Expected:**
   ```
   📞 Webhook received from: TwilioProxy/...
   📋 Content-Type: application/x-www-form-urlencoded
   📩 Incoming SMS: { from: '+14692079703', body: 'Test from my phone', messageSid: 'SM...' }
   Phone lookup: { from: '+14692079703', cleanPhone: '4692079703' }
   Trying phone variations: ['4692079703', '14692079703', '+4692079703', '+14692079703', '+14692079703']
   User lookup result: { user: { id: '0ee53913...', full_name: 'Joanthan', phone: '+14692079703' }, error: null }
   ✅ Message saved to database
   ```
5. **Refresh Comms Center** → Your reply appears! ✅

### **Test 2: Different Phone Formats**

Try with Shawn's number (stored as `6319438186` without +):
1. Send SMS from Comms Center to Shawn: `(631) 943-8186`
2. Reply from Shawn's phone
3. Should also work because we try all formats!

---

## Why Both Fixes Were Needed:

### **Content-Type Issue:**
- Twilio might send requests without proper `Content-Type` header
- Or with a slightly different format
- Fallback parsing ensures we always get the form data

### **Phone Format Issue:**
- Database has inconsistent phone storage
- Some numbers added via admin (with +1)
- Some via user profile (without +1)
- Function now handles ALL formats

---

## Future Improvement (Optional):

**Standardize Phone Storage:**

Run this SQL to normalize all phone numbers to 10-digit format:

```sql
-- Normalize all phone numbers to 10 digits (no + or 1 prefix)
UPDATE users 
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')  -- Remove non-digits
WHERE phone IS NOT NULL;

-- If phone starts with 1 and is 11 digits, remove the 1
UPDATE users 
SET phone = SUBSTRING(phone FROM 2)
WHERE phone IS NOT NULL 
  AND LENGTH(phone) = 11 
  AND phone LIKE '1%';
```

Then you can simplify the function to only look for 10-digit format.

---

## Status: ✅ **READY TO DEPLOY**

Once deployed:
- ✅ Content-Type errors gone
- ✅ Phone lookup works for all formats
- ✅ Your replies will appear in Comms Center
- ✅ Two-way SMS fully functional

---

## Quick Deploy Checklist:

- [ ] Go to Supabase Dashboard → Functions → receive-sms
- [ ] Deploy new version with updated code
- [ ] Wait for deployment to complete
- [ ] Test with SMS reply from your phone
- [ ] Check logs for successful user lookup
- [ ] Refresh Comms Center
- [ ] See your reply appear! 🎉

