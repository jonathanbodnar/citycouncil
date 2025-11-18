import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify user is admin
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (userDataError || userData?.user_type !== 'admin') {
      throw new Error('Unauthorized - Admin access required')
    }

    // Get w9Id from query params
    const url = new URL(req.url)
    const w9Id = url.searchParams.get('w9Id')

    if (!w9Id) {
      throw new Error('Missing w9Id parameter')
    }

    // Fetch W-9 data
    const { data: w9Data, error: w9Error } = await supabaseClient
      .from('w9_forms')
      .select(`
        *,
        talent_profiles!inner(
          id,
          users!inner(
            full_name,
            email
          )
        )
      `)
      .eq('id', w9Id)
      .single()

    if (w9Error || !w9Data) {
      throw new Error('W-9 not found')
    }

    // Generate HTML for W-9
    const html = generateW9Html(w9Data)

    // Return HTML (in production, you'd convert this to PDF using a service)
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="w9-${w9Data.name.replace(/[^a-z0-9]/gi, '_')}.html"`,
      },
      status: 200,
    })
  } catch (error) {
    console.error('Error in generate-w9-pdf-download:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

function generateW9Html(w9Data: any): string {
  const taxClassificationMap: Record<string, string> = {
    individual: 'Individual/Sole Proprietor or Single-member LLC',
    c_corporation: 'C Corporation',
    s_corporation: 'S Corporation',
    partnership: 'Partnership',
    trust_estate: 'Trust/Estate',
    llc_c: 'Limited Liability Company (taxed as C Corp)',
    llc_s: 'Limited Liability Company (taxed as S Corp)',
    llc_p: 'Limited Liability Company (taxed as Partnership)',
    other: w9Data.other_tax_classification || 'Other',
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form W-9 - ${w9Data.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0;
      font-size: 14px;
      color: #666;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .field {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    .label {
      font-weight: bold;
      color: #555;
      display: inline-block;
      min-width: 200px;
    }
    .value {
      display: inline-block;
      color: #000;
    }
    .signature {
      margin-top: 30px;
      padding: 20px;
      border: 2px solid #333;
      border-radius: 8px;
    }
    .signature img {
      max-width: 300px;
      height: auto;
      border: 1px solid #ddd;
      padding: 10px;
      background: white;
    }
    .certification {
      margin: 20px 0;
      padding: 15px;
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      font-size: 12px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Form W-9</h1>
    <p>Request for Taxpayer Identification Number and Certification</p>
    <p>Department of the Treasury - Internal Revenue Service</p>
  </div>

  <div class="section">
    <h3>Taxpayer Information</h3>
    <div class="field">
      <span class="label">Name:</span>
      <span class="value">${w9Data.name}</span>
    </div>
    ${w9Data.business_name ? `
    <div class="field">
      <span class="label">Business Name:</span>
      <span class="value">${w9Data.business_name}</span>
    </div>
    ` : ''}
    <div class="field">
      <span class="label">Federal Tax Classification:</span>
      <span class="value">${taxClassificationMap[w9Data.tax_classification] || w9Data.tax_classification}</span>
    </div>
    ${w9Data.exempt_payee_code ? `
    <div class="field">
      <span class="label">Exempt Payee Code:</span>
      <span class="value">${w9Data.exempt_payee_code}</span>
    </div>
    ` : ''}
    ${w9Data.exemption_from_fatca_code ? `
    <div class="field">
      <span class="label">Exemption from FATCA Code:</span>
      <span class="value">${w9Data.exemption_from_fatca_code}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h3>Address</h3>
    <div class="field">
      <span class="label">Address Line 1:</span>
      <span class="value">${w9Data.address_line1}</span>
    </div>
    ${w9Data.address_line2 ? `
    <div class="field">
      <span class="label">Address Line 2:</span>
      <span class="value">${w9Data.address_line2}</span>
    </div>
    ` : ''}
    <div class="field">
      <span class="label">City:</span>
      <span class="value">${w9Data.city}</span>
    </div>
    <div class="field">
      <span class="label">State:</span>
      <span class="value">${w9Data.state}</span>
    </div>
    <div class="field">
      <span class="label">ZIP Code:</span>
      <span class="value">${w9Data.zip_code}</span>
    </div>
  </div>

  <div class="section">
    <h3>Taxpayer Identification Number</h3>
    <div class="field">
      <span class="value">*** SSN/EIN is encrypted and not stored in database for security ***</span>
    </div>
  </div>

  <div class="certification">
    <strong>Certification</strong><br><br>
    Under penalties of perjury, I certify that:<br>
    1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and<br>
    2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and<br>
    3. I am a U.S. citizen or other U.S. person; and<br>
    4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.
  </div>

  <div class="signature">
    <div class="label">Signature:</div>
    <img src="${w9Data.signature_data_url}" alt="Signature" />
    <div class="field">
      <span class="label">Date:</span>
      <span class="value">${new Date(w9Data.signature_date).toLocaleDateString()}</span>
    </div>
  </div>

  <div class="footer">
    <p>Submitted via ShoutOut Platform on ${new Date(w9Data.created_at).toLocaleString()}</p>
    <p>Talent: ${w9Data.talent_profiles.users.full_name} (${w9Data.talent_profiles.users.email})</p>
    <p>W-9 ID: ${w9Data.id}</p>
  </div>
</body>
</html>
  `
}

