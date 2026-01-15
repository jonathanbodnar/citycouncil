# 🔴 CRITICAL: Payout Automation Fix

## The Problem

**Payouts are stuck in "pending" status and never automatically processed!**

### What's Happening
1. ✅ Orders complete → Payouts are created (working)
2. ✅ Payout batches are generated (working)
3. ❌ Batches stay "pending" forever (NOT working)
4. ❌ No automatic processing to Moov (MISSING!)

### Root Cause
**There is no cron job to automatically process pending payouts through Moov.**

The system creates payout batches but never triggers the `moov-process-pending-batches` edge function to actually send the money.

---

## The Solution

### 🚀 Quick Fix (One Command)

**Run this in Supabase SQL Editor:**

```sql
-- File: database/FIX_PAYOUT_AUTOMATION.sql
```

This will:
1. ✅ Enable payouts in platform settings
2. ✅ Create automatic cron job (runs every hour)
3. ✅ Process any current pending payouts immediately
4. ✅ Show you a full status report

---

## What It Does

### Before This Fix
```
Order Completed
    ↓
Payout Created (status: pending)
    ↓
Batch Created (status: pending)
    ↓
❌ STUCK HERE FOREVER
```

### After This Fix
```
Order Completed
    ↓
Payout Created (status: pending)
    ↓
Batch Created (status: pending)
    ↓
⏰ Cron runs every hour
    ↓
Calls moov-process-pending-batches edge function
    ↓
Moov processes transfer
    ↓
✅ Batch updated (status: processing → paid)
```

---

## Diagnostic Tools

### 1. Check Current Status
```sql
-- Run: database/CHECK_PAYOUT_STATUS.sql
-- Shows: All pending batches, talent readiness, cron job status
```

### 2. Manual Setup
```sql
-- Run: database/SETUP_PAYOUT_CRON.sql
-- Does: Just creates the cron job (doesn't process immediately)
```

### 3. Complete Fix
```sql
-- Run: database/FIX_PAYOUT_AUTOMATION.sql
-- Does: Everything + processes pending payouts now
```

---

## How Automatic Processing Works

### Cron Schedule
- **Frequency**: Every hour (at minute 0)
- **Job Name**: `auto-process-payouts`
- **Function**: `invoke_process_payouts()`

### What Happens Each Hour
1. ✅ Finds all pending payout batches
2. ✅ Checks if talent has completed Moov setup:
   - Has `moov_account_id`
   - Has `bank_account_linked = true`
   - Has `payout_onboarding_completed = true`
3. ✅ For each ready talent:
   - Calls `moov-process-pending-batches` edge function
   - Sends payout request to Moov API
   - Updates batch status to `processing`
4. ✅ Moov confirms transfer → status changes to `paid`

---

## Verification

### After Running FIX_PAYOUT_AUTOMATION.sql

You should see output like:
```
✅ SUCCESS: Automatic payout processing is now enabled!

System Configuration:
  • Payouts Enabled: ✅ YES
  • Cron Job Active: ✅ YES
  • Schedule: Every hour (top of hour)

Current Pending Payouts:
  • Pending Batches: 0
  • Total Amount: $0.00
  • Talent Ready: 0
  • Talent Not Ready: 0
```

### Check Cron Job Status
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'auto-process-payouts';
```

Should show:
- `jobname`: `auto-process-payouts`
- `schedule`: `0 * * * *`
- `active`: `true`

### Check Recent Runs
```sql
SELECT 
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'auto-process-payouts')
ORDER BY start_time DESC
LIMIT 5;
```

Should show:
- `status`: `succeeded`
- Recent runs every hour

---

## Manual Processing

If you need to process payouts immediately (not wait for cron):

```sql
-- Process all pending payouts right now
SELECT invoke_process_payouts();

-- Or check which batches would be processed
SELECT manually_process_all_pending_payouts();
```

---

## Troubleshooting

### "Payouts still showing pending after 1 hour"

Check if talent has completed setup:
```sql
SELECT 
  tp.username,
  tp.moov_account_id IS NOT NULL as has_moov,
  tp.bank_account_linked as bank_linked,
  tp.payout_onboarding_completed as onboarding_done,
  COUNT(pb.id) as pending_batches
FROM talent_profiles tp
LEFT JOIN payout_batches pb ON pb.talent_id = tp.id AND pb.status = 'pending'
WHERE pb.id IS NOT NULL
GROUP BY tp.id, tp.username, tp.moov_account_id, tp.bank_account_linked, tp.payout_onboarding_completed;
```

All three must be `true` for automatic processing:
- ✅ `has_moov`
- ✅ `bank_linked`
- ✅ `onboarding_done`

### "Cron job shows failed"

Check error message:
```sql
SELECT 
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'auto-process-payouts')
  AND status = 'failed'
ORDER BY start_time DESC
LIMIT 3;
```

Common issues:
- Edge function not deployed
- Moov API credentials missing
- Network timeout

### "Moov API returns error"

Check edge function logs in Supabase dashboard:
1. Go to Edge Functions
2. Select `moov-process-pending-batches`
3. View logs for error details

---

## Summary

**BEFORE**: Payouts created but never processed → stuck pending forever

**AFTER**: Automatic hourly processing → payouts flow through to Moov → talent gets paid

**ACTION REQUIRED**: Run `database/FIX_PAYOUT_AUTOMATION.sql` in Supabase SQL Editor

---

## Questions?

- **How often do payouts process?** Every hour (top of hour)
- **Can I change the schedule?** Yes, edit the cron schedule in the SQL
- **Can I process manually?** Yes, call `invoke_process_payouts()` 
- **What if talent isn't ready?** Batch stays pending until they complete setup
- **Do I need to re-run this?** No, it's permanent once set up

---

**Status**: 🔴 CRITICAL FIX REQUIRED  
**Impact**: All pending payouts  
**Time to Fix**: < 1 minute  
**Complexity**: Run one SQL script
