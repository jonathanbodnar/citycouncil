# Payout Control - Quick Reference

## 🎯 Quick Deploy

### 1️⃣ Run SQL Migration
```sql
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
VALUES ('payouts_enabled', 'false', 'boolean', 'Enable or disable payout functionality globally (Moov/Plaid verification)', NOW(), NOW())
ON CONFLICT (setting_key) DO NOTHING;
```

### 2️⃣ Enable Payouts (When Ready)
1. Admin Dashboard → Settings
2. Toggle "Enable or disable payout functionality globally" to **Yes**
3. Done! ✅

---

## 🔍 What Happens When Disabled?

### Talent Sees:
- 🟡 Yellow notice: "Payouts will be enabled before soft launch..."
- 🚫 Greyed out Moov button
- 🚫 Greyed out "Link Bank" button
- 📝 Welcome page tip: "we will enable payouts shortly"

### Talent Can Still:
- ✅ View payout history
- ✅ Export payout CSV
- ✅ Complete orders
- ✅ See their stats

---

## 🎛️ Admin Control

**Location:** Admin Dashboard → Settings tab

**Setting Name:** "Enable or disable payout functionality globally (Moov/Plaid verification)"

**Options:**
- **No** = Disabled (before soft launch)
- **Yes** = Enabled (on soft launch day)

---

## 🚀 Launch Day (Nov 24, 2025)

1. Login as admin
2. Settings → Change to **Yes**
3. All talent can now link banks
4. Payouts enabled! 🎉

---

## 🧪 Quick Test

**Disabled:**
```bash
# Talent → /dashboard?tab=payouts
# Should see: Yellow notice + greyed buttons
```

**Enabled:**
```bash
# Admin → Settings → Toggle to Yes
# Talent → Refresh → Buttons active
```

---

## 📁 Files

- `database/add_payouts_enabled_setting.sql`
- `src/components/PayoutsDashboard.tsx`
- `src/pages/WelcomePage.tsx`

