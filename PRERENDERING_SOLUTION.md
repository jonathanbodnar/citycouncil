# Open Graph Preview Fix for Talent Pages

## Problem
Facebook, Twitter, and other social media platforms don't execute JavaScript when scraping links. Since this is a React SPA, the dynamic Open Graph tags added via JavaScript are not seen by social media crawlers.

## Solutions

### Option 1: Prerender.io (Recommended - Easiest)
Use Prerender.io service to serve pre-rendered HTML to crawlers.

**Setup:**
1. Sign up at https://prerender.io (free for 250 pages)
2. Add middleware to your server/hosting:

For Railway/Node.js, add to your server:
```javascript
const prerender = require('prerender-node');
app.use(prerender.set('prerenderToken', 'YOUR_TOKEN'));
```

For static hosting (Netlify/Vercel), add to `netlify.toml` or `vercel.json`:
```toml
[[redirects]]
  from = "/*"
  to = "https://service.prerender.io/https://shoutout.us/:splat"
  status = 200
  force = false
  conditions = {User-Agent = ["facebookexternalhit", "twitterbot", "LinkedInBot"]}
```

### Option 2: react-snap (Medium Difficulty)
Pre-render all routes at build time.

**Installation:**
```bash
npm install --save-dev react-snap
```

**Update `package.json`:**
```json
{
  "scripts": {
    "postbuild": "react-snap"
  },
  "reactSnap": {
    "include": [
      "/",
      "/home",
      "/joshfirestine"
    ]
  }
}
```

**Limitation:** You need to manually list all talent URLs, or generate them dynamically.

### Option 3: Server-Side Rendering with Next.js (Complex)
Migrate from Create React App to Next.js for true SSR.

**Pros:**
- Full SSR support
- Automatic static generation
- Better SEO

**Cons:**
- Requires significant refactoring
- Migration time: 1-2 days

### Option 4: Dynamic Meta Tag Service (Quick Fix)
Use a service like https://www.opengraph.xyz/ or build a simple server endpoint.

Create a Supabase Edge Function that returns HTML with proper meta tags:

```typescript
// supabase/functions/og-preview/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const url = new URL(req.url);
  const username = url.searchParams.get('username');
  
  // Fetch talent data from Supabase
  // Generate HTML with meta tags
  // Return HTML
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
});
```

Then use Railway redirects to serve this for social crawlers.

## Recommended Immediate Solution

**For now, add to Railway `railway.toml`:**

```toml
[deploy]
  # Detect social media bots and serve prerendered content
  startCommand = "npm start"

# Or add to nginx config if using nginx:
# if ($http_user_agent ~* "facebookexternalhit|twitterbot|LinkedInBot") {
#   proxy_pass https://service.prerender.io;
# }
```

## Testing

After implementing, test your Open Graph tags:
- Facebook: https://developers.facebook.com/tools/debug/
- Twitter: https://cards-dev.twitter.com/validator
- LinkedIn: https://www.linkedin.com/post-inspector/

Clear cache and re-scrape each time you update.

## Current Status

✅ Static OG tags added to `public/index.html` (works for homepage)
❌ Dynamic talent page OG tags not working (needs prerendering)

**Next Steps:**
1. Sign up for Prerender.io (free tier)
2. Add prerender middleware to Railway deployment
3. Test with Facebook Debugger

