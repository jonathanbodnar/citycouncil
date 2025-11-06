# 🚨 URGENT: Fix Talent Onboarding RLS Policy

## Problem

Talent onboarding is **failing on first attempt** with error:
```
❌ Failed to create/update user record: 
   Error: Failed to set up talent account. Please contact support.
```

**Why it happens:**
- User clicks onboarding link → Creates account
- Code tries to UPSERT into `public.users` table
- **RLS Policy blocks it!** ❌
- User sees error
- User tries again → Sometimes works (inconsistent)

## Root Cause

**Current RLS Policies (BROKEN):**
```sql
-- Only allows INSERT, not UPDATE
CREATE POLICY "Allow user creation during onboarding" ON users
FOR INSERT TO anon
WITH CHECK (user_type = 'talent');
```

**Problem:** 
- UPSERT needs **both INSERT and UPDATE** permissions
- Policy only grants INSERT
- When user record exists (or needs update), UPSERT fails

## The Fix

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Copy entire contents of database/fix_users_rls_for_upsert.sql
```

**What it does:**
1. ✅ Allows authenticated users to **INSERT** their own record
2. ✅ Allows authenticated users to **UPDATE** their own record  
3. ✅ Allows authenticated users to **SELECT** their own data
4. ✅ Keeps anonymous INSERT for edge cases

## Quick Fix (Copy-Paste Ready)

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-upsert" ON users;

-- Allow authenticated INSERT (for new users)
CREATE POLICY "Allow authenticated user creation" ON users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated UPDATE (for UPSERT)
CREATE POLICY "Allow authenticated self-update" ON users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow authenticated SELECT (to read own data)
CREATE POLICY "Allow authenticated self-select" ON users
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Allow anonymous INSERT (edge case)
CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT TO anon
WITH CHECK (user_type = 'talent');
```

## How to Deploy

### Method 1: Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select project: `utafetamgwukkbrlezev`
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy entire contents of `database/fix_users_rls_for_upsert.sql`
6. Click **Run** (or press Cmd+Enter)
7. Verify policies are created ✅

### Method 2: Command Line

```bash
psql "your-supabase-connection-string" -f database/fix_users_rls_for_upsert.sql
```

## Verification

After running the fix:

### 1. Check Policies Exist:

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
```

**Should show:**
- `Allow authenticated self-select` (SELECT)
- `Allow authenticated self-update` (UPDATE)
- `Allow authenticated user creation` (INSERT)
- `Allow anonymous user creation for talent` (INSERT)

### 2. Test Onboarding:

1. Open onboarding link: `https://shoutout.us/onboard/:token`
2. Fill out form and submit
3. Should proceed to Step 2 **immediately** ✅
4. No "Failed to create/update" error ❌
5. User should be created as `user_type='talent'` ✅

### 3. Check User Type:

```sql
-- Replace with actual email
SELECT id, email, user_type 
FROM users 
WHERE email = 'test@example.com';
```

Should show `user_type='talent'` ✅

## Why This Fixes It

**Before (Broken):**
```typescript
// Code tries to UPSERT
await supabase.from('users').upsert({ id, user_type: 'talent', ... })
// ❌ RLS blocks UPDATE portion of UPSERT
// Error: permission denied
```

**After (Fixed):**
```typescript
// Code tries to UPSERT
await supabase.from('users').upsert({ id, user_type: 'talent', ... })
// ✅ RLS allows both INSERT and UPDATE
// Success!
```

## Impact

**Before Fix:**
- ❌ Onboarding fails on first attempt
- ❌ User sees confusing error
- ❌ Must retry 2-3 times
- ❌ Users created with wrong type

**After Fix:**
- ✅ Onboarding succeeds on first attempt
- ✅ Clean user experience
- ✅ No retries needed
- ✅ Users created as talent correctly

## Timeline

- **Bug Discovered:** 2025-11-06 (during admin onboarding testing)
- **Root Cause:** RLS policy too restrictive for UPSERT
- **Fix Created:** database/fix_users_rls_for_upsert.sql
- **Status:** **READY TO DEPLOY** ⚡

## Related Issues

This fix also resolves:
- ✅ "Failed to set up talent account" error
- ✅ Users being created as 'user' instead of 'talent'
- ✅ Inconsistent onboarding success
- ✅ Need to click "register" multiple times

## Files

- `database/fix_users_rls_for_upsert.sql` - SQL fix
- `URGENT_FIX_ONBOARDING_RLS.md` - This guide

## Priority

🔴 **CRITICAL** - Blocks all talent onboarding  
⏰ **Deploy immediately** to restore functionality

---

**Once deployed, test with a fresh onboarding link!** 🚀

