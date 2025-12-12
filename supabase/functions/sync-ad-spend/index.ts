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
          console.log('📸 Starting Instagram sync with account_id:', cred.account_id);
          const followerCount = await syncInstagramFollowers(
            cred.access_token,
            cred.account_id, // Instagram Business Account ID or Page ID
            cred.additional_config
          );
          console.log('📸 Instagram follower count result:', followerCount);
          
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
              }, { onConflict: 'date,platform' });
            
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
            // Deduplicate records by date+campaign_id (aggregate spend if duplicates exist)
            const deduped = new Map<string, AdSpendRecord>();
            for (const record of rumbleRecords) {
              const key = `${record.date}_${record.campaign_id}`;
              if (deduped.has(key)) {
                // Aggregate the values
                const existing = deduped.get(key)!;
                existing.spend += record.spend;
                existing.impressions += record.impressions;
                existing.clicks += record.clicks;
              } else {
                deduped.set(key, { ...record });
              }
            }
            
            const uniqueRecords = Array.from(deduped.values());
            console.log(`🎬 Deduplicated ${rumbleRecords.length} records to ${uniqueRecords.length}`);
            
            const { error: upsertError } = await supabase
              .from('ad_spend_daily')
              .upsert(uniqueRecords, { 
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
  console.log('📸 syncInstagramFollowers called with accountId:', accountId);
  
  // The account ID can be either:
  // 1. Instagram Business Account ID directly
  // 2. Facebook Page ID (we'll need to get the connected IG account)
  
  let instagramAccountId: string | undefined = undefined;
  
  // First, try to use the accountId as a Page ID and get its connected Instagram account
  if (accountId) {
    console.log('📸 Trying to get Instagram account from Page ID:', accountId);
    const pageUrl = `https://graph.facebook.com/v18.0/${accountId}?` + 
      new URLSearchParams({
        access_token: accessToken,
        fields: 'instagram_business_account{id,username,followers_count}'
      });
    
    const pageResponse = await fetch(pageUrl);
    const pageData = await pageResponse.json();
    console.log('📸 Page response:', JSON.stringify(pageData));
    
    if (pageData.instagram_business_account?.id) {
      instagramAccountId = pageData.instagram_business_account.id;
      console.log('📸 Found Instagram account from Page:', instagramAccountId);
      // If we got followers_count directly, return it
      if (pageData.instagram_business_account.followers_count !== undefined) {
        console.log(`📸 Got followers directly: ${pageData.instagram_business_account.followers_count}`);
        return pageData.instagram_business_account.followers_count;
      }
    }
  }
  
  // If we have a Page ID in config, try that too
  if (!instagramAccountId && additionalConfig?.page_id) {
    console.log('📸 Trying page_id from config:', additionalConfig.page_id);
    const pageUrl = `https://graph.facebook.com/v18.0/${additionalConfig.page_id}?` + 
      new URLSearchParams({
        access_token: accessToken,
        fields: 'instagram_business_account{id,username,followers_count}'
      });
    
    const pageResponse = await fetch(pageUrl);
    const pageData = await pageResponse.json();
    console.log('📸 Config page response:', JSON.stringify(pageData));
    
    if (pageData.instagram_business_account?.id) {
      instagramAccountId = pageData.instagram_business_account.id;
      if (pageData.instagram_business_account.followers_count !== undefined) {
        return pageData.instagram_business_account.followers_count;
      }
    }
  }
  
  // If still no Instagram account, try to find from user's pages
  if (!instagramAccountId) {
    console.log('📸 Trying to find Instagram from user pages...');
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?` + 
      new URLSearchParams({
        access_token: accessToken,
        fields: 'id,name,instagram_business_account{id,username,followers_count}'
      });
    
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    console.log('📸 User pages response:', JSON.stringify(pagesData));
    
    // Find first page with Instagram account
    for (const page of pagesData.data || []) {
      if (page.instagram_business_account?.id) {
        instagramAccountId = page.instagram_business_account.id;
        // If we got followers_count directly, return it
        if (page.instagram_business_account.followers_count !== undefined) {
          console.log(`📸 Found Instagram account: ${page.instagram_business_account.username} with ${page.instagram_business_account.followers_count} followers`);
          return page.instagram_business_account.followers_count;
        }
        break;
      }
    }
  }
  
  if (!instagramAccountId) {
    throw new Error('No Instagram Business Account found. Make sure your Instagram is connected to a Facebook Page and the token has instagram_basic permission.');
  }
  
  // Fetch follower count from Instagram Business Account directly
  console.log('📸 Fetching followers from Instagram account:', instagramAccountId);
  const igUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}?` + 
    new URLSearchParams({
      access_token: accessToken,
      fields: 'id,username,followers_count,media_count'
    });
  
  const igResponse = await fetch(igUrl);
  const igData = await igResponse.json();
  console.log('📸 Instagram API response:', JSON.stringify(igData));
  
  if (igData.error) {
    throw new Error(igData.error?.message || 'Instagram API error');
  }
  
  console.log(`📸 Instagram account: ${igData.username}, Followers: ${igData.followers_count}`);
  
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

// Fetch Rumble campaign metadata to get campaign names
// Docs: https://ads.rumble.com/docs/api/advertiser-statistics-metadata
async function fetchRumbleCampaigns(apiKey: string): Promise<Map<string, string>> {
  const campaignNames = new Map<string, string>();
  
  try {
    // Query metadata endpoint with type=campaign to get campaign list
    // GET /advertisers/statistics/metadata?type=campaign
    const metadataUrl = 'https://ads.rumble.com/api/v1/advertisers/statistics/metadata?' + new URLSearchParams({
      type: 'campaign',
      per_page: '100'
    });
    console.log('🎬 Fetching Rumble campaign metadata from:', metadataUrl);
    
    const response = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    
    const responseText = await response.text();
    console.log('🎬 Rumble metadata response:', responseText.substring(0, 1000));
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      
      // Extract campaign names from metadata response
      // Response format: { data: [{ id: "123", name: "Campaign Name" }, ...] }
      const campaigns = data.data || data.campaigns || data.results || [];
      console.log('🎬 Found', campaigns.length, 'campaigns in metadata');
      
      for (const campaign of campaigns) {
        const id = String(campaign.id || campaign.campaign_id);
        const name = campaign.name || campaign.title || campaign.campaign_name;
        if (id && name) {
          campaignNames.set(id, name);
          console.log(`🎬 Campaign: ${id} = ${name}`);
        }
      }
      console.log('🎬 Mapped', campaignNames.size, 'campaign names');
    } else {
      console.log('🎬 Metadata request failed:', response.status);
    }
  } catch (error) {
    console.log('🎬 Could not fetch campaign metadata:', error);
  }
  
  return campaignNames;
}

// Sync Rumble Ads data
// Rumble Advertising Center API
// Docs: https://ads.rumble.com/docs/api/advertiser-statistics-query
// Endpoint: POST /advertisers/statistics
// IMPORTANT: Rumble uses UTC timezone for their daily data
async function syncRumbleAds(
  apiKey: string,
  accountId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<AdSpendRecord[]> {
  const records: AdSpendRecord[] = [];
  
  console.log('🎬 Starting Rumble sync with accountId:', accountId);
  console.log('🎬 API Key (first 10 chars):', apiKey?.substring(0, 10) + '...');
  console.log('🎬 Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
  
  // First, fetch campaign metadata to get names
  const campaignNames = await fetchRumbleCampaigns(apiKey);
  
  // Rumble Advertising Center API endpoint - uses POST method
  // Docs: https://ads.rumble.com/docs/api/advertiser-statistics-query
  const url = 'https://ads.rumble.com/api/v1/advertisers/statistics';

  // Build the request body for the statistics query
  // group_by: ['date', 'campaign'] should give us campaign-level breakdown
  const requestBody: Record<string, unknown> = {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    group_by: ['date', 'campaign'], // Group by date and campaign to get daily campaign stats
    per_page: 1000
  };
  
  // If we have campaign IDs from metadata, we could filter by them
  // But for now, let's get all campaigns

  console.log('🎬 Rumble API URL:', url);
  console.log('🎬 Request body:', JSON.stringify(requestBody));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('🎬 Rumble response status:', response.status);
    console.log('🎬 Rumble rate limit remaining:', response.headers.get('X-RateLimit-Remaining'));
    
    const responseText = await response.text();
    console.log('🎬 Rumble response (first 1000 chars):', responseText.substring(0, 1000));

    if (!response.ok) {
      console.log('🎬 Rumble API error - status:', response.status);
      if (response.status === 401) {
        console.log('🎬 Authentication failed. Make sure your API key is valid.');
        console.log('🎬 Note: Rumble API is in limited release - contact adsupport@rumble.com for API access.');
      } else if (response.status === 422) {
        console.log('🎬 Invalid input. Check the request body format.');
      }
      return records;
    }

    const data = JSON.parse(responseText);
    console.log('🎬 Rumble data structure:', Object.keys(data));
    console.log('🎬 Full Rumble response:', JSON.stringify(data).substring(0, 2000));
    
    // Process the statistics data - try multiple possible response structures
    const statsArray = data.data || data.statistics || data.stats || data.results || data.rows || [];
    console.log('🎬 Found', statsArray.length, 'stat records');
    
    // Log first record to understand structure
    if (statsArray.length > 0) {
      console.log('🎬 First record structure:', JSON.stringify(statsArray[0]));
    }
    
    for (const stat of statsArray) {
      // Rumble returns data in this format:
      // { groups: { date: { id: "2025-12-05" }, campaign: { id: "123", name: "My Campaign" } }, spend: 100, ... }
      
      // Extract date from groups.date.id or fallback to other fields
      const statDate = 
        stat.groups?.date?.id || 
        stat.groups?.date?.name ||
        stat.date || 
        stat.day || 
        stat.period || 
        stat.report_date;
      const cstDate = statDate ? convertUtcDateToCst(statDate) : new Date().toISOString().split('T')[0];
      
      // Extract campaign ID from groups.campaign.id or other fields
      // Note: Rumble may not include campaign breakdown if not requested in group_by
      const campaignId = String(
        stat.groups?.campaign?.id ||
        stat.campaign_id || 
        stat.campaign?.id || 
        stat.campaignId ||
        stat.id || 
        'all' // Use 'all' for aggregate data
      );
      
      // Get campaign name from groups.campaign.name, metadata lookup, or default
      const campaignName = 
        stat.groups?.campaign?.name ||
        campaignNames.get(campaignId) ||
        stat.campaign_name || 
        stat.campaign?.name || 
        stat.campaignName ||
        stat.name ||
        stat.title ||
        (campaignId === 'all' ? 'All Rumble Campaigns' : `Rumble Campaign ${campaignId}`);

      records.push({
        date: cstDate,
        platform: 'rumble',
        campaign_id: campaignId,
        campaign_name: campaignName,
        spend: parseFloat(stat.spend || stat.cost || stat.amount || stat.total_spend || stat.budget_spent || stat.spent) || 0,
        impressions: parseInt(stat.impressions || stat.views || stat.total_impressions || stat.impression_count) || 0,
        clicks: parseInt(stat.clicks || stat.total_clicks || stat.click_count) || 0
      });
    }
    
    // Handle pagination if there are more results
    if (data.pagination?.next_page_url || data.next_page || data.has_more) {
      console.log('🎬 More pages available');
    }
    
    console.log(`🎬 Synced ${records.length} Rumble ad records`);
    
  } catch (error) {
    console.error('🎬 Rumble API error:', error);
  }

  return records;
}
