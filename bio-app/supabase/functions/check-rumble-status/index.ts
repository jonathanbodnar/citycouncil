// Supabase Edge Function to check Rumble live status for all talents
// Schedule this to run every 15 minutes via pg_cron or external scheduler

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RumbleData {
  is_live: boolean
  live_viewers: number
  latest_video_title: string
  latest_video_thumbnail: string
  latest_video_url: string
  latest_video_views: number
  channel_url: string
}

async function scrapeRumbleChannel(rumbleHandle: string): Promise<RumbleData | null> {
  const cleanHandle = rumbleHandle.replace(/^@/, '')
  
  // Try both /user/ and /c/ URL formats
  const urlFormats = [
    `https://rumble.com/user/${cleanHandle}`,
    `https://rumble.com/c/${cleanHandle}`,
  ]
  
  let html = ''
  let channelUrl = ''
  
  for (const url of urlFormats) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      
      if (response.ok) {
        const text = await response.text()
        // Check if we got actual video content
        if (text.includes('thumbnail__image') || text.includes('video-item')) {
          html = text
          channelUrl = url
          break
        }
      }
    } catch (e) {
      console.log(`Failed to fetch ${url}:`, e)
    }
  }
  
  if (!html) {
    console.log(`Could not fetch Rumble data for ${rumbleHandle}`)
    return null
  }
  
  // Check for live stream
  const isLive = html.includes('is-live') || html.includes('status--live') || html.includes('livestream-item')
  
  // Extract live viewers if live
  let liveViewers = 0
  if (isLive) {
    const watchingMatch = html.match(/(\d[\d,]*)\s*(?:watching|viewers)/i)
    if (watchingMatch) {
      liveViewers = parseInt(watchingMatch[1].replace(/,/g, '')) || 0
    }
  }
  
  // Extract first video thumbnail
  const thumbnailMatch = html.match(/src="(https:\/\/[^"]*(?:rmbl|1a-1791)[^"]*(?:small|thumb)[^"]*)"/i)
  const thumbnail = thumbnailMatch ? thumbnailMatch[1] : ''
  
  // Extract video title - look for thumbnail__title or title attribute
  const titleMatch = html.match(/title="([^"]{10,200})"[^>]*>\s*(?:<[^>]+>)*\s*([^<]+)/i) ||
                     html.match(/class="thumbnail__title[^"]*"[^>]*>([^<]+)/i)
  const title = titleMatch ? (titleMatch[2] || titleMatch[1]).trim() : 'Latest Video'
  
  // Extract video URL
  const videoUrlMatch = html.match(/href="(\/v[^"]+\.html)/i)
  let videoUrl = channelUrl
  if (videoUrlMatch) {
    videoUrl = `https://rumble.com${videoUrlMatch[1].split('?')[0]}`
  }
  
  // Extract views - look for data-views attribute
  const viewsMatch = html.match(/data-views="(\d+)"/) ||
                     html.match(/(\d[\d,]*[KkMm]?)\s*views/i)
  let views = 0
  if (viewsMatch) {
    const viewStr = viewsMatch[1].replace(/,/g, '')
    if (viewStr.toLowerCase().includes('k')) {
      views = Math.round(parseFloat(viewStr) * 1000)
    } else if (viewStr.toLowerCase().includes('m')) {
      views = Math.round(parseFloat(viewStr) * 1000000)
    } else {
      views = parseInt(viewStr) || 0
    }
  }
  
  return {
    is_live: isLive,
    live_viewers: liveViewers,
    latest_video_title: title,
    latest_video_thumbnail: thumbnail,
    latest_video_url: videoUrl,
    latest_video_views: views,
    channel_url: channelUrl,
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all talent profiles with rumble_handle
    const { data: talents, error: talentsError } = await supabase
      .from('talent_profiles')
      .select('id, rumble_handle')
      .not('rumble_handle', 'is', null)
      .neq('rumble_handle', '')
    
    if (talentsError) {
      throw new Error(`Failed to fetch talents: ${talentsError.message}`)
    }
    
    if (!talents || talents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No talents with Rumble handles found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Checking Rumble status for ${talents.length} talents...`)
    
    const results: { talent_id: string; success: boolean; is_live?: boolean }[] = []
    
    // Process each talent (with some delay to avoid rate limiting)
    for (const talent of talents) {
      try {
        const rumbleData = await scrapeRumbleChannel(talent.rumble_handle)
        
        if (rumbleData) {
          // Upsert the cache entry
          const { error: upsertError } = await supabase
            .from('rumble_cache')
            .upsert({
              talent_id: talent.id,
              rumble_handle: talent.rumble_handle,
              is_live: rumbleData.is_live,
              live_viewers: rumbleData.live_viewers,
              latest_video_title: rumbleData.latest_video_title,
              latest_video_thumbnail: rumbleData.latest_video_thumbnail,
              latest_video_url: rumbleData.latest_video_url,
              latest_video_views: rumbleData.latest_video_views,
              channel_url: rumbleData.channel_url,
              last_checked_at: new Date().toISOString(),
            }, {
              onConflict: 'talent_id',
            })
          
          if (upsertError) {
            console.error(`Failed to update cache for ${talent.id}:`, upsertError)
            results.push({ talent_id: talent.id, success: false })
          } else {
            results.push({ talent_id: talent.id, success: true, is_live: rumbleData.is_live })
            console.log(`Updated ${talent.rumble_handle}: live=${rumbleData.is_live}, viewers=${rumbleData.live_viewers}`)
          }
        } else {
          results.push({ talent_id: talent.id, success: false })
        }
        
        // Small delay between requests to be nice to Rumble
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (e) {
        console.error(`Error processing ${talent.rumble_handle}:`, e)
        results.push({ talent_id: talent.id, success: false })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const liveCount = results.filter(r => r.is_live).length
    
    return new Response(
      JSON.stringify({
        message: `Checked ${talents.length} channels, ${successCount} successful, ${liveCount} currently live`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


