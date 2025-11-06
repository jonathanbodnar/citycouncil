# Talent Full Name Setup Guide

## ✅ Issue: Talent can't change their full name in Profile Settings

The code is correct, but the database column might not exist yet.

---

## 🔍 Step 1: Check if Column Exists

Run this in **Supabase SQL Editor**:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'talent_profiles' 
AND column_name = 'full_name';
```

### Expected Result:
```
column_name | data_type
------------|----------
full_name   | text
```

If you see **0 rows**, the column doesn't exist. **→ Go to Step 2.**

If you see the column, **→ Go to Step 3.**

---

## 🛠️ Step 2: Apply the Migration

Run this in **Supabase SQL Editor**:

```sql
-- Add full_name column to talent_profiles table
ALTER TABLE talent_profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add comment to column
COMMENT ON COLUMN talent_profiles.full_name IS 'Talent full legal name (e.g., "Jonathan Bodnar")';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_talent_profiles_full_name ON talent_profiles(full_name);

-- Update existing profiles that have a username but no full_name
-- This is a best-effort migration for existing data
UPDATE talent_profiles
SET full_name = INITCAP(REPLACE(username, '-', ' '))
WHERE full_name IS NULL
  AND username IS NOT NULL;
```

Click **Run** (or press `Cmd+Enter`).

You should see: `Success. No rows returned`

---

## ✅ Step 3: Verify It Works

1. Log in as a **talent** user at https://shoutout.us
2. Go to **Profile Settings** tab
3. Find the **Full Name** field (should be right below Profile Photo)
4. Type a new name (e.g., "Jonathan M. Bodnar")
5. Scroll down and click **Update Profile**
6. You should see: ✅ "Profile updated successfully!"
7. Refresh the page
8. The new name should still be there

---

## 🔍 Step 4: Verify in Database

Run this in **Supabase SQL Editor**:

```sql
SELECT username, full_name 
FROM talent_profiles 
WHERE user_id = '[YOUR_TALENT_USER_ID]';
```

Replace `[YOUR_TALENT_USER_ID]` with the actual user ID.

You should see the updated `full_name` value.

---

## 🐛 Troubleshooting

### "Column already exists" error
- This is fine! It means the column was already added.
- Skip to **Step 3** and test the UI.

### "Permission denied" error
- Make sure you're running the SQL as the **database owner** (not RLS protected).
- Try adding `SET LOCAL ROLE postgres;` before the migration SQL.

### Full name not saving
1. Check browser console for errors (F12 → Console tab)
2. Check Supabase logs (Dashboard → Logs)
3. Verify RLS policies allow updates:

```sql
-- Check if talent can update their own profile
SELECT * FROM pg_policies 
WHERE tablename = 'talent_profiles' 
AND cmd = 'UPDATE';
```

You should see a policy like:
- `talent_profiles_update_own`
- Check: `user_id = auth.uid()`

### Still not working?
Send me:
1. Browser console errors (if any)
2. Result of the column check query (Step 1)
3. Result of the RLS policy check above

---

## 📝 What This Does

- **Adds** `full_name` column to `talent_profiles` table
- **Indexes** it for fast lookups (used by Plaid/Moov)
- **Backfills** existing profiles (converts username → full name)
- **Allows** talent to edit their legal name from Profile Settings
- **Used for**:
  - Moov payout verification
  - Plaid bank account linking
  - Legal compliance

---

## ✅ Success Criteria

- [ ] Column exists in database
- [ ] Talent can see "Full Name" field in Profile Settings
- [ ] Talent can edit and save their full name
- [ ] Name persists after page refresh
- [ ] Name is used in Moov/Plaid onboarding

---

**After confirming this works, you can delete this file.** ✨

