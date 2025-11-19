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
    const clientId = Deno.env.get('SIGNNOW_CLIENT_ID')
    const clientSecret = Deno.env.get('SIGNNOW_CLIENT_SECRET')
    const templateId = Deno.env.get('SIGNNOW_TEMPLATE_ID')

    if (!clientId || !clientSecret || !templateId) {
      throw new Error('SignNow credentials not configured')
    }

    console.log('Getting SignNow access token...')

    // Get access token using OAuth
    const tokenResponse = await fetch('https://api.signnow.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: '*',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('SignNow token error:', errorText)
      throw new Error(`Failed to get SignNow access token: ${tokenResponse.statusText}`)
    }

    const { access_token } = await tokenResponse.json()
    console.log('Access token obtained')

    // Create document from template
    console.log('Creating document from template:', templateId)
    
    const createDocResponse = await fetch(`https://api.signnow.com/template/${templateId}/copy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
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

    // Create embedded signing invite
    console.log('Creating embedded signing invite...')
    
    const inviteResponse = await fetch(`https://api.signnow.com/document/${documentId}/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [
          {
            email: userData?.email || user.email,
            role_id: '',
            role: 'Signer',
            order: 1,
            authentication_type: 'none',
            expiration_days: 30,
            reminder: 0,
          },
        ],
        from: 'noreply@shoutout.us',
        subject: 'Please complete your W-9 form',
        message: 'Please review and sign the W-9 form.',
      }),
    })

    if (!inviteResponse.ok) {
      const errorText = await inviteResponse.text()
      console.error('SignNow invite error:', errorText)
      throw new Error(`Failed to create signing invite: ${inviteResponse.statusText}`)
    }

    const inviteData = await inviteResponse.json()
    console.log('Invite created:', inviteData)

    // Generate embedded signing link
    console.log('Generating embedded signing link...')
    
    const linkResponse = await fetch(`https://api.signnow.com/link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
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

