# Deploy Admin Impersonation Feature

## 🎯 What This Does
Adds a "Login as Talent" button in Admin > Talent that allows you to impersonate any talent user for testing purposes.

## 📋 Deployment Steps

### 1. Create Audit Log Table

Run this SQL in Supabase Dashboard (https://supabase.com/dashboard/project/yjivviljtkedbymnnpyk/sql/new):

```sql
-- Create admin audit log table for tracking impersonation and other admin actions

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON public.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Create policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON public.admin_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

### 2. Deploy Edge Function

In your terminal, run:

```bash
cd /Users/jonathanbodnar/ShoutOut
npx supabase functions deploy admin-impersonate --project-ref yjivviljtkedbymnnpyk
```

If you need to login first:
```bash
npx supabase login
```

### 3. Deploy Frontend Changes

Commit and push the changes:

```bash
git add -A
git commit -m "Add admin impersonation feature

- Add 'Login as Talent' button in Admin > Talent management
- Create admin-impersonate Edge Function for secure session generation
- Add admin_audit_log table for tracking impersonations
- Admins can now test talent experience by logging in as them"
git push origin development
```

### 4. Merge to Main (when ready)

```bash
git checkout main
git merge development
git push origin main
```

## 🔒 Security Features

1. **Admin-Only Access**: Only users with `user_type = 'admin'` can use impersonation
2. **Audit Trail**: All impersonations are logged in `admin_audit_log` table with:
   - Admin ID
   - Target user ID
   - Timestamp
   - Email addresses
3. **Confirmation Dialog**: User must confirm before impersonating
4. **Service Role Key**: Edge Function uses service role for session generation

## 🎨 UI Location

The purple user icon button appears in the Admin > Talent table, between the "View Profile" button and "Watermark Video" button.

## 📝 How It Works

1. Admin clicks purple user icon next to talent name
2. Confirmation dialog appears
3. Edge Function validates admin status
4. Creates new session for target talent user
5. Logs the impersonation in audit log
6. Admin is logged out and logged in as talent
7. Redirects to talent dashboard
8. Admin's email is stored in localStorage for easy return (future feature)

## 🔄 Return to Admin (Future Enhancement)

You can add a "Return to Admin" button in the talent dashboard that checks for `localStorage.getItem('admin_return_email')` and provides a quick way to log back in as admin.

## 🐛 Troubleshooting

If impersonation fails:
1. Check Edge Function logs: https://supabase.com/dashboard/project/yjivviljtkedbymnnpyk/functions/admin-impersonate/logs
2. Verify audit log table exists: `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 10;`
3. Ensure admin user has `user_type = 'admin'` in `public.users` table
4. Check browser console for errors

## 📊 View Audit Logs

```sql
SELECT 
  al.created_at,
  al.action,
  admin.email as admin_email,
  target.email as target_email,
  al.metadata
FROM admin_audit_log al
LEFT JOIN auth.users admin ON al.admin_id = admin.id
LEFT JOIN auth.users target ON al.target_user_id = target.id
ORDER BY al.created_at DESC
LIMIT 20;
```

