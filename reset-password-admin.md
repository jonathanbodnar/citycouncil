# Admin Password Reset for Tim Pool

## Option 1: Via Supabase Dashboard (EASIEST)

1. Run `database/find_tim_pool_email.sql` to get his email
2. Go to **Supabase Dashboard** → **Authentication** → **Users**
3. Find Tim Pool by his email
4. Click the **3 dots menu** → **Send Password Recovery Email**
5. He'll receive an email with a reset link

## Option 2: Manually Set Password in Database (NOT RECOMMENDED)

You cannot directly set passwords in the database because they're hashed by Supabase.

## Option 3: Update via SQL (If you have his user ID)

If you know his email, run this in Supabase SQL Editor:

```sql
-- First find his user ID
SELECT id, email FROM auth.users WHERE email = 'tim@timcast.com'; -- Replace with actual email

-- Then use Supabase's admin API or dashboard to send reset email
```

## Temporary Workaround: Create a Magic Link

Instead of resetting the password, you could:
1. Get his email from the database
2. Use Supabase Dashboard → Authentication → Users → Send Magic Link
3. He can log in with that and then change his password from his profile

---

**Recommended:** Use Option 1 (Supabase Dashboard) - it's the safest and easiest way!

