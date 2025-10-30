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
    uploadFormData.append('api_key', cloudinaryApiKey)
    uploadFormData.append('timestamp', Math.floor(Date.now() / 1000).toString())
    
    // Create signature for authenticated upload (required for transformations)
    const timestamp = Math.floor(Date.now() / 1000)
    const paramsToSign = `timestamp=${timestamp}${cloudinaryApiSecret}`
    
    // For now, use unsigned upload with transformation URL parameter
    // Build transformation string: overlay logo, position top-left, 60% opacity
    const transformation = 'l_shoutout_logo_jruflu,g_north_west,x_10,y_10,w_120,o_60'
    
    uploadFormData.append('upload_preset', 'shoutout_watermarked')
    uploadFormData.append('transformation', transformation)

    console.log('Uploading to Cloudinary with transformation:', transformation)

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/video/upload`,
      {
        method: 'POST',
        body: uploadFormData
      }
    )

    if (!cloudinaryResponse.ok) {
      const error = await cloudinaryResponse.text()
      console.error('Cloudinary error:', error)
      throw new Error('Failed to watermark video via Cloudinary')
    }

    const cloudinaryData = await cloudinaryResponse.json()
    const watermarkedUrl = cloudinaryData.secure_url

    console.log('Watermarked video created:', watermarkedUrl)

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

