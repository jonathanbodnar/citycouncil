// Edge Function to sync ad spend data from Facebook and Rumble APIs
// Also syncs Instagram follower counts via Meta Graph API
// Handles timezone conversions (Rumble UTC, Facebook account timezone)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AdSpendRecord {
  date: string;
  platform: 'facebook' | 'rumble';
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get credentials from database
    const { data: credentials, error: credError } = await supabase
      .from('ad_platform_credentials')
      .select('*')
      .eq('is_connected', true);

    if (credError) throw credError;

    const results = {
      facebook: { success: false, records: 0, error: null as string | null },
      rumble: { success: false, records: 0, error: null as string | null },
      instagram: { success: false, followers: 0, error: null as string | null }
    };

    // Get date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (const cred of credentials || []) {
      // Facebook Ad Spend Sync
      if (cred.platform === 'facebook' && cred.access_token && cred.account_id) {
        try {
          const fbRecords = await syncFacebookAds(
            cred.access_token,
            cred.account_id,
            startDate,
            endDate
          );
          
          if (fbRecords.length > 0) {
            const { error: upsertError } = await supabase
              .from('ad_spend_daily')
              .upsert(fbRecords, { 
                onConflict: 'date,platform,campaign_id',
                ignoreDuplicates: false 
              });
            
            if (upsertError) throw upsertError;
          }
          
          results.facebook.success = true;
          results.facebook.records = fbRecords.length;

          // Update last sync time
          await supabase
            .from('ad_platform_credentials')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('platform', 'facebook');

        } catch (fbError: any) {
          console.error('Facebook sync error:', fbError);
          results.facebook.error = fbError.message;
        }
      }

      // Instagram Follower Sync (uses same Meta access token)
      if (cred.platform === 'instagram' && cred.access_token) {
        try {
          const followerCount = await syncInstagramFollowers(
            cred.access_token,
            cred.account_id, // Instagram Business Account ID or Page ID
            cred.additional_config
          );
          
          if (followerCount > 0) {
            // Get today's date in CST (12am CST = new day)
            const now = new Date();
            // Convert to CST
            const cstOffset = -6; // CST is UTC-6
            const cstDate = new Date(now.getTime() + (cstOffset * 60 * 60 * 1000));
            const todayStr = cstDate.toISOString().split('T')[0];
            
            // Upsert today's follower count
            const { error: upsertError } = await supabase
              .from('follower_counts')
              .upsert({
                date: todayStr,
                platform: 'instagram',
                count: followerCount
              }, { onConflict: 'date' });
            
            if (upsertError) throw upsertError;
            
            results.instagram.success = true;
            results.instagram.followers = followerCount;
          }

          // Update last sync time
          await supabase
            .from('ad_platform_credentials')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('platform', 'instagram');

        } catch (igError: any) {
          console.error('Instagram sync error:', igError);
          results.instagram.error = igError.message;
        }
      }

      // Rumble Ad Spend Sync
      if (cred.platform === 'rumble' && cred.access_token) {
        try {
          const rumbleRecords = await syncRumbleAds(
            cred.access_token,
            cred.account_id,
            startDate,
            endDate
          );
          
          if (rumbleRecords.length > 0) {
            const { error: upsertError } = await supabase
              .from('ad_spend_daily')
              .upsert(rumbleRecords, { 
                onConflict: 'date,platform,campaign_id',
                ignoreDuplicates: false 
              });
            
            if (upsertError) throw upsertError;
          }
          
          results.rumble.success = true;
          results.rumble.records = rumbleRecords.length;

          // Update last sync time
          await supabase
            .from('ad_platform_credentials')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('platform', 'rumble');

        } catch (rumbleError: any) {
          console.error('Rumble sync error:', rumbleError);
          results.rumble.error = rumbleError.message;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Sync Instagram follower count using Meta Graph API
async function syncInstagramFollowers(
  accessToken: string,
  accountId: string | undefined,
  additionalConfig: any
): Promise<number> {
  // The account ID can be either:
  // 1. Instagram Business Account ID directly
  // 2. Facebook Page ID (we'll need to get the connected IG account)
  
  let instagramAccountId = accountId;
  
  // If we have a Page ID in config, get the connected Instagram account
  if (additionalConfig?.page_id) {
    const pageUrl = `https://graph.facebook.com/v18.0/${additionalConfig.page_id}?` + 
      new URLSearchParams({
        access_token: accessToken,
        fields: 'instagram_business_account'
      });
    
    const pageResponse = await fetch(pageUrl);
    if (pageResponse.ok) {
      const pageData = await pageResponse.json();
      if (pageData.instagram_business_account?.id) {
        instagramAccountId = pageData.instagram_business_account.id;
      }
    }
  }
  
  if (!instagramAccountId) {
    // Try to find Instagram account from user's pages
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?` + 
      new URLSearchParams({
        access_token: accessToken,
        fields: 'id,name,instagram_business_account{id,username,followers_count}'
      });
    
    const pagesResponse = await fetch(pagesUrl);
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      // Find first page with Instagram account
      for (const page of pagesData.data || []) {
        if (page.instagram_business_account?.id) {
          instagramAccountId = page.instagram_business_account.id;
          // If we got followers_count directly, return it
          if (page.instagram_business_account.followers_count !== undefined) {
            console.log(`Found Instagram account: ${page.instagram_business_account.username} with ${page.instagram_business_account.followers_count} followers`);
            return page.instagram_business_account.followers_count;
          }
          break;
        }
      }
    }
  }
  
  if (!instagramAccountId) {
    throw new Error('No Instagram Business Account found. Make sure your Instagram is connected to a Facebook Page.');
  }
  
  // Fetch follower count from Instagram Business Account
  const igUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}?` + 
    new URLSearchParams({
      access_token: accessToken,
      fields: 'id,username,followers_count,media_count'
    });
  
  const igResponse = await fetch(igUrl);
  
  if (!igResponse.ok) {
    const errorData = await igResponse.json();
    throw new Error(errorData.error?.message || 'Instagram API error');
  }
  
  const igData = await igResponse.json();
  
  console.log(`Instagram account: ${igData.username}, Followers: ${igData.followers_count}`);
  
  return igData.followers_count || 0;
}

// Sync Facebook Ads data using Marketing API
// IMPORTANT: Facebook returns data in the ad account's timezone (CST for US accounts)
// This means Facebook's "Dec 11" is already Dec 11 CST - no conversion needed!
async function syncFacebookAds(
  accessToken: string,
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<AdSpendRecord[]> {
  const records: AdSpendRecord[] = [];
  
  // Format dates for Facebook API (YYYY-MM-DD)
  const timeRange = {
    since: startDate.toISOString().split('T')[0],
    until: endDate.toISOString().split('T')[0]
  };

  // Fetch campaign insights
  // Facebook API returns data in the account's timezone (usually CST for US accounts)
  const url = `https://graph.facebook.com/v18.0/${accountId}/insights?` + new URLSearchParams({
    access_token: accessToken,
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks',
    time_range: JSON.stringify(timeRange),
    time_increment: '1', // Daily breakdown
    limit: '500'
  });

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Facebook API error');
  }

  const data = await response.json();

  for (const insight of data.data || []) {
    // Facebook returns date_start in account timezone (CST for US accounts)
    // No conversion needed - dates are already in CST!
    records.push({
      date: insight.date_start,
      platform: 'facebook',
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      spend: parseFloat(insight.spend) || 0,
      impressions: parseInt(insight.impressions) || 0,
      clicks: parseInt(insight.clicks) || 0
    });
  }
  
  console.log(`Synced ${records.length} Facebook ad records (already in account timezone/CST)`);

  // Handle pagination if needed
  let nextUrl = data.paging?.next;
  while (nextUrl) {
    const nextResponse = await fetch(nextUrl);
    if (!nextResponse.ok) break;
    
    const nextData = await nextResponse.json();
    for (const insight of nextData.data || []) {
      records.push({
        date: insight.date_start,
        platform: 'facebook',
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        spend: parseFloat(insight.spend) || 0,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0
      });
    }
    nextUrl = nextData.paging?.next;
  }

  return records;
}

// Helper to convert UTC date string to CST date string
// Rumble reports in UTC, we want to store as CST
// UTC midnight = CST 6pm previous day, so we need to ADD 6 hours to get CST date
// Example: Rumble says "2025-12-11" (UTC) = their day started at UTC midnight
//          In CST, UTC midnight is 6pm Dec 10. So Rumble's Dec 11 data
//          actually spans Dec 10 6pm CST to Dec 11 6pm CST.
//          We'll store it as the CST date where most of the day falls (Dec 11).
function convertUtcDateToCst(utcDateStr: string): string {
  // Rumble's date represents a UTC day. We want to map it to CST.
  // Since Rumble's "Dec 11 UTC" is mostly "Dec 11 CST" (from 6am CST onwards),
  // we keep the same date. The key insight is that Rumble's daily aggregation
  // in UTC will mostly align with CST dates.
  // 
  // If you want exact CST day boundaries, you'd need hourly data from Rumble.
  // For daily aggregates, we'll keep the date as-is since:
  // - Rumble Dec 11 UTC = Dec 10 6pm CST to Dec 11 6pm CST
  // - Most of that time (18 hours) is Dec 11 CST
  return utcDateStr;
}

// Sync Rumble Ads data
// Note: Rumble's API details may vary - this is a placeholder implementation
// IMPORTANT: Rumble uses UTC timezone for their daily data
// Facebook uses account timezone (CST for US accounts)
async function syncRumbleAds(
  apiKey: string,
  accountId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<AdSpendRecord[]> {
  const records: AdSpendRecord[] = [];
  
  // Rumble API endpoint (placeholder - actual endpoint may differ)
  // Request in UTC since that's what Rumble uses
  const url = `https://ads.rumble.com/api/v1/campaigns/stats?` + new URLSearchParams({
    api_key: apiKey,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    granularity: 'day'
  });

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // If Rumble API isn't available, return empty array
      console.log('Rumble API not available or invalid credentials');
      return records;
    }

    const data = await response.json();

    for (const stat of data.stats || data.data || []) {
      // Rumble reports dates in UTC
      // For daily aggregates, we keep the same date since most of the UTC day
      // overlaps with the same CST date (18 out of 24 hours)
      const cstDate = convertUtcDateToCst(stat.date);

      records.push({
        date: cstDate,
        platform: 'rumble',
        campaign_id: stat.campaign_id || 'unknown',
        campaign_name: stat.campaign_name || 'Rumble Campaign',
        spend: parseFloat(stat.spend || stat.cost) || 0,
        impressions: parseInt(stat.impressions) || 0,
        clicks: parseInt(stat.clicks) || 0
      });
    }
    
    console.log(`Synced ${records.length} Rumble ad records (UTC dates mapped to CST)`);
  } catch (error) {
    console.error('Rumble API error:', error);
    // Return empty array if API fails
  }

  return records;
}
