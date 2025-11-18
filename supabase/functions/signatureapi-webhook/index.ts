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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const webhookData = await req.json()
    console.log('SignatureAPI webhook received:', webhookData)

    const { event, envelope } = webhookData

    // Handle completed envelope
    if (event === 'envelope.completed') {
      const envelopeId = envelope.id
      const talentId = envelope.metadata?.talent_id
      const signedDocumentUrl = envelope.documents?.[0]?.url

      if (!envelopeId || !talentId || !signedDocumentUrl) {
        throw new Error('Missing required data from webhook')
      }

      // Update envelope status
      const { error: envelopeError } = await supabaseClient
        .from('w9_envelopes')
        .update({
          status: 'completed',
          signed_document_url: signedDocumentUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('envelope_id', envelopeId)

      if (envelopeError) {
        console.error('Error updating envelope:', envelopeError)
        throw new Error('Failed to update envelope status')
      }

      // Create W-9 form record (for compatibility with existing system)
      // Extract data from the signed PDF if needed, or mark as completed
      const { error: w9Error } = await supabaseClient
        .from('w9_forms')
        .insert({
          talent_id: talentId,
          name: envelope.recipients?.[0]?.name || 'Unknown',
          // Address fields would need to be extracted from PDF or passed in metadata
          address_line1: '',
          city: '',
          state: '',
          zip_code: '',
          tax_classification: 'individual', // Default, would need to be extracted
          signature_data_url: '', // Signature is in the PDF
          signature_date: new Date().toISOString(),
          pdf_storage_url: signedDocumentUrl,
          pdf_generated_at: new Date().toISOString(),
        })
        .onConflict('talent_id')
        .ignoreDuplicates()

      if (w9Error) {
        console.error('Error creating W-9 record:', w9Error)
      }

      // Update talent profile onboarding status
      const { error: profileError } = await supabaseClient
        .from('talent_profiles')
        .update({
          payout_onboarding_w9_completed: true,
        })
        .eq('id', talentId)

      if (profileError) {
        console.error('Error updating talent profile:', profileError)
      }
    }

    // Handle other events
    if (event === 'envelope.declined' || event === 'envelope.expired') {
      const envelopeId = envelope.id

      await supabaseClient
        .from('w9_envelopes')
        .update({
          status: event === 'envelope.declined' ? 'declined' : 'expired',
        })
        .eq('envelope_id', envelopeId)
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Error processing SignatureAPI webhook:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
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

