import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { talentId } = await req.json()

    if (!talentId) {
      throw new Error('Missing talentId')
    }

    // Verify talent belongs to user
    const { data: talent, error: talentError } = await supabaseClient
      .from('talent_profiles')
      .select('id, user_id, temp_full_name')
      .eq('id', talentId)
      .eq('user_id', user.id)
      .single()

    if (talentError || !talent) {
      throw new Error('Talent profile not found or unauthorized')
    }

    // Get user details
    const { data: userData } = await supabaseClient
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Get Veriff credentials
    const veriffApiKey = Deno.env.get('VERIFF_API_KEY')
    const veriffSecretKey = Deno.env.get('VERIFF_SECRET_KEY')

    if (!veriffApiKey || !veriffSecretKey) {
      throw new Error('Veriff credentials not configured')
    }

    console.log('Creating Veriff session for talent:', talentId)

    // Prepare Veriff session request
    const veriffPayload = {
      verification: {
        callback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/veriff-webhook`,
        person: {
          firstName: (userData?.full_name || talent.temp_full_name || '').split(' ')[0] || 'User',
          lastName: (userData?.full_name || talent.temp_full_name || '').split(' ').slice(1).join(' ') || '',
        },
        vendorData: talentId,
      }
    }

    const payloadString = JSON.stringify(veriffPayload)
    
    // Create HMAC signature
    const signature = createHmac('sha256', veriffSecretKey)
      .update(payloadString)
      .digest('hex')

    console.log('Sending request to Veriff API...')

    // Create Veriff session
    const veriffResponse = await fetch('https://stationapi.veriff.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': veriffApiKey,
        'X-HMAC-SIGNATURE': signature,
      },
      body: payloadString,
    })

    if (!veriffResponse.ok) {
      const errorText = await veriffResponse.text()
      console.error('Veriff API error:', errorText)
      throw new Error(`Failed to create Veriff session: ${veriffResponse.statusText}`)
    }

    const veriffData = await veriffResponse.json()
    console.log('Veriff session created:', veriffData.verification.id)

    // Store session in database using service role
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: upsertError } = await supabaseServiceClient
      .from('veriff_sessions')
      .upsert({
        talent_id: talentId,
        session_id: veriffData.verification.id,
        session_url: veriffData.verification.url,
        verification_code: veriffData.verification.code,
        status: 'created',
      }, {
        onConflict: 'talent_id'
      })

    if (upsertError) {
      console.error('Error storing Veriff session:', upsertError)
      throw new Error('Failed to store Veriff session')
    }

    return new Response(
      JSON.stringify({
        sessionId: veriffData.verification.id,
        sessionUrl: veriffData.verification.url,
        verificationCode: veriffData.verification.code,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Error creating Veriff session:', error)
    console.error('Error stack:', error.stack)
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack || error.toString(),
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})

