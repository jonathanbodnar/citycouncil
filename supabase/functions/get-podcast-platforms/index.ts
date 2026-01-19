// Edge function to get podcast platform links from PodcastIndex API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { feedUrl } = await req.json();

    if (!feedUrl) {
      return new Response(JSON.stringify({ error: 'Feed URL required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // PodcastIndex API credentials
    const API_KEY = Deno.env.get('PODCASTINDEX_API_KEY');
    const API_SECRET = Deno.env.get('PODCASTINDEX_API_SECRET');

    if (!API_KEY || !API_SECRET) {
      console.warn('PodcastIndex API credentials not configured');
      return new Response(JSON.stringify({ platforms: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PodcastIndex API requires special authentication
    const apiTime = Math.floor(Date.now() / 1000);
    const data4Hash = API_KEY + API_SECRET + apiTime;
    
    // Create SHA-1 hash
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data4Hash);
    const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const authHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Search for podcast by feed URL
    const searchUrl = `https://api.podcastindex.org/api/1.0/podcasts/byfeedurl?url=${encodeURIComponent(feedUrl)}&pretty`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ShoutOut/1.0',
        'X-Auth-Key': API_KEY,
        'X-Auth-Date': apiTime.toString(),
        'Authorization': authHash,
      },
    });

    if (!response.ok) {
      console.error('PodcastIndex API error:', response.status);
      return new Response(JSON.stringify({ platforms: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const feed = data.feed;

    if (!feed) {
      return new Response(JSON.stringify({ platforms: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract platform links from PodcastIndex data
    const platforms: Record<string, string> = {};

    // PodcastIndex provides these in the feed object or funding/value tags
    if (feed.itunesId) {
      platforms.apple = `https://podcasts.apple.com/podcast/id${feed.itunesId}`;
    }
    
    // Check for Spotify in the description or links
    if (feed.link && feed.link.toLowerCase().includes('spotify')) {
      platforms.spotify = feed.link;
    }

    // Check funding tags for platform links
    if (feed.funding) {
      const fundingArray = Array.isArray(feed.funding) ? feed.funding : [feed.funding];
      fundingArray.forEach((funding: any) => {
        const url = funding.url || '';
        const lowerUrl = url.toLowerCase();
        
        if (lowerUrl.includes('spotify.com')) {
          platforms.spotify = url;
        } else if (lowerUrl.includes('youtube.com')) {
          platforms.youtube = url;
        } else if (lowerUrl.includes('podcasts.google.com')) {
          platforms.google = url;
        }
      });
    }

    return new Response(JSON.stringify({ platforms }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in get-podcast-platforms:', error);
    return new Response(JSON.stringify({ platforms: {}, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
