// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Load secrets inside request handler (required for Supabase Edge Functions)
    // @ts-ignore
    const PLAID_CLIENT_ID = (globalThis as any).Deno?.env.get('PLAID_CLIENT_ID')
    // @ts-ignore
    const PLAID_SECRET = (globalThis as any).Deno?.env.get('PLAID_SECRET')
    // @ts-ignore
    const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL')
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('Environment check:', { 
      hasPlaidClientId: !!PLAID_CLIENT_ID, 
      hasPlaidSecret: !!PLAID_SECRET,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
    })

    // Validate credentials
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      console.error('Missing Plaid credentials')
      throw new Error('Plaid credentials not configured')
    }

    const body = await req.json()
    const { userId } = body
    console.log('Received request for userId:', userId)
    
    if (!userId) throw new Error('User ID is required')

    // Get user data from Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    console.log('Fetching user data...')
    
    const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError) {
      console.error('Auth user lookup error:', authError)
    }
    const authUser = authUserData?.user
    console.log('Auth user found:', { email: authUser?.email, id: authUser?.id })
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle()
    if (userError) {
      console.error('Users table lookup error:', userError)
    }
    console.log('User data found:', { phone: userData?.phone })
    
    const { data: talentProfile, error: talentError } = await supabase
      .from('talent_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle()
    if (talentError) {
      console.error('Talent profile lookup error:', talentError)
    }
    console.log('Talent profile found:', { full_name: talentProfile?.full_name })

    // Format phone number for Plaid (remove all non-digits, ensure 10 digits)
    let phoneNumber = null
    if (userData?.phone) {
      const cleaned = userData.phone.replace(/[^\d]/g, '')
      let digits = cleaned
      if (digits.startsWith('1') && digits.length === 11) {
        digits = digits.slice(1)
      }
      if (digits.length === 10) {
        phoneNumber = digits
      }
      console.log('Phone processing:', { original: userData.phone, cleaned, digits, final: phoneNumber })
    }

    // Parse full name
    let givenName = ''
    let familyName = ''
    if (talentProfile?.full_name) {
      const nameParts = talentProfile.full_name.trim().split(' ')
      givenName = nameParts[0] || ''
      familyName = nameParts.slice(1).join(' ') || ''
    }

    // Build user object for Plaid
    // NOTE: user.name is NOT allowed for 'auth' product - only for identity_verification, protect, assets
    const plaidUser: any = { 
      client_user_id: userId,
    }
    
    if (authUser?.email) {
      plaidUser.email_address = authUser.email
    }
    
    if (phoneNumber && phoneNumber.length === 10) {
      plaidUser.phone_number = phoneNumber
    }
    
    // DO NOT include user.name - Plaid rejects it for 'auth' product

    const tokenRequest = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      user: plaidUser,
      client_name: 'ShoutOut',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
    }

    console.log('Calling Plaid API with request:', JSON.stringify({
      ...tokenRequest,
      client_id: '***',
      secret: '***'
    }))

    // Use direct fetch instead of SDK
    const plaidResponse = await fetch('https://production.plaid.com/link/token/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenRequest),
    })

    const responseText = await plaidResponse.text()
    console.log('Plaid API response status:', plaidResponse.status)
    console.log('Plaid API response:', responseText.substring(0, 500))

    if (!plaidResponse.ok) {
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { raw: responseText }
      }
      console.error('Plaid API error:', errorData)
      throw new Error(errorData?.error_message || `Plaid API error: ${plaidResponse.status}`)
    }

    const data = JSON.parse(responseText)
    console.log('Successfully created link token')

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in plaid-create-link-token:', error?.message || error)
    console.error('Error stack:', error?.stack)

    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to initialize bank connection. Please try again.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
