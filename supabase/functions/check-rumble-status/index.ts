// Supabase Edge Function to check Rumble live status for all talents
// Schedule this to run every 15 minutes via pg_cron
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RumbleVideoData {
  title: string
  thumbnail: string
  url: string
  views: number
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

// Extract all videos from Rumble HTML
function extractAllVideos(html: string, channelUrl: string): RumbleVideoData[] {
  const videos: RumbleVideoData[] = []
  
  // Strip style and script tags
  const htmlClean = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  // Find all video entries - each video has thumbnail__image and thumbnail__title
  // Match video blocks that contain thumbnail data
  const videoBlockRegex = /<article[^>]*class="[^"]*video-listing-entry[^"]*"[^>]*>[\s\S]*?<\/article>/gi
  const videoBlocks = htmlClean.match(videoBlockRegex) || []
  
  // Also try listing items if article blocks don't work
  if (videoBlocks.length === 0) {
    // Try matching individual thumbnails with their associated data
    const thumbRegex = /<a[^>]*class="[^"]*thumbnail[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*class="[^"]*thumbnail__image[^"]*"[^>]*src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*thumbnail__title[^"]*"[^>]*title="([^"]+)"/gi
    let match
    while ((match = thumbRegex.exec(htmlClean)) !== null) {
      const url = match[1].startsWith('http') ? match[1] : `https://rumble.com${match[1].split('?')[0]}`
      videos.push({
        title: match[3].trim(),
        thumbnail: match[2],
        url: url,
        views: 0
      })
    }
  }
  
  // Try another pattern - look for href + thumbnail pairs
  if (videos.length === 0) {
    // Pattern: Find thumbnail images and extract their container's href
    const thumbSrcRegex = /src="(https:\/\/1a-1791\.com\/video\/[^"]*-small-[^"]*\.(jpg|jpeg|webp|png))"/gi
    const thumbs: string[] = []
    let thumbMatch
    while ((thumbMatch = thumbSrcRegex.exec(htmlClean)) !== null) {
      thumbs.push(thumbMatch[1])
    }
    
    // Find all video URLs
    const urlRegex = /href="(\/v[a-z0-9]+-[^"]+\.html)/gi
    const urls: string[] = []
    let urlMatch
    while ((urlMatch = urlRegex.exec(htmlClean)) !== null) {
      const fullUrl = `https://rumble.com${urlMatch[1].split('?')[0]}`
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl)
      }
    }
    
    // Find all titles
    const titleRegex = /class="thumbnail__title[^"]*"[^>]*title="([^"]{10,200})"/gi
    const titles: string[] = []
    let titleMatch
    while ((titleMatch = titleRegex.exec(htmlClean)) !== null) {
      titles.push(titleMatch[1].trim())
    }
    
    // Combine (best effort - they should be in the same order on the page)
    const minLen = Math.min(thumbs.length, urls.length, titles.length)
    for (let i = 0; i < minLen; i++) {
      videos.push({
        title: titles[i],
        thumbnail: thumbs[i],
        url: urls[i],
        views: 0
      })
    }
  }
  
  return videos
}

async function scrapeRumbleChannel(rumbleHandle: string, rumbleType: string = 'c', titleFilter?: string | null): Promise<RumbleData | null> {
  const cleanHandle = rumbleHandle.replace(/^@/, '')
  
  // Try both /user/ and /c/ URL formats based on rumble_type
  const urlFormats = rumbleType === 'user' 
    ? [`https://rumble.com/user/${cleanHandle}`, `https://rumble.com/c/${cleanHandle}`]
    : [`https://rumble.com/c/${cleanHandle}`, `https://rumble.com/user/${cleanHandle}`]
  
  let html = ''
  let channelUrl = ''
  
  // Try CORS proxies since Rumble blocks direct server requests
  for (const url of urlFormats) {
    const corsProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    ]
    
    for (const proxyUrl of corsProxies) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const text = await response.text()
          // Check if we got actual video content
          if (text.includes('thumbnail__image') || text.includes('thumbnail__title') || 
              text.includes('1a-1791.com') || text.includes('rmbl.ws')) {
            html = text
            channelUrl = url
            break
          }
        }
      } catch (e) {
        // Continue to next proxy
      }
    }
    if (html) break
  }
  
  if (!html) {
    console.log(`Could not fetch Rumble data for ${rumbleHandle}`)
    return null
  }
  
  // Extract all videos
  const allVideos = extractAllVideos(html, channelUrl)
  console.log(`Found ${allVideos.length} videos for ${rumbleHandle}`)
  
  // Filter videos by title if filter is specified
  let filteredVideos = allVideos
  if (titleFilter && titleFilter.trim()) {
    const filterLower = titleFilter.toLowerCase()
    filteredVideos = allVideos.filter(v => v.title.toLowerCase().includes(filterLower))
    console.log(`After filtering by '${titleFilter}': ${filteredVideos.length} videos`)
  }
  
  // Get the first (latest) video that matches the filter
  const latestVideo = filteredVideos.length > 0 ? filteredVideos[0] : (allVideos.length > 0 ? allVideos[0] : null)
  
  // Strip style and script tags for live status check
  const htmlClean = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  // Check for live stream - look for specific live indicator classes in HTML elements
  const isLive = !!(htmlClean.match(/class="[^"]*videostream__status--live[^"]*"/i) ||
                    htmlClean.match(/class="[^"]*thumbnail__thumb--live[^"]*"/i))
  
  // Extract live viewers if live
  let liveViewers = 0
  if (isLive) {
    const watchingMatch = htmlClean.match(/(\d[\d,]*)\s*(?:watching|viewers)/i)
    if (watchingMatch) {
      liveViewers = parseInt(watchingMatch[1].replace(/,/g, '')) || 0
    }
  }
  
  // Fallback thumbnail extraction if no videos were found
  let thumbnail = latestVideo?.thumbnail || ''
  if (!thumbnail) {
    const thumbMatch = htmlClean.match(/src="(https:\/\/1a-1791\.com\/video\/[^"]*-small-[^"]*\.(jpg|jpeg|webp|png))"/i)
    if (thumbMatch) {
      thumbnail = thumbMatch[1]
    } else {
      // Try OG image as fallback
      const ogMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i) ||
                      html.match(/content="([^"]+)"[^>]*property="og:image"/i)
      if (ogMatch) {
        thumbnail = ogMatch[1]
      }
    }
  }
  
  // Fallback title
  let title = latestVideo?.title || 'Latest Video'
  if (title === 'Latest Video') {
    const titleMatch = htmlClean.match(/class="thumbnail__title[^"]*"[^>]*title="([^"]{10,200})"/i)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }
  }
  
  // Fallback video URL
  let videoUrl = latestVideo?.url || channelUrl
  if (videoUrl === channelUrl) {
    const videoUrlMatch = htmlClean.match(/href="(\/v[a-z0-9]+-[^"]+\.html)/i)
    if (videoUrlMatch) {
      videoUrl = `https://rumble.com${videoUrlMatch[1].split('?')[0]}`
    }
  }
  
  // Extract views
  let views = latestVideo?.views || 0
  if (views === 0) {
    const viewsMatch = htmlClean.match(/data-views="(\d+)"/) ||
                       htmlClean.match(/(\d[\d,]*)\s*views/i) ||
                       htmlClean.match(/(\d+\.?\d*[KkMm])\s*views/i)
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
    
    // Get all talent profiles with rumble_handle (now also fetching rumble_title_filter)
    const { data: talents, error: talentsError } = await supabase
      .from('talent_profiles')
      .select('id, rumble_handle, rumble_type, rumble_title_filter')
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
    
    const results: { talent_id: string; handle: string; success: boolean; is_live?: boolean; title?: string; filter?: string }[] = []
    
    // Process each talent (with some delay to avoid rate limiting)
    for (const talent of talents) {
      try {
        // Pass the title filter to the scraper
        const rumbleData = await scrapeRumbleChannel(
          talent.rumble_handle, 
          talent.rumble_type || 'c',
          talent.rumble_title_filter
        )
        
        if (rumbleData && (rumbleData.latest_video_thumbnail || rumbleData.latest_video_title !== 'Latest Video')) {
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
            console.error(`Failed to update cache for ${talent.rumble_handle}:`, upsertError)
            results.push({ talent_id: talent.id, handle: talent.rumble_handle, success: false })
          } else {
            results.push({ 
              talent_id: talent.id, 
              handle: talent.rumble_handle, 
              success: true, 
              is_live: rumbleData.is_live, 
              title: rumbleData.latest_video_title,
              filter: talent.rumble_title_filter || undefined
            })
            console.log(`Updated ${talent.rumble_handle}${talent.rumble_title_filter ? ` (filter: ${talent.rumble_title_filter})` : ''}: live=${rumbleData.is_live}, title=${rumbleData.latest_video_title.substring(0, 50)}...`)
          }
        } else {
          console.log(`No data found for ${talent.rumble_handle}`)
          results.push({ talent_id: talent.id, handle: talent.rumble_handle, success: false })
        }
        
        // Small delay between requests to be nice to proxies
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (e) {
        console.error(`Error processing ${talent.rumble_handle}:`, e)
        results.push({ talent_id: talent.id, handle: talent.rumble_handle, success: false })
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
    
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
