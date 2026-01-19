// Edge function to get podcast platform links from PodcastIndex API
// Also extracts links from RSS feed description/links

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to extract platform links from text
function extractPlatformLinks(text: string): Record<string, string> {
  const platforms: Record<string, string> = {};
  if (!text) return platforms;

  // Common URL patterns for podcast platforms
  const patterns = [
    { platform: 'spotify', regex: /https?:\/\/(?:open\.)?spotify\.com\/show\/[a-zA-Z0-9]+[^\s"'<>]*/gi },
    { platform: 'youtube', regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@)[^\s"'<>]+/gi },
    { platform: 'youtube', regex: /https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=[^\s"'<>]+/gi },
    { platform: 'google', regex: /https?:\/\/podcasts\.google\.com\/feed\/[^\s"'<>]+/gi },
    { platform: 'amazon', regex: /https?:\/\/(?:music|www)\.amazon\.com\/podcasts\/[^\s"'<>]+/gi },
    { platform: 'audible', regex: /https?:\/\/(?:www\.)?audible\.com\/pd\/[^\s"'<>]+/gi },
    { platform: 'iheart', regex: /https?:\/\/(?:www\.)?iheart\.com\/podcast\/[^\s"'<>]+/gi },
    { platform: 'stitcher', regex: /https?:\/\/(?:www\.)?stitcher\.com\/[^\s"'<>]+/gi },
    { platform: 'tunein', regex: /https?:\/\/(?:www\.)?tunein\.com\/podcasts\/[^\s"'<>]+/gi },
    { platform: 'overcast', regex: /https?:\/\/(?:www\.)?overcast\.fm\/[^\s"'<>]+/gi },
    { platform: 'pocketcasts', regex: /https?:\/\/(?:pca\.st|pocketcasts\.com)\/[^\s"'<>]+/gi },
    { platform: 'castbox', regex: /https?:\/\/(?:www\.)?castbox\.fm\/[^\s"'<>]+/gi },
    { platform: 'podbean', regex: /https?:\/\/(?:www\.)?podbean\.com\/[^\s"'<>]+/gi },
    { platform: 'pandora', regex: /https?:\/\/(?:www\.)?pandora\.com\/podcast\/[^\s"'<>]+/gi },
    { platform: 'deezer', regex: /https?:\/\/(?:www\.)?deezer\.com\/(?:us\/)?show\/[^\s"'<>]+/gi },
    { platform: 'rumble', regex: /https?:\/\/(?:www\.)?rumble\.com\/(?:c|user)\/[^\s"'<>]+/gi },
  ];

  for (const { platform, regex } of patterns) {
    const match = text.match(regex);
    if (match && !platforms[platform]) {
      platforms[platform] = match[0];
    }
  }

  return platforms;
}

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

    const platforms: Record<string, string> = {};

    // Step 1: Try to fetch the RSS feed directly to extract links from description
    try {
      const rssResponse = await fetch(feedUrl, {
        headers: { 'User-Agent': 'ShoutOut/1.0' },
      });
      
      if (rssResponse.ok) {
        const rssText = await rssResponse.text();
        
        // Extract links from RSS description, link tags, and atom:link elements
        const extractedLinks = extractPlatformLinks(rssText);
        Object.assign(platforms, extractedLinks);
        
        // Also look for specific link patterns in the XML
        const linkMatches = rssText.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/gi) || [];
        linkMatches.forEach(linkTag => {
          const hrefMatch = linkTag.match(/href=["']([^"']+)["']/i);
          if (hrefMatch) {
            const extracted = extractPlatformLinks(hrefMatch[1]);
            Object.assign(platforms, { ...extracted, ...platforms }); // Don't override existing
          }
        });
      }
    } catch (rssError) {
      console.warn('Could not fetch RSS directly:', rssError);
    }

    // Step 2: Query PodcastIndex API for additional data
    const API_KEY = Deno.env.get('PODCASTINDEX_API_KEY');
    const API_SECRET = Deno.env.get('PODCASTINDEX_API_SECRET');

    if (API_KEY && API_SECRET) {
      try {
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

        if (response.ok) {
          const data = await response.json();
          const feed = data.feed;

          if (feed) {
            // Get Apple Podcasts ID
            if (feed.itunesId && !platforms.apple) {
              platforms.apple = `https://podcasts.apple.com/podcast/id${feed.itunesId}`;
            }
            
            // Extract from feed.link
            if (feed.link) {
              const linkPlatforms = extractPlatformLinks(feed.link);
              Object.assign(platforms, { ...linkPlatforms, ...platforms });
            }

            // Extract from description
            if (feed.description) {
              const descPlatforms = extractPlatformLinks(feed.description);
              Object.assign(platforms, { ...descPlatforms, ...platforms });
            }

            // Check funding tags for platform links
            if (feed.funding) {
              const fundingArray = Array.isArray(feed.funding) ? feed.funding : [feed.funding];
              fundingArray.forEach((funding: any) => {
                const url = funding.url || '';
                const fundingPlatforms = extractPlatformLinks(url);
                Object.assign(platforms, { ...fundingPlatforms, ...platforms });
              });
            }

            // Check value tags (podcast 2.0 features)
            if (feed.value) {
              const valueStr = JSON.stringify(feed.value);
              const valuePlatforms = extractPlatformLinks(valueStr);
              Object.assign(platforms, { ...valuePlatforms, ...platforms });
            }
          }
        }
      } catch (apiError) {
        console.warn('PodcastIndex API error:', apiError);
      }
    }

    console.log('Found platforms:', Object.keys(platforms));

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
