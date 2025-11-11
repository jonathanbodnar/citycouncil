# URGENT: Contact Supabase Support

## The Issue
We have a database trigger `on_auth_user_created` that's causing all talent registrations to fail with a 500 error.

## What We Need
We need to **disable** this trigger on the `auth.users` table:

```sql
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
```

## Why We Can't Do It
The SQL Editor doesn't have permissions to modify triggers on `auth.users` (system table).

## Options

### Option 1: Supabase Dashboard
1. Go to **Database** → **Triggers** in Supabase Dashboard
2. Find trigger: `on_auth_user_created`
3. Click **Disable** or **Delete**

### Option 2: Supabase Support
If the dashboard doesn't show system triggers, contact Supabase support:
- Go to Supabase Dashboard → Support
- Tell them: "Need to disable trigger `on_auth_user_created` on `auth.users` table - it's blocking user signups"

### Option 3: CLI (if you have it)
```bash
supabase db remote changes
supabase migration new disable_auth_trigger
# Add the ALTER TABLE command to the migration
supabase db push
```

## Temporary Workaround
In the meantime, we could create talent accounts manually through the Supabase dashboard:
1. Go to Authentication → Users
2. Create user manually
3. Then they can use the "Login" option during onboarding

## Why This Happened
The trigger tries to auto-create a `public.users` record when someone signs up, but RLS policies are blocking it. Our frontend code already handles this, so we don't need the trigger.

