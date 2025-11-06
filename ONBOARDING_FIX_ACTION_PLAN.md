# 🚨 Complete Onboarding Fix - Action Plan

## Current Situation

**Problem:** Talent onboarding is completely broken. Multiple issues:

1. ❌ **RLS blocks UPSERT** - "Failed to create/update user record"
2. ❌ **Users created as 'user' instead of 'talent'**
3. ❌ **Existing broken accounts can't be fixed by re-registering**
4. ❌ **Can't delete and recreate - email already exists**

**Example:** `talent9@gmail.com` - Created during failed attempt, stuck as `user_type='user'`

---

## Complete Fix (3 Steps)

### **STEP 1: Fix RLS Policies (Deploy First)** 🔴

**Why:** Allows UPSERT to work for new registrations

**Action:** Run in **Supabase Dashboard → SQL Editor**

```sql
-- Copy from database/fix_users_rls_for_upsert.sql
-- OR use the quick version below:

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;

CREATE POLICY "Allow authenticated user creation" ON users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated self-update" ON users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated self-select" ON users
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT TO anon
WITH CHECK (user_type = 'talent');
```

**Verify:**
```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users';
```

Should show 4 policies: INSERT, UPDATE, SELECT, and anonymous INSERT.

---

### **STEP 2: Fix ALL Existing Broken Users** 🔧

**Why:** Anyone who tried to register before the fix is stuck as 'user'

**Option A: Auto-Fix All (Recommended)**

```sql
-- This fixes ALL users who have talent_profiles but wrong type
UPDATE public.users u
SET 
  user_type = 'talent',
  updated_at = NOW()
FROM talent_profiles tp
WHERE 
  u.id = tp.user_id 
  AND u.user_type = 'user'
RETURNING u.id, u.email, u.user_type;
```

**Option B: Fix Specific User (talent9@gmail.com)**

```sql
-- Change user_type for this one user
UPDATE public.users
SET 
  user_type = 'talent',
  updated_at = NOW()
WHERE email = 'talent9@gmail.com'
RETURNING id, email, user_type;

-- Create talent profile if missing
INSERT INTO talent_profiles (
  user_id, category, bio, pricing, fulfillment_time_hours,
  is_featured, is_active, total_orders, fulfilled_orders,
  average_rating, admin_fee_percentage, 
  first_orders_promo_active, onboarding_completed
)
SELECT 
  u.id, 'other', '', 299.99, 48, false, false, 0, 0, 0, 25, true, false
FROM public.users u
WHERE u.email = 'talent9@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM talent_profiles WHERE user_id = u.id)
RETURNING id, user_id;
```

---

### **STEP 3: Test End-to-End** ✅

1. **Create new onboarding link** in Admin Dashboard
2. **Open link in incognito window**
3. **Register with BRAND NEW email**
4. Should:
   - ✅ Create account on first try (no error)
   - ✅ Proceed to Step 2 immediately
   - ✅ User created as `user_type='talent'`
   - ✅ Talent profile created
   - ✅ Can access talent dashboard after completing onboarding

---

## For Existing Broken Users

### **Quick Check: Is a user broken?**

```sql
-- Check user type
SELECT id, email, user_type, created_at
FROM public.users
WHERE email = 'CHECK_THIS_EMAIL@example.com';

-- Check if they have talent profile
SELECT tp.id, tp.user_id, tp.onboarding_completed
FROM talent_profiles tp
INNER JOIN public.users u ON tp.user_id = u.id
WHERE u.email = 'CHECK_THIS_EMAIL@example.com';
```

**If they have a talent profile but `user_type='user'`:** They're broken! ❌

### **Fix Options:**

#### **Option 1: Update Existing Account (Fast)**
```sql
UPDATE public.users SET user_type = 'talent' 
WHERE email = 'BROKEN_EMAIL@example.com';
```
User can now login and continue onboarding.

#### **Option 2: Delete and Recreate (Clean Slate)**
```sql
-- 1. Delete from public.users
DELETE FROM public.users WHERE email = 'BROKEN_EMAIL@example.com';

-- 2. Delete from talent_profiles  
DELETE FROM talent_profiles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'BROKEN_EMAIL@example.com'
);

-- 3. Delete from auth.users (requires admin)
DELETE FROM auth.users WHERE email = 'BROKEN_EMAIL@example.com';
```
User can now register fresh with same email.

---

## Root Causes (For Reference)

### **Issue 1: UPDATE instead of UPSERT**
```typescript
// OLD (Broken):
await supabase.from('users').update({ user_type: 'talent' }).eq('id', userId)
// ❌ Tried to update non-existent record

// NEW (Fixed):
await supabase.from('users').upsert({ 
  id: userId, 
  email, 
  user_type: 'talent',
  ...
})
// ✅ Creates if not exists, updates if exists
```

### **Issue 2: RLS Too Restrictive**
```sql
-- OLD (Broken):
CREATE POLICY ON users FOR INSERT TO anon
-- ❌ Only INSERT, UPSERT needs UPDATE too!

-- NEW (Fixed):
CREATE POLICY ON users FOR INSERT TO authenticated
CREATE POLICY ON users FOR UPDATE TO authenticated  
-- ✅ Both INSERT and UPDATE allowed
```

---

## Files Reference

- `database/fix_users_rls_for_upsert.sql` - RLS policy fix (STEP 1)
- `database/fix_misclassified_talent_users.sql` - Bulk user type fix (STEP 2)
- `database/cleanup_specific_broken_user.sql` - Individual user cleanup
- `URGENT_FIX_ONBOARDING_RLS.md` - Detailed RLS explanation
- `FIX_TALENT_USER_TYPES.md` - User type fix guide
- `ONBOARDING_FIX_ACTION_PLAN.md` - This file

---

## Timeline

| Time | Action |
|------|--------|
| **NOW** | Deploy STEP 1 (RLS fix) |
| **+5 min** | Deploy STEP 2 (Fix existing users) |
| **+10 min** | Test with new onboarding link |
| **Done** | All talent onboarding working ✅ |

---

## Success Criteria

✅ New talent can register on **first attempt**  
✅ No "Failed to create/update user record" errors  
✅ Users created with `user_type='talent'`  
✅ Talent profiles created automatically  
✅ Existing broken users converted to talent  
✅ Talent can access talent dashboard  
✅ Orders show up correctly  

---

## Support

**If still broken after all steps:**

1. Check RLS policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

2. Check user type:
   ```sql
   SELECT email, user_type FROM public.users WHERE email = 'PROBLEM_EMAIL';
   ```

3. Check talent profile exists:
   ```sql
   SELECT * FROM talent_profiles WHERE user_id IN (
     SELECT id FROM public.users WHERE email = 'PROBLEM_EMAIL'
   );
   ```

4. Check console errors during registration

---

**Priority:** 🔴 **CRITICAL** - All talent onboarding blocked  
**Impact:** HIGH - Affects revenue and growth  
**Complexity:** Medium - 3 SQL scripts to run  
**Time:** 15 minutes to fully deploy and test  

🚀 **Deploy ASAP!**

