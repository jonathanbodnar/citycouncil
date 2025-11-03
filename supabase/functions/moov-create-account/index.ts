// @ts-ignore - Deno std import for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno npm import is resolved at runtime in Edge Functions
import { Moov } from 'npm:@moovio/sdk'
// @ts-ignore - Deno ESM import for Supabase client in Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Read from Supabase secrets
// @ts-ignore - available at runtime in Edge Functions
const MOOV_PUBLIC_KEY =
  (globalThis as any).Deno?.env.get('MOOV_PUBLIC_KEY') || 'rEvCk_pOVqe5Pi73'
// @ts-ignore - available at runtime in Edge Functions
const MOOV_SECRET_KEY =
  (globalThis as any).Deno?.env.get('MOOV_SECRET_KEY') ||
  'odUP-ZAPFaA1WMZqSh6ioi4qEeJBvn-z'
const MOOV_VERSION = 'v2024.01.00'

// Supabase env
// @ts-ignore - available at runtime in Edge Functions
const SUPABASE_URL = "https://utafetamgwukkbrlezev.supabase.co"
// @ts-ignore - available at runtime in Edge Functions
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjgzMDAsImV4cCI6MjA3NTQ0NDMwMH0.6ycEWh2sLck45S8zjzNU0GqHTu_P1hh86YvP43E-Jk4"
// @ts-ignore - available at runtime in Edge Functions
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZldGFtZ3d1a2ticmxlemV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg2ODMwMCwiZXhwIjoyMDc1NDQ0MzAwfQ.bmjLfmsX3_wYxjyHZzFoVhZ4XxJvqbH8DIfpHTXVrKQ"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type'
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. ⭐ Read all the data from your React form
    const payload = await req.json().catch(() => ({}))
    const {
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      city,
      stateOrProvince,
      postalCode,
      month,
      day,
      year,
      ssn
    } = payload

    // 2. ⭐ Validate the new required data
    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !addressLine1 ||
      !city ||
      !stateOrProvince ||
      !postalCode ||
      !month ||
      !day ||
      !year ||
      !ssn
    ) {
      throw new Error('Missing required fields in the request body')
    }

    const moov = new Moov({
      xMoovVersion: MOOV_VERSION,
      security: { username: MOOV_PUBLIC_KEY, password: MOOV_SECRET_KEY }
    })

    // 3. ⭐ Build the COMPLETE request from the payload
    const createRequest = {
      accountType: 'individual',
      profile: {
        individual: {
          name: {
            firstName: firstName,
            lastName: lastName
          },
          email: email,
          phone: {
            number: phone,
            countryCode: '1'
          },
          // --- ADDING THE NEW KYC DATA ---
          address: {
            addressLine1: addressLine1,
            city: city,
            stateOrProvince: stateOrProvince,
            postalCode: postalCode,
            country: 'US' // Hardcoding US
          },
          birthDate: {
            day: parseInt(day, 10),
            month: parseInt(month, 10),
            year: parseInt(year, 10)
          },
          governmentID: {
            ssn: {
              full: ssn
            }
          }
        }
      }
    }

    console.log(
      'Attempting to create account with FULL user data:',
      createRequest
    )

    // Pass the full object to the SDK
    const response = await moov.accounts.create(createRequest)
    const account = (response as any)?.result

    if (!account?.accountID) {
      console.error('Moov create account unexpected response:', response)
      return new Response(
        JSON.stringify({
          error: 'Failed to create account',
          details: response
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Try to persist Moov account ID to DB (best-effort)
    try {
      // Get current user from the JWT on the request
      let userId: string | null = null
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const userClient = createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
        )
        const { data: authData } = await userClient.auth.getUser()
        userId = authData?.user?.id || null
      }

      if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // Update talent_profiles.moov_account_id for this user (if profile exists)
        const { error: updErr } = await admin
          .from('talent_profiles')
          .update({ moov_account_id: account.accountID })
          .eq('user_id', userId)

        if (updErr) {
          console.error('Failed to update talent_profiles.moov_account_id:', updErr)
        }
      }
    } catch (persistErr) {
      console.error('Persistence error (moov_account_id):', persistErr)
    }

    // Success!
    console.log('Successfully created account:', account)
    return new Response(JSON.stringify(account), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Moov Create Account Error:', error.message)
    if (error.response) {
      console.error(
        'Error Response Body:',
        await error.response.json().catch(() => 'no json body')
      )
    }
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
