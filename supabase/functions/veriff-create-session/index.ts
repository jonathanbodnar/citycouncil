import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple JWT decode (doesn't verify signature - we trust Supabase's edge runtime)
function decodeJwt(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Get the JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header')
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    // Decode the JWT to get user ID
    const payload = decodeJwt(token)
    console.log('JWT payload sub:', payload?.sub)
    
    if (!payload?.sub) {
      throw new Error('Invalid token - no user ID found')
    }
    
    const userId = payload.sub
    
    // Use service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user exists and get their data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()
    
    if (userError || !userData) {
      console.error('User not found:', userError?.message)
      throw new Error('User not found')
    }
    
    console.log('User verified:', userId)

    const { talentId } = await req.json()
    console.log('Request talentId:', talentId)

    if (!talentId) {
      throw new Error('Missing talentId')
    }

    // Verify talent belongs to user
    const { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id, user_id, temp_full_name')
      .eq('id', talentId)
      .eq('user_id', userId)
      .single()

    if (talentError || !talent) {
      console.error('Talent lookup failed:', talentError?.message)
      throw new Error('Talent profile not found or does not belong to this user')
    }

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
        callback: `${supabaseUrl}/functions/v1/veriff-webhook`,
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

    // Store session in database
    const { error: upsertError } = await supabase
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

    console.log('Veriff session stored successfully')

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
