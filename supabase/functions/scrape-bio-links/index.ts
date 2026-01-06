import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedLink {
  title: string;
  url: string;
  thumbnail_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, talent_id, import_id } = await req.json();

    if (!url || !talent_id) {
      return new Response(
        JSON.stringify({ error: 'URL and talent_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect platform
    let platform = 'unknown';
    if (url.includes('linktr.ee')) platform = 'linktree';
    else if (url.includes('beacons.ai')) platform = 'beacons';
    else if (url.includes('stan.store')) platform = 'stan';
    else if (url.includes('bio.link')) platform = 'biolink';
    else if (url.includes('linkpop.com')) platform = 'linkpop';
    else if (url.includes('campsite.bio')) platform = 'campsite';
    else if (url.includes('lnk.bio')) platform = 'lnkbio';

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    const links: ScrapedLink[] = [];

    // Extract links based on platform
    if (platform === 'linktree') {
      // Linktree uses data attributes and specific classes
      const linkMatches = html.matchAll(/data-testid="LinkButton"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/gi);
      for (const match of linkMatches) {
        links.push({
          url: match[1],
          title: match[2].trim(),
        });
      }

      // Also try to extract from JSON data
      const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const pageProps = data?.props?.pageProps;
          if (pageProps?.links) {
            for (const link of pageProps.links) {
              if (link.url && link.title) {
                links.push({
                  url: link.url,
                  title: link.title,
                  thumbnail_url: link.thumbnail,
                });
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse Linktree JSON:', e);
        }
      }
    } else if (platform === 'beacons') {
      // Beacons stores data in window.__PRELOADED_STATE__
      const stateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/);
      if (stateMatch) {
        try {
          const data = JSON.parse(stateMatch[1]);
          // Navigate to links in the state
          const blocks = data?.page?.blocks || [];
          for (const block of blocks) {
            if (block.type === 'link' && block.url) {
              links.push({
                url: block.url,
                title: block.title || 'Link',
                thumbnail_url: block.image,
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse Beacons state:', e);
        }
      }
    } else {
      // Generic extraction - look for common patterns
      // Try to find links in anchor tags with common bio link patterns
      const genericMatches = html.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class="[^"]*(?:link|button|btn)[^"]*"[^>]*>[\s\S]*?(?:<span[^>]*>|<p[^>]*>)?([^<]+)/gi);
      for (const match of genericMatches) {
        const url = match[1];
        const title = match[2]?.trim();
        if (url && title && !url.includes('javascript:') && title.length < 100) {
          links.push({ url, title });
        }
      }

      // Also try to find JSON-LD or embedded data
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
      if (jsonLdMatch) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data.mainEntity?.itemListElement) {
            for (const item of data.mainEntity.itemListElement) {
              if (item.url && item.name) {
                links.push({
                  url: item.url,
                  title: item.name,
                });
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse JSON-LD:', e);
        }
      }
    }

    // Deduplicate links
    const uniqueLinks = links.filter((link, index, self) =>
      index === self.findIndex(l => l.url === link.url)
    );

    // Get existing links count for display_order
    const { data: existingLinks } = await supabase
      .from('bio_links')
      .select('display_order')
      .eq('talent_id', talent_id)
      .order('display_order', { ascending: false })
      .limit(1);

    let startOrder = (existingLinks?.[0]?.display_order ?? -1) + 1;

    // Insert links
    const linksToInsert = uniqueLinks.map((link, index) => ({
      talent_id,
      link_type: 'basic',
      title: link.title,
      url: link.url,
      thumbnail_url: link.thumbnail_url,
      display_order: startOrder + index,
      is_active: true,
    }));

    if (linksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('bio_links')
        .insert(linksToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    // Update import history
    if (import_id) {
      await supabase
        .from('bio_import_history')
        .update({
          status: 'completed',
          source_platform: platform,
          imported_links_count: linksToInsert.length,
        })
        .eq('id', import_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: linksToInsert.length,
        platform,
        links: linksToInsert,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to scrape links' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});




