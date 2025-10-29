# Database Restore Guide - Recover Base64 Images

## Supabase Automatic Backups

Supabase automatically creates daily backups of your database. Here's how to restore:

### **Option 1: Point-in-Time Recovery (PITR) - Fastest**

**For Pro Plan and above:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Database** → **Backups**
4. Click **Point in Time Recovery**
5. Select a time **before you ran the SQL cleanup queries** (probably within the last few hours)
6. Click **Restore**
7. Wait 5-10 minutes for restore to complete

⚠️ **This will restore your ENTIRE database** to that point in time, including all data.

### **Option 2: Daily Backup Restore**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Database** → **Backups**
4. You'll see daily backups (usually kept for 7 days on free plan, 30+ days on paid)
5. Find the most recent backup **before you ran the cleanup**
6. Click **Restore**

⚠️ **This restores to the backup time**, so you may lose other recent changes too.

### **Option 3: Manual SQL Restore (if you have a backup)**

If you created a backup before running the cleanup:

1. Go to **SQL Editor** in Supabase Dashboard
2. Paste your backup SQL
3. Click **Run**

---

## Quick Check: Do You Have Backups?

Run this to see available backups:

**In Supabase Dashboard:**
1. Go to **Database** → **Backups**
2. Check if you see backups from today or recent days
3. Note the timestamp of the most recent backup **before** you ran the cleanup

---

## After Restore: Run Migration FIRST

Once you restore the database:

1. **DO NOT run SQL cleanup queries**
2. **Instead, run the migration script:**
   ```bash
   node migrate-base64-to-wasabi.js
   ```
3. This will convert base64 → Wasabi URLs
4. Images will be preserved!

---

## If No Backups Available

If Supabase doesn't have backups (unlikely), you'll need to:

1. Check if you have local database dumps
2. Check if images were saved anywhere else (local files, etc.)
3. Re-upload images manually

---

## What To Do RIGHT NOW

1. **Stop! Don't run any more database commands**
2. Go to Supabase Dashboard → Database → Backups
3. See what backup options are available
4. Let me know what you see!

---

## Prevention for Future

After restoring:

1. **First:** Test migration script on a small subset
2. **Then:** Run full migration
3. **Finally:** Verify all images migrated successfully
4. **Only then:** Clean up (if needed)

The correct order should have been:
1. ✅ Run migration script (convert base64 → Wasabi)
2. ✅ Verify migration worked
3. ✅ Then optionally run cleanup

We accidentally did step 3 first. Let's restore and do it right!

