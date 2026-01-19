// Edge function to get podcast platform links
// Uses PodcastIndex API for Apple Podcasts and pod.link for cross-platform discovery

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
          console.log('PodcastIndex response:', JSON.stringify(data, null, 2));
          
          const feed = data.feed;

          if (feed) {
            podcastTitle = feed.title || '';
            
            // Get Apple Podcasts ID from PodcastIndex
            if (feed.itunesId) {
              itunesId = feed.itunesId.toString();
              platforms.apple = `https://podcasts.apple.com/podcast/id${feed.itunesId}`;
              console.log('Found Apple Podcasts:', platforms.apple);
            }
          }
        } else {
          console.error('PodcastIndex API error:', response.status, await response.text());
        }
      } catch (apiError) {
        console.error('PodcastIndex API error:', apiError);
      }
    }

    // Step 2: Use pod.link to find other platforms (Spotify, YouTube, etc.)
    // pod.link is a free service that aggregates podcast links across all platforms
    try {
      // Encode the RSS URL for pod.link lookup
      const podLinkUrl = `https://pod.link/api/link?url=${encodeURIComponent(feedUrl)}`;
      
      console.log('Querying pod.link:', podLinkUrl);
      
      const podLinkResponse = await fetch(podLinkUrl, {
        headers: { 
          'User-Agent': 'ShoutOut/1.0',
          'Accept': 'application/json'
        },
      });

      if (podLinkResponse.ok) {
        const podLinkData = await podLinkResponse.json();
        console.log('pod.link response:', JSON.stringify(podLinkData, null, 2));
        
        // pod.link returns links object with platform keys
        if (podLinkData.links) {
          const linkMap: Record<string, string> = {
            'spotify': 'spotify',
            'apple': 'apple', 
            'google': 'google',
            'youtube': 'youtube',
            'amazon': 'amazon',
            'overcast': 'overcast',
            'pocketcasts': 'pocketcasts',
            'castbox': 'castbox',
            'stitcher': 'stitcher',
            'iheart': 'iheart',
            'tunein': 'tunein',
            'deezer': 'deezer',
            'pandora': 'pandora',
            'podchaser': 'podchaser',
            'jiosaavn': 'jiosaavn',
            'audible': 'audible',
            'gaana': 'gaana',
            'podcast_addict': 'podcastaddict',
            'player_fm': 'playerfm',
            'podcast_republic': 'podcastrepublic',
          };

          for (const [podLinkKey, ourKey] of Object.entries(linkMap)) {
            if (podLinkData.links[podLinkKey] && !platforms[ourKey]) {
              platforms[ourKey] = podLinkData.links[podLinkKey];
              console.log(`Found ${ourKey}:`, platforms[ourKey]);
            }
          }
        }

        // Also check for direct URL property
        if (podLinkData.url && !platforms.podlink) {
          platforms.podlink = podLinkData.url; // Universal pod.link URL
        }
      } else {
        console.warn('pod.link API returned:', podLinkResponse.status);
      }
    } catch (podLinkError) {
      console.warn('pod.link API error:', podLinkError);
    }

    // Step 3: If pod.link didn't work, try ListenNotes as fallback (if we have the API key)
    const LISTENNOTES_KEY = Deno.env.get('LISTENNOTES_API_KEY');
    
    if (LISTENNOTES_KEY && Object.keys(platforms).length <= 1 && podcastTitle) {
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
            
            // They also provide some direct links
            if (podcast.spotify_url && !platforms.spotify) {
              platforms.spotify = podcast.spotify_url;
            }
            if (podcast.youtube_url && !platforms.youtube) {
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
