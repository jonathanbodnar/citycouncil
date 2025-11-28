import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header to verify admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: adminData, error: adminCheckError } = await supabaseAdmin
      .from('users')
      .select('user_type')
      .eq('id', adminUser.id)
      .single()

    if (adminCheckError || adminData?.user_type !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get target user ID from request
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate an access token for the target user using admin API
    const { data: targetUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !targetUserData.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate an access token for the target user
    // Use the admin API to generate a temporary link that contains tokens
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserData.user.email!
    })

    if (linkError || !linkData) {
      console.error('Link generation error:', linkError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate session', details: linkError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract tokens from the generated link
    const url = new URL(linkData.properties.action_link)
    const access_token = url.searchParams.get('access_token')
    const refresh_token = url.searchParams.get('refresh_token')

    if (!access_token || !refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract tokens from generated link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sessionData = {
      access_token,
      refresh_token,
      user: targetUserData.user
    }

    // Log the impersonation for audit trail
    await supabaseAdmin
      .from('admin_audit_log')
      .insert({
        admin_id: adminUser.id,
        action: 'impersonate_user',
        target_user_id: userId,
        metadata: {
          admin_email: adminUser.email,
          target_email: targetUserData.user.email,
          timestamp: new Date().toISOString()
        }
      })
      .catch(err => console.error('Audit log error:', err))

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        user: {
          id: targetUserData.user.id,
          email: targetUserData.user.email
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-impersonate function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

