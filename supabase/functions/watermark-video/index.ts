import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoUrl, orderId, talentName } = await req.json()

    if (!videoUrl) {
      throw new Error('videoUrl is required')
    }

    console.log('Watermarking video:', videoUrl)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if we already have a watermarked version cached
    const { data: cached, error: cacheError } = await supabase
      .from('watermarked_videos_cache')
      .select('cloudinary_url')
      .eq('original_video_url', videoUrl)
      .single()

    if (!cacheError && cached?.cloudinary_url) {
      console.log('Using cached watermarked video:', cached.cloudinary_url)
      return new Response(
        JSON.stringify({ watermarkedUrl: cached.cloudinary_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For now, we'll use Cloudinary as the watermarking service
    // This is more reliable than running FFmpeg in edge functions
    const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY')
    const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      // If Cloudinary not configured, return original URL with warning
      console.warn('Cloudinary not configured, returning original video')
      return new Response(
        JSON.stringify({ 
          watermarkedUrl: videoUrl,
          warning: 'Watermarking not configured - returning original video'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Upload to Cloudinary with watermark transformation
    const uploadFormData = new FormData()
    
    // Fetch the video file
    const videoResponse = await fetch(videoUrl)
    const videoBlob = await videoResponse.blob()
    
    uploadFormData.append('file', videoBlob)
    uploadFormData.append('upload_preset', 'shoutout_watermarked')
    
    // Note: Watermark transformation is configured in the upload preset:
    // l_shoutout_logo_jruflu,g_north_west,x_10,y_10,w_240,o_60
    // (240px width, top-left corner, 60% opacity)
    console.log('Uploading to Cloudinary with preset: shoutout_watermarked')

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/video/upload`,
      {
        method: 'POST',
        body: uploadFormData
      }
    )

    if (!cloudinaryResponse.ok) {
      const error = await cloudinaryResponse.text()
      console.error('Cloudinary upload failed:', {
        status: cloudinaryResponse.status,
        statusText: cloudinaryResponse.statusText,
        error: error
      })
      return new Response(
        JSON.stringify({ 
          error: `Cloudinary error (${cloudinaryResponse.status}): ${error}`,
          watermarkedUrl: videoUrl,
          warning: 'Watermarking failed - returning original video'
        }),
        { 
          status: 200, // Return 200 so frontend can handle gracefully
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const cloudinaryData = await cloudinaryResponse.json()
    
    if (!cloudinaryData.secure_url) {
      console.error('No secure_url in Cloudinary response:', cloudinaryData)
      return new Response(
        JSON.stringify({ 
          watermarkedUrl: videoUrl,
          warning: 'Watermarking incomplete - returning original video'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const watermarkedUrl = cloudinaryData.secure_url

    console.log('Watermarked video created:', watermarkedUrl)

    // Cache the watermarked URL for future requests
    try {
      await supabase
        .from('watermarked_videos_cache')
        .upsert({
          original_video_url: videoUrl,
          cloudinary_url: watermarkedUrl,
          cloudinary_public_id: cloudinaryData.public_id,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'original_video_url'
        })
      console.log('Cached watermarked URL for future use')
    } catch (cacheError) {
      console.warn('Failed to cache watermarked URL:', cacheError)
      // Don't fail the request if caching fails
    }

    return new Response(
      JSON.stringify({ watermarkedUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error watermarking video:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to watermark video'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

