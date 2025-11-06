# Order Denial & Refund System - Deployment Guide

## Overview
This system allows both **admin** and **talent** to deny orders with automatic Fortis refund processing, email notifications, and in-app notifications.

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

Run the SQL migration to add denial tracking columns to the `orders` table:

```bash
# Connect to your Supabase project
# Go to SQL Editor in Supabase Dashboard and run:
```

```sql
-- Copy contents from: database/add_order_denial_system.sql
```

**What it does:**
- Adds `denial_reason` TEXT column
- Adds `denied_by` VARCHAR(20) column ('admin' or 'talent')
- Adds `denied_at` TIMESTAMP column
- Adds `refund_id` VARCHAR(255) column (Fortis refund transaction ID)
- Adds `refund_amount` INTEGER column (amount in cents)
- Creates indexes for performance
- Adds 'denied' to order_status enum (if using enums)

---

### Step 2: Deploy Fortis Refund Edge Function

```bash
# Navigate to your project
cd /Users/jonathanbodnar/ShoutOut

# Deploy the refund function
supabase functions deploy fortis-refund --project-ref utafetamgwukkbrlezev --no-verify-jwt

# Verify deployment
supabase functions list --project-ref utafetamgwukkbrlezev
```

**Environment Variables (Already Set in Railway):**
- `FORTIS_DEVELOPER_ID` = sfcRK525
- `FORTIS_USER_ID` = 31f0ab8e8c8e1b708956086b
- `FORTIS_USER_API_KEY` = 11f0b9ad16fa333aaa494a9d
- `FORTIS_LOCATION_ID` = (from Railway env)

---

### Step 3: Test the Refund System

#### Test in Admin Dashboard:

1. Go to **Admin Dashboard** → **Orders** tab
2. Find a test order with status 'pending' or 'in_progress'
3. Click **"Deny & Refund"**
4. Enter a reason: "Testing refund system"
5. Click **"Deny & Refund"**
6. Verify:
   - ✅ Toast shows "Order denied and refund processed successfully"
   - ✅ Order status changes to 'denied'
   - ✅ Customer receives in-app notification
   - ✅ Customer receives email notification
   - ✅ Refund processed in Fortis

#### Test in Talent Dashboard:

1. Login as a talent user
2. Go to **Orders** tab
3. Find a pending order (or create a test order)
4. Click **"Deny & Refund"** button
5. Enter reason: "Unable to fulfill this request"
6. Click **"Deny & Refund"**
7. Verify same checklist as above

---

### Step 4: Verify Fortis Refunds

1. Go to [Fortis API Dashboard](https://api.fortis.tech)
2. Login with your credentials
3. Check **Transactions** → **Refunds**
4. Verify refund appears with correct amount
5. Check refund status code

---

### Step 5: Deploy Frontend to Railway

The frontend changes are already pushed to the `live` branch. Railway will automatically deploy:

```bash
# Already pushed
git push origin live
```

**What's Deployed:**
- Admin Orders Management component
- Talent Dashboard deny button
- Refund service integration
- Email notification templates
- In-app notification system

---

## 🎯 Features

### Admin Dashboard - Orders Tab

**View All Orders:**
- Customer email and name
- Talent name
- Order amount
- Order status (pending, in_progress, completed, denied)
- Order date

**Actions:**
- Search by customer email, name, or talent
- Filter by order status
- Deny & Refund any order
- View refund status

**Deny Order Flow:**
1. Click "Deny & Refund" button
2. Modal appears with order details
3. Enter denial reason (required)
4. Confirm action
5. System:
   - Processes refund via Fortis
   - Updates order status to 'denied'
   - Sends email to customer
   - Creates in-app notification
   - Tracks who denied (admin)

---

### Talent Dashboard - Orders Tab

**Deny Button:**
- Shows on all pending/in_progress orders
- Same refund flow as admin
- Tracks "denied_by: talent"

**Corporate Order Approval:**
- Approve/Reject buttons for corporate orders
- Rejection now includes refund processing
- Updated modal text for clarity

---

## 📧 Notifications

### Email Template (Sent via Mailgun)

The customer receives a beautiful HTML email with:
- **Header:** "Order Denied" with gradient background
- **Reason Box:** Red-bordered box with denial reason
- **Refund Info Box:** Green-bordered box with:
  - Refund amount
  - "Allow 5-10 business days" notice
- **CTA Button:** "View Order History" (links to dashboard)
- **Footer:** ShoutOut branding

### In-App Notification

Appears in the customer's Notifications Center:
- **Title:** "Order Denied & Refunded"
- **Message:** Denial reason + refund amount + 5-10 day timeline
- **Link:** Direct link to order history

---

## 🔒 Security & Error Handling

### Edge Function Security:
- ✅ Rate limiting via `RateLimitPresets.PAYMENT`
- ✅ Server-side API key storage
- ✅ Transaction verification before refund
- ✅ CORS headers configured
- ✅ Proper error responses

### Frontend Validation:
- ✅ Requires denial reason (min 1 character)
- ✅ Checks for payment_transaction_id
- ✅ Loading states during processing
- ✅ Toast notifications for all states
- ✅ Modal dismissal on success/cancel

### Database Safety:
- ✅ Atomic updates (order status + refund info)
- ✅ Timestamps for audit trail
- ✅ Indexed columns for performance
- ✅ Tracks who denied (admin vs talent)

---

## 🧪 Testing Checklist

Before going live, test these scenarios:

### Admin Denial:
- [ ] Deny pending order
- [ ] Deny in_progress order
- [ ] Cannot deny completed order
- [ ] Cannot deny already denied order
- [ ] Refund appears in Fortis
- [ ] Email sent to customer
- [ ] In-app notification created
- [ ] Order status changes to 'denied'
- [ ] `denied_by` = 'admin'

### Talent Denial:
- [ ] Deny button shows on pending orders
- [ ] Deny button shows on in_progress orders
- [ ] Modal requires reason
- [ ] Refund processes successfully
- [ ] Customer notified
- [ ] `denied_by` = 'talent'

### Edge Cases:
- [ ] Order without transaction_id (should show error)
- [ ] Duplicate denial attempt (should fail gracefully)
- [ ] Partial refund support (amount parameter)
- [ ] Network failure handling
- [ ] Fortis API error handling

---

## 📊 Monitoring

### Supabase Dashboard:

1. **Edge Functions Logs:**
   - Go to: Edge Functions → fortis-refund → Logs
   - Monitor refund requests
   - Check error rates

2. **Database Queries:**
   ```sql
   -- View all denied orders
   SELECT 
     id, 
     denial_reason, 
     denied_by, 
     denied_at, 
     refund_id, 
     refund_amount 
   FROM orders 
   WHERE status = 'denied' 
   ORDER BY denied_at DESC;
   
   -- Count denials by admin vs talent
   SELECT 
     denied_by, 
     COUNT(*) as denial_count 
   FROM orders 
   WHERE status = 'denied' 
   GROUP BY denied_by;
   
   -- Recent refunds
   SELECT 
     created_at, 
     amount, 
     refund_amount, 
     denial_reason 
   FROM orders 
   WHERE refund_id IS NOT NULL 
   ORDER BY denied_at DESC 
   LIMIT 10;
   ```

### Fortis Dashboard:

1. Check refund success rate
2. Monitor refund processing times
3. Track refund disputes (if any)

---

## 🐛 Troubleshooting

### Issue: Refund fails with "Transaction not found"
**Solution:** Verify `payment_transaction_id` is stored correctly when order is created

### Issue: Email not sent
**Solution:** Check Mailgun Edge Function is deployed and secrets are set

### Issue: In-app notification not showing
**Solution:** Check notifications table permissions in Supabase RLS policies

### Issue: "Cannot process refund: No transaction ID found"
**Solution:** This is expected for test orders without payments. Use real Fortis transactions.

### Issue: Edge Function timeout
**Solution:** Check Fortis API is reachable and responding. Verify credentials.

---

## 🔄 Rollback Plan

If you need to rollback:

1. **Database:**
   ```sql
   -- Remove denial columns (optional, data preserved)
   ALTER TABLE orders 
   DROP COLUMN IF EXISTS denial_reason,
   DROP COLUMN IF EXISTS denied_by,
   DROP COLUMN IF EXISTS denied_at,
   DROP COLUMN IF EXISTS refund_id,
   DROP COLUMN IF EXISTS refund_amount;
   ```

2. **Edge Function:**
   ```bash
   supabase functions delete fortis-refund --project-ref utafetamgwukkbrlezev
   ```

3. **Frontend:**
   ```bash
   git checkout main
   git push origin live --force
   ```

---

## 📞 Support

If issues arise:
1. Check Supabase Edge Function logs
2. Check browser console for frontend errors
3. Verify Fortis API credentials
4. Check Mailgun email logs
5. Review database order records

---

## ✅ Success Criteria

Deployment is successful when:
- ✅ Admin can deny orders from Orders tab
- ✅ Talent can deny orders from their dashboard
- ✅ Fortis refunds process successfully
- ✅ Customers receive email notifications
- ✅ Customers receive in-app notifications
- ✅ Order status updates to 'denied'
- ✅ Refund tracking data is stored
- ✅ No console errors in browser
- ✅ No Edge Function errors in logs

---

## 🎉 You're Done!

The order denial and refund system is now live. Both admin and talent can deny orders with automatic refunds, and customers are notified immediately.

