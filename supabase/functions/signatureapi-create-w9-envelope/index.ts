import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      .select('id, user_id')
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

    // Create SignatureAPI envelope
    const signatureApiKey = Deno.env.get('SIGNATUREAPI_KEY')
    if (!signatureApiKey) {
      throw new Error('SignatureAPI key not configured')
    }

    const requestBody = {
      title: `Form W-9 - ${userData?.full_name || user.email}`,
      routing: 'sequential',
      sender: {
        name: 'ShoutOut',
        email: 'noreply@shoutout.us',
      },
      documents: [
        {
          url: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf',
          format: 'pdf',
        },
      ],
      recipients: [
        {
          type: 'signer',
          key: 'talent',
          name: userData?.full_name || 'Talent',
          email: userData?.email || user.email,
        },
      ],
      metadata: {
        talent_id: talentId,
        user_id: user.id,
      },
    }

    console.log('Creating SignatureAPI envelope with body:', JSON.stringify(requestBody, null, 2))

    const signatureApiResponse = await fetch('https://api.signatureapi.com/v1/envelopes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': signatureApiKey,
      },
      body: JSON.stringify(requestBody),
    })

    console.log('SignatureAPI response status:', signatureApiResponse.status)

    if (!signatureApiResponse.ok) {
      const errorData = await signatureApiResponse.text()
      console.error('SignatureAPI error response:', errorData)
      throw new Error(`SignatureAPI error (${signatureApiResponse.status}): ${errorData}`)
    }

    const envelopeData = await signatureApiResponse.json()

    // Store envelope reference in database
    const { error: insertError } = await supabaseClient
      .from('w9_envelopes')
      .insert({
        talent_id: talentId,
        envelope_id: envelopeData.id,
        status: 'pending',
        signing_url: envelopeData.signingUrl || envelopeData.signing_url,
      })

    if (insertError) {
      console.error('Error storing envelope:', insertError)
      throw new Error('Failed to store envelope reference')
    }

    return new Response(
      JSON.stringify({
        envelopeId: envelopeData.id,
        signingUrl: envelopeData.signingUrl || envelopeData.signing_url,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Error creating W-9 envelope:', error)
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

