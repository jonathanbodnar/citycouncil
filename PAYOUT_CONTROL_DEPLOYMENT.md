# Payout Control System - Deployment Guide

## Overview
This feature allows admins to globally enable/disable payout functionality (Moov/Plaid verification) before soft launch. When disabled, talent see greyed-out buttons and a clear message that payouts will be enabled soon.

## 🗄️ Database Migration

### Step 1: Run the SQL Migration

Execute this in your Supabase SQL Editor:

```sql
-- Add 'payouts_enabled' setting to platform_settings table
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
VALUES (
  'payouts_enabled',
  'false',
  'boolean',
  'Enable or disable payout functionality globally (Moov/Plaid verification)',
  NOW(),
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;
```

**Or** run the migration file:
```bash
# Copy the contents of database/add_payouts_enabled_setting.sql
# Paste into Supabase Dashboard > SQL Editor > New Query > Run
```

### Step 2: Verify the Setting Exists

```sql
SELECT * FROM platform_settings WHERE setting_key = 'payouts_enabled';
```

You should see:
- `setting_key`: `payouts_enabled`
- `setting_value`: `false`
- `setting_type`: `boolean`
- `description`: `Enable or disable payout functionality globally (Moov/Plaid verification)`

---

## 🎛️ Admin Control

### How to Enable/Disable Payouts

1. **Login as Admin**
2. **Navigate to Admin Dashboard** → `Settings` tab
3. **Find "Enable or disable payout functionality globally"** setting
4. **Toggle between:**
   - **No** = Payouts disabled (default before soft launch)
   - **Yes** = Payouts enabled (enable before soft launch)

The change takes effect **immediately** across all talent dashboards.

---

## 🎨 User Experience

### When Payouts are DISABLED (setting_value = 'false'):

#### **Payouts Dashboard** (`/dashboard?tab=payouts`):
- ✅ Yellow notice banner:
  > **Payouts Coming Soon**  
  > Payouts will be enabled before soft launch - all videos completed prior to launch will be paid out as soon as payouts are enabled.
- ✅ Moov verification button: **greyed out** (`opacity-50`, `pointer-events-none`)
- ✅ "Link Bank" (Plaid) button: **disabled** (`disabled:opacity-50`, `disabled:cursor-not-allowed`)
- ✅ "Add Another Bank Account" link: **greyed out** (`text-gray-400`, `cursor-not-allowed`)

#### **Welcome Page** (`/welcome`):
- ✅ Quick Start Tip #3 shows:
  > **3. Setup Payouts:** we will enable payouts shortly. Once all security checks are complete.

### When Payouts are ENABLED (setting_value = 'true'):

#### **Payouts Dashboard**:
- ✅ No notice banner
- ✅ Moov verification button: **active**
- ✅ "Link Bank" (Plaid) button: **active**
- ✅ "Add Another Bank Account" link: **active**

#### **Welcome Page**:
- ✅ Quick Start Tip #3 shows:
  > **3. Setup Payouts:** [Click here](#) to securely setup your payouts and receive payments for your orders.

---

## 🧪 Testing Checklist

### Test 1: Verify Payouts Disabled (Default State)
1. ✅ Login as a talent user
2. ✅ Go to `/dashboard?tab=payouts`
3. ✅ **Expected:**
   - Yellow "Payouts Coming Soon" notice is visible
   - Moov button is greyed out
   - "Link Bank" button is greyed out and can't be clicked
4. ✅ Go to `/welcome`
5. ✅ **Expected:**
   - Quick Start Tip #3 shows: "we will enable payouts shortly. Once all security checks are complete."

### Test 2: Enable Payouts via Admin
1. ✅ Login as admin
2. ✅ Go to Admin Dashboard → Settings tab
3. ✅ Find "Enable or disable payout functionality globally"
4. ✅ Change from "No" to "Yes"
5. ✅ **Expected:** Setting saves successfully

### Test 3: Verify Payouts Enabled
1. ✅ Login as a talent user (or refresh if already logged in)
2. ✅ Go to `/dashboard?tab=payouts`
3. ✅ **Expected:**
   - No yellow notice banner
   - Moov button is active
   - "Link Bank" button is active and clickable
4. ✅ Go to `/welcome`
5. ✅ **Expected:**
   - Quick Start Tip #3 shows: "Click here to securely setup your payouts..."
   - Link is active and clickable

### Test 4: Disable Payouts Again
1. ✅ Admin: Change setting back to "No"
2. ✅ Talent: Refresh dashboard
3. ✅ **Expected:** Buttons are greyed out again, notice reappears

---

## 📋 Files Changed

### New Files:
- `database/add_payouts_enabled_setting.sql` - Database migration

### Modified Files:
- `src/components/PayoutsDashboard.tsx` - Fetch setting, grey out buttons, add notice
- `src/pages/WelcomePage.tsx` - Fetch setting, update Quick Start Tip #3
- `src/components/PlatformSettings.tsx` - (No changes needed, already supports boolean toggles)

---

## 🚀 Launch Day Workflow

### Before Soft Launch (November 24th, 2025):
1. ✅ Keep `payouts_enabled` = `false` (default)
2. ✅ Talent see disabled buttons and "coming soon" message
3. ✅ Talent can still complete orders
4. ✅ Payout data is tracked in database

### On Soft Launch Day:
1. ✅ Admin: Login to Admin Dashboard
2. ✅ Navigate to Settings tab
3. ✅ Change "Enable or disable payout functionality globally" to **Yes**
4. ✅ All talent can now link their bank accounts via Moov/Plaid
5. ✅ Payouts for completed videos can be processed

### After Launch:
- Keep `payouts_enabled` = `true` permanently
- Talent can link/manage bank accounts anytime
- Payouts process normally

---

## 🔧 Troubleshooting

### Issue: Setting doesn't appear in Admin Settings
**Solution:**
1. Run the SQL migration again
2. Refresh the Admin Dashboard
3. Navigate to Settings tab

### Issue: Buttons still active when payouts disabled
**Solution:**
1. Check that `payouts_enabled` setting exists in `platform_settings` table
2. Verify `setting_value` is `'false'` (string, not boolean)
3. Hard refresh the talent dashboard (Cmd+Shift+R / Ctrl+Shift+R)

### Issue: Talent dashboard shows error
**Solution:**
1. Check browser console for errors
2. Verify `platform_settings` table has RLS policies allowing read access
3. If setting doesn't exist, it defaults to `false` (safe fallback)

---

## 📝 Notes

- **Default State:** Payouts are **disabled** by default
- **Safety:** If the setting doesn't exist or can't be fetched, payouts default to **disabled**
- **Real-time:** Changes take effect immediately (no cache delay)
- **Backwards Compatible:** Works with existing payout data (orders, bank info, etc.)
- **No Data Loss:** Disabling payouts doesn't delete bank info, it just prevents new links

---

## ✅ Deployment Complete!

You now have full admin control over payout functionality. Enable it when you're ready for soft launch! 🚀

