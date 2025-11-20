import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hmac-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Veriff secret key for signature verification
    const veriffSecretKey = Deno.env.get('VERIFF_SECRET_KEY')
    if (!veriffSecretKey) {
      throw new Error('Veriff secret key not configured')
    }

    // Get request body
    const body = await req.text()
    const signature = req.headers.get('x-hmac-signature') || req.headers.get('x-signature')

    // Verify signature
    if (signature) {
      const expectedSignature = createHmac('sha256', veriffSecretKey)
        .update(body)
        .digest('hex')

      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error('Invalid signature')
        throw new Error('Invalid webhook signature')
      }
    }

    const webhookData = JSON.parse(body)
    console.log('Veriff webhook received:', webhookData.action || 'unknown action')

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle different webhook events
    const verificationId = webhookData.verification?.id || webhookData.id
    const status = webhookData.verification?.status || webhookData.status
    const action = webhookData.action

    if (!verificationId) {
      console.log('No verification ID in webhook')
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the session from database
    const { data: session, error: sessionError } = await supabaseServiceClient
      .from('veriff_sessions')
      .select('talent_id, status')
      .eq('session_id', verificationId)
      .maybeSingle()

    if (sessionError || !session) {
      console.log('Session not found:', verificationId)
      return new Response(JSON.stringify({ received: true, error: 'Session not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Found session for talent:', session.talent_id, 'Action:', action, 'Status:', status)

    // Update session status based on webhook
    let updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'started') {
      updateData.status = 'started'
    } else if (action === 'submitted') {
      updateData.status = 'submitted'
    } else if (status === 'approved' || action === 'approved') {
      updateData.status = 'approved'
      updateData.decision_time = new Date().toISOString()
      
      // Extract person data if available
      if (webhookData.verification?.person) {
        const person = webhookData.verification.person
        updateData.person_id_code = person.idNumber
        updateData.person_given_name = person.firstName
        updateData.person_last_name = person.lastName
        updateData.person_date_of_birth = person.dateOfBirth
        updateData.person_country = person.nationality
      }
      
      // Extract document data if available
      if (webhookData.verification?.document) {
        const doc = webhookData.verification.document
        updateData.document_type = doc.type
        updateData.document_number = doc.number
      }
    } else if (status === 'declined' || action === 'declined') {
      updateData.status = 'declined'
      updateData.decision_time = new Date().toISOString()
    } else if (status === 'resubmission_requested') {
      updateData.status = 'resubmission_requested'
    } else if (status === 'expired') {
      updateData.status = 'expired'
    } else if (action === 'abandoned') {
      updateData.status = 'abandoned'
    }

    // Update session in database
    const { error: updateError } = await supabaseServiceClient
      .from('veriff_sessions')
      .update(updateData)
      .eq('session_id', verificationId)

    if (updateError) {
      console.error('Error updating session:', updateError)
      throw updateError
    }

    // If approved, update talent profile
    if (updateData.status === 'approved') {
      console.log('Marking talent as verified:', session.talent_id)
      
      const { error: profileError } = await supabaseServiceClient
        .from('talent_profiles')
        .update({
          veriff_verified: true,
          veriff_verified_at: new Date().toISOString(),
        })
        .eq('id', session.talent_id)

      if (profileError) {
        console.error('Error updating talent profile:', profileError)
      } else {
        console.log('Talent profile updated successfully')
      }
    }

    console.log('Webhook processed successfully')

    return new Response(
      JSON.stringify({ received: true, status: updateData.status }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Error processing Veriff webhook:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        received: true,
      }),
      {
        status: 200, // Return 200 to prevent retries for invalid data
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})

