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

    // Get SignNow credentials
    const signNowEmail = Deno.env.get('SIGNNOW_EMAIL')
    const signNowPassword = Deno.env.get('SIGNNOW_PASSWORD')
    const signNowClientId = Deno.env.get('SIGNNOW_CLIENT_ID')
    const signNowClientSecret = Deno.env.get('SIGNNOW_CLIENT_SECRET')
    const templateId = Deno.env.get('SIGNNOW_TEMPLATE_ID')

    if (!signNowEmail || !signNowPassword || !signNowClientId || !signNowClientSecret || !templateId) {
      throw new Error('SignNow credentials not configured. Need: SIGNNOW_EMAIL, SIGNNOW_PASSWORD, SIGNNOW_CLIENT_ID, SIGNNOW_CLIENT_SECRET, and SIGNNOW_TEMPLATE_ID')
    }

    console.log('Authenticating with SignNow...')
    console.log('Using email:', signNowEmail)
    console.log('Client ID length:', signNowClientId?.length)
    console.log('Client Secret length:', signNowClientSecret?.length)
    
    // Create Basic Auth header for client credentials
    const basicAuth = btoa(`${signNowClientId}:${signNowClientSecret}`)
    
    const authBody = new URLSearchParams({
      grant_type: 'password',
      username: signNowEmail,
      password: signNowPassword,
    })
    
    console.log('Auth request body:', authBody.toString())
    
    // Get access token via OAuth password grant with client credentials
    const authResponse = await fetch('https://api.signnow.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: authBody,
    })

    console.log('Auth response status:', authResponse.status)
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('SignNow auth error response:', errorText)
      console.error('Auth response headers:', Object.fromEntries(authResponse.headers.entries()))
      throw new Error(`Failed to authenticate with SignNow (${authResponse.status}): ${errorText}`)
    }

    const authData = await authResponse.json()
    console.log('Auth response keys:', Object.keys(authData))
    
    const accessToken = authData.access_token
    if (!accessToken) {
      console.error('No access_token in response:', authData)
      throw new Error('No access token received from SignNow')
    }
    
    console.log('Successfully authenticated with SignNow')
    console.log('Access token length:', accessToken.length)
    console.log('Template ID:', templateId)

    // Create document from template
    console.log('Creating document from template:', templateId)
    
    const createDocResponse = await fetch(`https://api.signnow.com/template/${templateId}/copy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_name: `W-9 Form - ${userData?.full_name || user.email}`,
      }),
    })

    if (!createDocResponse.ok) {
      const errorText = await createDocResponse.text()
      console.error('SignNow create document error:', errorText)
      throw new Error(`Failed to create document from template: ${createDocResponse.statusText}`)
    }

    const { id: documentId } = await createDocResponse.json()
    console.log('Document created:', documentId)

    // Generate embedded signing link directly (no invite needed for embedded)
    console.log('Generating embedded signing link...')
    
    const linkResponse = await fetch(`https://api.signnow.com/link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        link_expiration: 30, // days
      }),
    })

    if (!linkResponse.ok) {
      const errorText = await linkResponse.text()
      console.error('SignNow link error:', errorText)
      throw new Error(`Failed to generate signing link: ${linkResponse.statusText}`)
    }

    const { url: signingUrl } = await linkResponse.json()
    console.log('Signing URL generated:', signingUrl)

    // Store document reference in database
    const { error: insertError } = await supabaseClient
      .from('w9_envelopes')
      .insert({
        talent_id: talentId,
        envelope_id: documentId,
        status: 'pending',
        signing_url: signingUrl,
      })

    if (insertError) {
      console.error('Error storing document:', insertError)
      throw new Error('Failed to store document reference')
    }

    return new Response(
      JSON.stringify({
        documentId: documentId,
        signingUrl: signingUrl,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Error creating W-9 document:', error)
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

