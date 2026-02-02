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
    console.log('🔍 Admin impersonation request received')
    
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
      console.error('❌ Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace('Bearer ', '')
    
    // Decode the JWT to get user ID (we trust the token was signed by Supabase)
    let adminUserId: string
    try {
      // Split JWT and decode payload
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      adminUserId = payload.sub
      
      if (!adminUserId) {
        throw new Error('No user ID in token')
      }
      
      console.log('✅ Token decoded, user ID:', adminUserId)
    } catch (error) {
      console.error('❌ Failed to decode token:', error)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin using the decoded user ID
    const { data: adminData, error: adminCheckError } = await supabaseAdmin
      .from('users')
      .select('user_type, email, full_name')
      .eq('id', adminUserId)
      .single()

    if (adminCheckError) {
      console.error('❌ Failed to check admin status:', adminCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status', details: adminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (adminData?.user_type !== 'admin') {
      console.error('❌ User is not admin:', adminData?.user_type)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required', user_type: adminData?.user_type }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Admin status confirmed for:', adminData.email)

    // Get target user ID and action from request
    const { userId, phone, email, action } = await req.json()
    console.log('🎯 Request:', { userId, phone, email, action })

    // Handle fix-auth action - lookup by phone or email
    if (action === 'fix-auth') {
      console.log('🔧 Fix auth action requested')
      
      // Find user in public.users
      let publicUser: any = null
      
      if (email) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .single()
        publicUser = data
      }
      
      if (!publicUser && phone) {
        // Format phone
        const digits = phone.replace(/\D/g, '')
        const formattedPhone = digits.length === 10 ? `+1${digits}` : 
          (digits.length === 11 && digits.startsWith('1')) ? `+${digits}` : 
          phone.startsWith('+') ? phone : `+${digits}`
        
        const { data } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('phone', formattedPhone)
          .single()
        publicUser = data
      }
      
      if (!publicUser) {
        return new Response(
          JSON.stringify({ error: 'User not found in database', searchedFor: { phone, email } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('✅ Found public user:', publicUser.id, publicUser.email)
      
      // Check if user exists in auth.users
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(publicUser.id)
      
      // Also check by email
      let authUserByEmail: any = null
      if (publicUser.email) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
        authUserByEmail = authUsers?.users?.find((u: any) => u.email === publicUser.email)
      }
      
      console.log('Auth check:', { byId: !!authUser?.user, byEmail: authUserByEmail?.id })
      
      // Generate random password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
      let tempPassword = ''
      for (let i = 0; i < 32; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      
      let result: any = { publicUser: { id: publicUser.id, email: publicUser.email, phone: publicUser.phone } }
      
      // Case 1: Auth user exists with same ID
      if (authUser?.user) {
        console.log('Resetting password for existing auth user')
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.user.id,
          { password: tempPassword, email_confirm: true }
        )
        
        if (updateError) {
          result.error = `Failed to reset password: ${updateError.message}`
        } else {
          result.fixed = true
          result.method = 'password_reset'
        }
      }
      // Case 2: Auth user exists by email with different ID
      else if (authUserByEmail && authUserByEmail.id !== publicUser.id) {
        console.log('Syncing IDs - auth has different ID than public')
        const oldId = publicUser.id
        const newId = authUserByEmail.id
        
        // Update public.users
        await supabaseAdmin.from('users').upsert({
          id: newId,
          email: publicUser.email,
          phone: publicUser.phone,
          full_name: publicUser.full_name,
          user_type: publicUser.user_type,
          promo_source: publicUser.promo_source,
        })
        
        // Update related tables
        for (const table of ['orders', 'talent_profiles', 'reviews', 'talent_followers']) {
          await supabaseAdmin.from(table).update({ user_id: newId }).eq('user_id', oldId)
        }
        
        // Delete old record
        await supabaseAdmin.from('users').delete().eq('id', oldId)
        
        // Reset password
        await supabaseAdmin.auth.admin.updateUserById(newId, { password: tempPassword, email_confirm: true })
        
        result.fixed = true
        result.method = 'id_sync'
        result.oldId = oldId
        result.newId = newId
      }
      // Case 3: No auth user - create one
      else {
        console.log('Creating new auth user')
        const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: publicUser.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: publicUser.full_name,
            phone: publicUser.phone,
            user_type: publicUser.user_type,
          }
        })
        
        if (createError) {
          result.error = `Failed to create auth user: ${createError.message}`
        } else if (newAuthUser?.user) {
          // Sync IDs if different
          if (newAuthUser.user.id !== publicUser.id) {
            const oldId = publicUser.id
            const newId = newAuthUser.user.id
            
            await supabaseAdmin.from('users').upsert({
              id: newId,
              email: publicUser.email,
              phone: publicUser.phone,
              full_name: publicUser.full_name,
              user_type: publicUser.user_type,
              promo_source: publicUser.promo_source,
            })
            
            for (const table of ['orders', 'talent_profiles', 'reviews', 'talent_followers']) {
              await supabaseAdmin.from(table).update({ user_id: newId }).eq('user_id', oldId)
            }
            
            await supabaseAdmin.from('users').delete().eq('id', oldId)
            
            result.oldId = oldId
            result.newId = newId
          }
          result.fixed = true
          result.method = 'created_auth'
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Standard impersonate flow
    if (!userId) {
      console.error('❌ Missing userId parameter')
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate an access token for the target user using admin API
    console.log('📝 Fetching target user...')
    const { data: targetUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !targetUserData.user) {
      console.error('❌ User not found:', userError)
      return new Response(
        JSON.stringify({ error: 'User not found', details: userError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Target user found:', targetUserData.user.email)

    // Generate an access token for the target user
    // Use the admin API to generate a temporary link that contains tokens
    console.log('🔑 Generating magic link...')
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserData.user.email!
    })

    if (linkError || !linkData) {
      console.error('❌ Link generation error:', linkError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate session', details: linkError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Magic link generated:', linkData.properties.action_link)

    // Extract tokens from the generated link
    // Tokens might be in query params or hash fragment
    const linkUrl = linkData.properties.action_link
    let access_token = null
    let refresh_token = null

    // Try query parameters first
    const url = new URL(linkUrl)
    access_token = url.searchParams.get('access_token')
    refresh_token = url.searchParams.get('refresh_token')

    // If not in query params, try hash fragment
    if (!access_token && url.hash) {
      const hashParams = new URLSearchParams(url.hash.substring(1))
      access_token = hashParams.get('access_token')
      refresh_token = hashParams.get('refresh_token')
    }

    // If still not found, the link data might contain tokens directly
    if (!access_token && linkData.properties.hashed_token) {
      console.log('🔍 Link contains hashed_token, trying different approach...')
      // For magic links, we need to verify the token to get session
      const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink'
      })
      
      if (verifyError || !verifyData.session) {
        console.error('❌ Failed to verify magic link token:', verifyError)
        return new Response(
          JSON.stringify({ error: 'Failed to verify magic link', details: verifyError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      access_token = verifyData.session.access_token
      refresh_token = verifyData.session.refresh_token
    }

    if (!access_token || !refresh_token) {
      console.error('❌ Failed to extract tokens. Link structure:', { linkUrl, hash: url.hash, linkData })
      return new Response(
        JSON.stringify({ error: 'Failed to extract tokens from generated link', debug: { linkUrl } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Tokens extracted successfully')

    const sessionData = {
      access_token,
      refresh_token,
      user: targetUserData.user
    }

    // Log the impersonation for audit trail
    console.log('📊 Logging to audit trail...')
    try {
      await supabaseAdmin
        .from('admin_audit_log')
        .insert({
          admin_id: adminUserId,
          action: 'impersonate_user',
          target_user_id: userId,
          metadata: {
            admin_email: adminData.email,
            target_email: targetUserData.user.email,
            timestamp: new Date().toISOString()
          }
        })
    } catch (err) {
      console.error('⚠️ Audit log error (non-fatal):', err)
    }

    console.log('🎉 Impersonation successful!')

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

