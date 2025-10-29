# Social Media API Integration Guide

## Overview
This guide explains how to integrate Instagram, TikTok, and Twitter (X) APIs to automatically track:
1. Whether talent have `shoutout.us` in their bio/links
2. Posts that tag `@shoutoutvoice` or `#shoutout`

## Current Status
✅ Database tables created (`social_media_tags`, `social_media_bio_tracking`)
✅ Admin dashboard UI built (`SocialMediaTracking` component)
⏳ API integrations pending

## Platform-Specific Guides

### 1. Instagram API Integration

#### Requirements
- Meta Developer Account
- Instagram Business or Creator Account
- Facebook App with Instagram Basic Display or Instagram Graph API

#### Setup Steps

1. **Create Facebook App:**
   - Go to [developers.facebook.com](https://developers.facebook.com/)
   - Create new app
   - Add Instagram Basic Display or Instagram Graph API product

2. **Get OAuth Credentials:**
   - App ID
   - App Secret
   - Redirect URI: `https://shoutout.us/api/instagram/callback`

3. **User Authorization:**
   - Each talent must authorize your app to read their profile and posts
   - Implement OAuth flow in talent onboarding

4. **Implementation (`supabase/functions/instagram-tracker/index.ts`):**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INSTAGRAM_ACCESS_TOKEN = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
const INSTAGRAM_API = 'https://graph.instagram.com';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get all talent with Instagram connected
    const { data: talents } = await supabase
      .from('talent_profiles')
      .select('id, instagram_username')
      .not('instagram_username', 'is', null);

    for (const talent of talents || []) {
      // Check bio for shoutout.us link
      const profileData = await fetch(
        `${INSTAGRAM_API}/${talent.instagram_username}?fields=biography,website&access_token=${INSTAGRAM_ACCESS_TOKEN}`
      ).then(r => r.json());

      const hasLink = 
        profileData.biography?.includes('shoutout.us') ||
        profileData.website?.includes('shoutout.us');

      // Upsert bio tracking
      await supabase
        .from('social_media_bio_tracking')
        .upsert({
          talent_id: talent.id,
          platform: 'instagram',
          has_shoutout_link: hasLink,
          link_found: profileData.website || profileData.biography,
          last_checked_at: new Date().toISOString()
        }, {
          onConflict: 'talent_id,platform'
        });

      // Check recent posts for tags
      const postsData = await fetch(
        `${INSTAGRAM_API}/${talent.instagram_username}/media?fields=id,caption,timestamp,permalink&access_token=${INSTAGRAM_ACCESS_TOKEN}`
      ).then(r => r.json());

      for (const post of postsData.data || []) {
        const caption = post.caption || '';
        const hasTag = 
          caption.includes('@shoutoutvoice') ||
          caption.includes('#shoutout') ||
          caption.includes('#shoutoutvoice');

        if (hasTag) {
          // Insert tag record (if not exists)
          await supabase
            .from('social_media_tags')
            .insert({
              talent_id: talent.id,
              platform: 'instagram',
              post_id: post.id,
              post_url: post.permalink,
              post_date: post.timestamp,
              caption: caption
            })
            .onConflict('platform,post_id')
            .ignore();
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: talents?.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

5. **Schedule with Cron:**
   - Set up daily cron job in Supabase or use GitHub Actions
   - Call edge function daily to update tracking data

### 2. TikTok API Integration

#### Requirements
- TikTok Developer Account
- TikTok for Business API access
- User authorization for each talent

#### Setup Steps

1. **Apply for API Access:**
   - Visit [developers.tiktok.com](https://developers.tiktok.com/)
   - Apply for Content Posting API or Display API
   - May require business verification

2. **Get Credentials:**
   - Client Key
   - Client Secret

3. **Implementation (`supabase/functions/tiktok-tracker/index.ts`):**

```typescript
const TIKTOK_API = 'https://open.tiktokapis.com/v2';
const TIKTOK_ACCESS_TOKEN = Deno.env.get('TIKTOK_ACCESS_TOKEN');

// Similar structure to Instagram implementation
// Check user bio for shoutout.us
// Fetch user videos and check captions for @shoutoutvoice or #shoutout
```

**Note:** TikTok API access can be restrictive. Alternative: Use TikTok's embed API or manual data entry initially.

### 3. Twitter (X) API Integration

#### Requirements
- Twitter Developer Account (Elevated access recommended)
- Twitter API v2 credentials

#### Setup Steps

1. **Create Twitter App:**
   - Go to [developer.twitter.com](https://developer.twitter.com/)
   - Create project and app
   - Apply for Elevated access (free tier limited to 2M tweets/month)

2. **Get Credentials:**
   - API Key
   - API Secret
   - Bearer Token

3. **Implementation (`supabase/functions/twitter-tracker/index.ts`):**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWITTER_BEARER_TOKEN = Deno.env.get('TWITTER_BEARER_TOKEN');
const TWITTER_API = 'https://api.twitter.com/2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get all talent with Twitter connected
    const { data: talents } = await supabase
      .from('talent_profiles')
      .select('id, twitter_username')
      .not('twitter_username', 'is', null);

    for (const talent of talents || []) {
      const username = talent.twitter_username.replace('@', '');

      // Get user info (includes bio)
      const userResponse = await fetch(
        `${TWITTER_API}/users/by/username/${username}?user.fields=description,url`,
        {
          headers: {
            'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
          }
        }
      );
      const userData = await userResponse.json();

      const hasLink = 
        userData.data.description?.includes('shoutout.us') ||
        userData.data.url?.includes('shoutout.us');

      // Update bio tracking
      await supabase
        .from('social_media_bio_tracking')
        .upsert({
          talent_id: talent.id,
          platform: 'twitter',
          has_shoutout_link: hasLink,
          link_found: userData.data.url || userData.data.description,
          last_checked_at: new Date().toISOString()
        }, {
          onConflict: 'talent_id,platform'
        });

      // Search for tweets mentioning @shoutoutvoice
      const tweetsResponse = await fetch(
        `${TWITTER_API}/tweets/search/recent?query=from:${username} @shoutoutvoice OR #shoutout&tweet.fields=created_at`,
        {
          headers: {
            'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
          }
        }
      );
      const tweetsData = await tweetsResponse.json();

      for (const tweet of tweetsData.data || []) {
        await supabase
          .from('social_media_tags')
          .insert({
            talent_id: talent.id,
            platform: 'twitter',
            post_id: tweet.id,
            post_url: `https://twitter.com/${username}/status/${tweet.id}`,
            post_date: tweet.created_at,
            caption: tweet.text
          })
          .onConflict('platform,post_id')
          .ignore();
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: talents?.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

## Automation Strategy

### Option 1: Supabase Cron (Recommended)
```sql
-- Create cron job in Supabase Dashboard > Database > Cron Jobs
select cron.schedule(
  'social-media-tracking',
  '0 2 * * *', -- Run at 2 AM daily
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/instagram-tracker',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as instagram_tracking;
  
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/tiktok-tracker',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as tiktok_tracking;
  
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/twitter-tracker',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as twitter_tracking;
  $$
);
```

### Option 2: GitHub Actions
```yaml
name: Social Media Tracking
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  track:
    runs-on: ubuntu-latest
    steps:
      - name: Call Instagram Tracker
        run: |
          curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/instagram-tracker \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
      
      - name: Call TikTok Tracker
        run: |
          curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/tiktok-tracker \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
      
      - name: Call Twitter Tracker
        run: |
          curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/twitter-tracker \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

## Rate Limits & Costs

| Platform | Free Tier | Rate Limits | Cost After Free Tier |
|----------|-----------|-------------|---------------------|
| Instagram | Yes | 200 calls/hr | Varies by usage |
| TikTok | Limited | Varies | May require business plan |
| Twitter | Basic (limited) | 10K tweets/month | $100/mo for elevated |

## Environment Variables Needed

Add to Supabase Edge Function secrets:
```bash
INSTAGRAM_ACCESS_TOKEN=your_instagram_token
TIKTOK_ACCESS_TOKEN=your_tiktok_token
TWITTER_BEARER_TOKEN=your_twitter_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing

Before deploying to production:
1. Test with 1-2 talent accounts manually
2. Verify data appears in `social_media_tags` and `social_media_bio_tracking` tables
3. Check Admin Dashboard shows correct data
4. Monitor API rate limits

## Next Steps

1. **Immediate:** Apply for API access from each platform
2. **Week 1:** Implement Instagram tracking (easiest)
3. **Week 2:** Implement Twitter tracking
4. **Week 3:** Implement TikTok tracking (may take longer for API approval)
5. **Week 4:** Set up automated daily tracking with cron

## Alternative: Manual Entry (Interim Solution)

While waiting for API approvals, create a simple form for admins to manually enter:
- When talent adds shoutout.us to bio
- When talent posts with tags

This ensures you can start tracking immediately while APIs are being set up.

