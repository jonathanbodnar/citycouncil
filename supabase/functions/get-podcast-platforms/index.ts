// Edge function to get podcast platform links
// Uses PodcastIndex API for Apple Podcasts and Spotify search for Spotify links

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to search Spotify's public podcast catalog
async function searchSpotifyPodcast(podcastTitle: string): Promise<string | null> {
  try {
    // Use Spotify's public search page and extract show ID from the response
    // This is a public endpoint that doesn't require authentication
    const searchQuery = encodeURIComponent(podcastTitle);
    const spotifySearchUrl = `https://api.spotify.com/v1/search?q=${searchQuery}&type=show&limit=5`;
    
    // We need a Spotify access token - get one using client credentials
    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      // Get access token
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
        },
        body: 'grant_type=client_credentials',
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        // Search for podcast
        const searchResponse = await fetch(spotifySearchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.shows?.items?.length > 0) {
            // Find best match by comparing titles
            const normalizedTitle = podcastTitle.toLowerCase().trim();
            
            for (const show of searchData.shows.items) {
              const showTitle = show.name.toLowerCase().trim();
              // Check for exact or close match
              if (showTitle === normalizedTitle || 
                  showTitle.includes(normalizedTitle) || 
                  normalizedTitle.includes(showTitle)) {
                console.log(`Spotify match found: "${show.name}" for "${podcastTitle}"`);
                return show.external_urls?.spotify || `https://open.spotify.com/show/${show.id}`;
              }
            }
            
            // If no exact match, return first result if title is reasonably similar
            const firstShow = searchData.shows.items[0];
            const similarity = calculateSimilarity(podcastTitle, firstShow.name);
            if (similarity > 0.5) {
              console.log(`Spotify partial match: "${firstShow.name}" (${(similarity * 100).toFixed(0)}% similar)`);
              return firstShow.external_urls?.spotify || `https://open.spotify.com/show/${firstShow.id}`;
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Spotify search error:', error);
    return null;
  }
}

// Simple string similarity function (Jaccard index on words)
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Helper to fetch podcast title from RSS feed directly
async function getPodcastTitleFromRSS(feedUrl: string): Promise<string | null> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'ShoutOut/1.0' },
    });
    
    if (response.ok) {
      const xml = await response.text();
      // Extract title from RSS XML
      const titleMatch = xml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const title = titleMatch[1].trim();
        console.log('Got podcast title from RSS:', title);
        return title;
      }
    }
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
  }
  return null;
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

    // Step 1: Query PodcastIndex API for Apple Podcasts ID and podcast info
    const API_KEY = Deno.env.get('PODCASTINDEX_API_KEY');
    const API_SECRET = Deno.env.get('PODCASTINDEX_API_SECRET');

    let podcastTitle = '';
    let itunesId = '';

    if (API_KEY && API_SECRET) {
      try {
        // PodcastIndex API authentication
        const apiTime = Math.floor(Date.now() / 1000);
        const data4Hash = API_KEY + API_SECRET + apiTime;
        
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data4Hash);
        const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const authHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Search for podcast by feed URL
        const searchUrl = `https://api.podcastindex.org/api/1.0/podcasts/byfeedurl?url=${encodeURIComponent(feedUrl)}`;
        
        console.log('Querying PodcastIndex:', searchUrl);
        
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
          console.log('PodcastIndex response status:', data.status);
          
          const feed = data.feed;

          if (feed) {
            podcastTitle = feed.title || '';
            console.log('Podcast title from PodcastIndex:', podcastTitle);
            
            // Get Apple Podcasts ID from PodcastIndex
            if (feed.itunesId) {
              itunesId = feed.itunesId.toString();
              platforms.apple = `https://podcasts.apple.com/podcast/id${feed.itunesId}`;
              console.log('Found Apple Podcasts:', platforms.apple);
            }
          }
        } else {
          console.error('PodcastIndex API error:', response.status);
        }
      } catch (apiError) {
        console.error('PodcastIndex API error:', apiError);
      }
    }

    // Step 1b: If PodcastIndex didn't return a title, try to get it from the RSS feed directly
    if (!podcastTitle) {
      console.log('PodcastIndex did not return title, fetching from RSS...');
      const rssTitle = await getPodcastTitleFromRSS(feedUrl);
      if (rssTitle) {
        podcastTitle = rssTitle;
      }
    }

    // Step 2: Search Spotify for the podcast using the title we got
    if (podcastTitle && !platforms.spotify) {
      console.log('Searching Spotify for:', podcastTitle);
      const spotifyUrl = await searchSpotifyPodcast(podcastTitle);
      if (spotifyUrl) {
        platforms.spotify = spotifyUrl;
        console.log('Found Spotify:', spotifyUrl);
      }
    }

    // Step 3: Try to get YouTube Music / other platforms via direct search
    // YouTube podcasts can be found via YouTube search with "podcast" keyword
    if (podcastTitle) {
      // Add YouTube search link (not direct, but useful)
      platforms.youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(podcastTitle + ' podcast')}`;
      
      // Add Amazon Music podcast link
      platforms.amazon = `https://music.amazon.com/search/${encodeURIComponent(podcastTitle)}?filter=IsInPodcasts`;
      
      // Add iHeartRadio search
      platforms.iheart = `https://www.iheart.com/search/podcasts/?q=${encodeURIComponent(podcastTitle)}`;
    }

    // Step 4: Use ListenNotes as additional source (if we have the API key)
    const LISTENNOTES_KEY = Deno.env.get('LISTENNOTES_API_KEY');
    
    if (LISTENNOTES_KEY && podcastTitle) {
      try {
        const listenNotesUrl = `https://listen-api.listennotes.com/api/v2/search?q=${encodeURIComponent(podcastTitle)}&type=podcast&only_in=title`;
        
        console.log('Querying ListenNotes:', listenNotesUrl);
        
        const lnResponse = await fetch(listenNotesUrl, {
          headers: {
            'X-ListenAPI-Key': LISTENNOTES_KEY,
          },
        });

        if (lnResponse.ok) {
          const lnData = await lnResponse.json();
          
          if (lnData.results && lnData.results.length > 0) {
            const podcast = lnData.results[0];
            console.log('ListenNotes found:', podcast.title);
            
            // ListenNotes provides listen_notes_url which has all platform links
            if (podcast.listennotes_url) {
              platforms.listennotes = podcast.listennotes_url;
            }
            
            // They also provide some direct links - these override search URLs
            if (podcast.spotify_url) {
              platforms.spotify = podcast.spotify_url;
            }
            if (podcast.youtube_url) {
              platforms.youtube = podcast.youtube_url;
            }
          }
        }
      } catch (lnError) {
        console.warn('ListenNotes API error:', lnError);
      }
    }

    console.log('Final platforms found:', Object.keys(platforms));

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
