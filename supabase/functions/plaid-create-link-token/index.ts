// @ts-ignore - Deno std import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import
import { PlaidApi, Configuration, PlaidEnvironments } from 'npm:plaid'
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

    // Validate credentials
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      console.error('Missing Plaid credentials:', { 
        hasClientId: !!PLAID_CLIENT_ID, 
        hasSecret: !!PLAID_SECRET 
      })
      throw new Error('Plaid credentials not configured')
    }

    // Initialize Plaid client inside request handler
    const config = new Configuration({
      basePath: PlaidEnvironments.production,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    })
    const plaidClient = new PlaidApi(config)

    const { userId } = await req.json()
    if (!userId) throw new Error('User ID is required')

    // Get user data from Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const { data: userData } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle()
    
    const { data: talentProfile } = await supabase
      .from('talent_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // Format phone number for Plaid (remove all non-digits, ensure 10 digits)
    let phoneNumber = null
    if (userData?.phone) {
      // Remove +, spaces, dashes, parentheses, etc.
      const cleaned = userData.phone.replace(/[^\d]/g, '')
      // Remove country code if present (handles +1, 1, etc.)
      let digits = cleaned
      if (digits.startsWith('1') && digits.length === 11) {
        digits = digits.slice(1)
      }
      // Only use if exactly 10 digits
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

    const tokenRequest: any = {
      user: { 
        client_user_id: userId,
      },
      client_name: 'ShoutOut',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
    }

    // Only add user data if we have valid information
    // IMPORTANT: Only send email/phone/name if they are valid, otherwise omit them entirely
    if (authUser?.email) {
      tokenRequest.user.email_address = authUser.email
    }
    
    // Only send phone if it's EXACTLY 10 digits (Plaid requirement)
    if (phoneNumber && phoneNumber.length === 10) {
      tokenRequest.user.phone_number = phoneNumber
    }
    
    // Only send name if both parts exist
    if (givenName && familyName) {
      tokenRequest.user.name = {
        given_name: givenName,
        family_name: familyName,
      }
    }

    console.log('Creating Plaid link token with user data:', {
      userId,
      email: authUser?.email || 'none',
      phone: phoneNumber || 'none',
      name: `${givenName} ${familyName}`.trim() || 'none'
    })

    const response = await plaidClient.linkTokenCreate(tokenRequest)

    return new Response(JSON.stringify(response.data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    // Log detailed error information
    const errorDetails = {
      message: error?.message,
      responseData: error?.response?.data,
      responseStatus: error?.response?.status,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n')
    }
    console.error('Plaid Link Token Error:', JSON.stringify(errorDetails, null, 2))

    // Return user-friendly error
    const userMessage = error?.response?.data?.error_message 
      || error?.message 
      || 'Failed to initialize bank connection. Please try again.'

    return new Response(
      JSON.stringify({
        error: userMessage,
        details: error?.response?.data || null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
