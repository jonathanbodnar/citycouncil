# Railway Deployment Setup

## Required Environment Variables

Make sure these environment variables are set in your Railway project:

### Supabase Configuration
```
REACT_APP_SUPABASE_URL=https://utafetamgwukkbrlezev.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Other Required Variables
- `PORT` (usually auto-set by Railway to 3000)
- Any other API keys your app needs (Twilio, Fortis, etc.)

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service (frontend-welcome-test)
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add each variable name and value
6. Click **Deploy** to redeploy with new variables

## Troubleshooting

### "Invalid login credentials" Error
- Check that `REACT_APP_SUPABASE_URL` is set correctly
- Check that `REACT_APP_SUPABASE_ANON_KEY` is set correctly
- Verify the values match your Supabase project settings

### CSP (Content Security Policy) Errors
- Already configured in `server.js` to allow Railway and Supabase domains
- If you see CSP errors, check the console for blocked URLs and add them to `server.js`

### Build Fails
- Check build logs for specific errors
- Common issues:
  - TypeScript errors (fix in code)
  - Missing dependencies (run `npm install` locally first)
  - Node version mismatch (using Node 18 in Dockerfile)

## Checking Current Variables

To see what environment variables are currently set:
1. Railway Dashboard → Your Service → Variables tab
2. Or check the build logs for "Environment variables loaded" messages

## Important Notes

- Environment variables in Railway are **separate** from your local `.env` file
- Changes to environment variables require a **redeploy** to take effect
- The Railway deployment uses the **Dockerfile** build process, not local development
- Make sure the `welcome` branch is selected in Railway deployment settings

