import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ⚠️ Hardcoded credentials (temporary for testing)
const MOOV_PUBLIC_KEY = 'RDQltedQqpLetVgT'
const MOOV_SECRET_KEY = 'PcMntzPLXIalWPkryyeI4M52azDFxaNo'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const credentials = btoa(`${MOOV_PUBLIC_KEY}:${MOOV_SECRET_KEY}`)

    const body = new URLSearchParams()
    body.append('grant_type', 'client_credentials')
    body.append('scope', '/accounts.write')

    const response = await fetch('https://api.moov.io/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Moov Error:', result)
      return new Response(JSON.stringify(result), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
