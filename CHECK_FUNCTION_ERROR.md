# Check Admin Impersonate Function Error

The function is deployed but returning a non-2xx error. Let's diagnose:

## 1. Check Function Logs
Go to: https://supabase.com/dashboard/project/yjivviljtkedbymnnpyk/functions/admin-impersonate/logs

Look for the most recent invocation and check:
- What HTTP status code is it returning? (401, 403, 500?)
- What error message is in the logs?

## Common Issues:

### If you see 401 Unauthorized:
- The admin user check is failing
- Your user might not have `user_type = 'admin'` in the `users` table

### If you see 403 Forbidden:
- Admin check passed but `user_type !== 'admin'`
- Run this SQL to verify:
```sql
SELECT id, email, user_type 
FROM public.users 
WHERE email = 'YOUR_ADMIN_EMAIL';
```

### If you see 400 Bad Request:
- The `userId` parameter isn't being sent
- Check browser console for the request payload

### If you see 500 Internal Server Error:
- Session creation failed
- Check function logs for the exact error message

## Quick Test:

Open browser console on the admin page and run:
```javascript
const { data, error } = await supabase.functions.invoke('admin-impersonate', {
  body: { userId: '71d6b029-b87e-47b3-aa1e-2de1f0f00f56' }
});
console.log('Response:', data);
console.log('Error:', error);
```

This will show you the exact error message!

