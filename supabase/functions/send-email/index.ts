// Supabase Edge Function for sending emails via Mailgun
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, from = 'ShoutOut <noreply@mail.shoutout.us>' }: EmailRequest = await req.json()

    // Get Mailgun credentials from environment
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mail.shoutout.us'

    if (!MAILGUN_API_KEY) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    // Prepare form data for Mailgun
    const formData = new FormData()
    formData.append('from', from)
    formData.append('to', to)
    formData.append('subject', subject)
    formData.append('html', html)

    // Send email via Mailgun API
    const mailgunUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`
    const auth = btoa(`api:${MAILGUN_API_KEY}`)

    const response = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Mailgun API Error:', errorText)
      throw new Error(`Mailgun API error: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Email sent successfully:', { to, subject, messageId: result.id })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: result.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

