# Quick Deploy - Order Refund System

## 🚀 3-Step Deployment

### 1️⃣ Database Migration (Supabase Dashboard)

Go to: **Supabase Dashboard** → **SQL Editor** → **New Query**

Paste and run this:

```sql
-- Add order denial and refund tracking columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS denial_reason TEXT,
ADD COLUMN IF NOT EXISTS denied_by VARCHAR(20) CHECK (denied_by IN ('admin', 'talent')),
ADD COLUMN IF NOT EXISTS denied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS refund_amount INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_denied_by ON orders(denied_by);
CREATE INDEX IF NOT EXISTS idx_orders_denied_at ON orders(denied_at);
CREATE INDEX IF NOT EXISTS idx_orders_refund_id ON orders(refund_id);

-- Comments
COMMENT ON COLUMN orders.denial_reason IS 'Reason provided when order was denied';
COMMENT ON COLUMN orders.denied_by IS 'Who denied: admin or talent';
COMMENT ON COLUMN orders.denied_at IS 'Timestamp when denied';
COMMENT ON COLUMN orders.refund_id IS 'Fortis refund transaction ID';
COMMENT ON COLUMN orders.refund_amount IS 'Amount refunded in cents';
```

✅ **Expected Result:** "Success. No rows returned"

---

### 2️⃣ Deploy Edge Function

```bash
cd /Users/jonathanbodnar/ShoutOut

supabase functions deploy fortis-refund --project-ref utafetamgwukkbrlezev --no-verify-jwt
```

✅ **Expected Output:** "Deployed function fortis-refund on project utafetamgwukkbrlezev"

---

### 3️⃣ Test It!

**Admin Test:**
1. Go to **Admin Dashboard** → **Orders** tab
2. Click "Deny & Refund" on a test order
3. Enter reason: "Testing refund system"
4. Confirm
5. Check: order status = 'denied', customer gets email + notification

**Talent Test:**
1. Login as talent
2. Go to **Orders** tab
3. Click "Deny & Refund" on a pending order
4. Enter reason
5. Confirm
6. Same checks as admin

---

## ✅ Done!

Both admin and talent can now deny orders with automatic Fortis refunds and customer notifications.

---

## 🆘 Need Help?

See: `ORDER_REFUND_DEPLOYMENT.md` for detailed troubleshooting.

