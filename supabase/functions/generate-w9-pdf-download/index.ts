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
    const { data: adminData, error: adminDataError } = await supabaseClient
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (adminDataError || adminData?.user_type !== 'admin') {
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
      .select('*')
      .eq('id', w9Id)
      .single()

    if (w9Error || !w9Data) {
      console.error('Error fetching W-9:', w9Error)
      throw new Error('W-9 not found')
    }

    // Fetch talent profile separately
    const { data: talentData, error: talentError } = await supabaseClient
      .from('talent_profiles')
      .select('id, user_id')
      .eq('id', w9Data.talent_id)
      .single()

    if (talentError || !talentData) {
      console.error('Error fetching talent:', talentError)
      throw new Error('Talent profile not found')
    }

    // Fetch user data
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('full_name, email')
      .eq('id', talentData.user_id)
      .single()

    if (userDataError || !userData) {
      console.error('Error fetching user:', userDataError)
      throw new Error('User not found')
    }

    // Combine the data
    w9Data.talent_profiles = {
      id: talentData.id,
      users: userData
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
    individual: 'Individual/sole proprietor or single-member LLC',
    c_corporation: 'C Corporation',
    s_corporation: 'S Corporation',
    partnership: 'Partnership',
    trust_estate: 'Trust/estate',
    llc_c: 'LLC - C',
    llc_s: 'LLC - S',
    llc_p: 'LLC - P',
    other: 'Other',
  }

  // Pre-calculate checkbox states
  const isIndividual = w9Data.tax_classification === 'individual'
  const isCCorp = w9Data.tax_classification === 'c_corporation'
  const isSCorp = w9Data.tax_classification === 's_corporation'
  const isPartnership = w9Data.tax_classification === 'partnership'
  const isTrustEstate = w9Data.tax_classification === 'trust_estate'
  const isLLC = ['llc_c', 'llc_s', 'llc_p'].includes(w9Data.tax_classification)
  const isOther = w9Data.tax_classification === 'other'
  const llcType = w9Data.tax_classification === 'llc_c' ? 'C' : w9Data.tax_classification === 'llc_s' ? 'S' : w9Data.tax_classification === 'llc_p' ? 'P' : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form W-9 (Rev. December 2024)</title>
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0.5in;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #000;
      margin: 0;
      padding: 20px;
      background: white;
    }
    .w9-form {
      max-width: 7.5in;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 10px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin: 0 0 5px 0;
    }
    .header .subtitle {
      font-size: 9pt;
      margin: 2px 0;
    }
    .form-section {
      margin: 10px 0;
      padding: 8px;
      border: 1px solid #000;
    }
    .form-row {
      display: flex;
      margin: 8px 0;
      align-items: flex-start;
    }
    .form-label {
      font-weight: bold;
      font-size: 9pt;
      min-width: 30px;
    }
    .form-value {
      flex: 1;
      border-bottom: 1px solid #000;
      min-height: 20px;
      padding: 2px 5px;
      font-size: 10pt;
    }
    .checkbox-group {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin: 5px 0;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .checkbox {
      width: 12px;
      height: 12px;
      border: 1px solid #000;
      display: inline-block;
      text-align: center;
      line-height: 12px;
      font-weight: bold;
    }
    .checkbox.checked {
      background: #000;
      color: white;
    }
    .tax-classification {
      margin: 10px 0;
      padding: 10px;
      border: 1px solid #000;
      background: #f5f5f5;
    }
    .signature-section {
      margin-top: 15px;
      padding: 10px;
      border: 2px solid #000;
    }
    .signature-img {
      max-width: 300px;
      max-height: 80px;
      border: 1px solid #ccc;
      margin: 5px 0;
    }
    .certification-text {
      font-size: 8pt;
      line-height: 1.4;
      margin: 10px 0;
      padding: 10px;
      background: #fffef0;
      border-left: 3px solid #ffa500;
    }
    .instructions {
      font-size: 7pt;
      color: #666;
      font-style: italic;
    }
    .part-header {
      font-weight: bold;
      font-size: 11pt;
      background: #e0e0e0;
      padding: 5px;
      margin: 10px 0 5px 0;
      border: 1px solid #000;
    }
    .footer-note {
      font-size: 7pt;
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="w9-form">
    <!-- Header -->
    <div class="header">
      <h1>Form W-9</h1>
      <div class="subtitle">(Rev. December 2024)</div>
      <div class="subtitle">Department of the Treasury</div>
      <div class="subtitle">Internal Revenue Service</div>
      <div style="margin-top: 8px; font-size: 10pt;">
        <strong>Request for Taxpayer Identification Number and Certification</strong>
      </div>
      <div class="instructions">
        ▶ Go to <a href="https://www.irs.gov/FormW9">www.irs.gov/FormW9</a> for instructions and the latest information.
      </div>
    </div>

    <!-- Part I: Taxpayer Information -->
    <div class="part-header">Part I: Taxpayer Identification Number (TIN)</div>
    
    <div class="form-section">
      <div class="form-row">
        <span class="form-label">1</span>
        <div style="flex: 1;">
          <div class="instructions">Name (as shown on your income tax return). Name is required on this line; do not leave this line blank.</div>
          <div class="form-value">${w9Data.name}</div>
        </div>
      </div>

      ${w9Data.business_name ? `
      <div class="form-row">
        <span class="form-label">2</span>
        <div style="flex: 1;">
          <div class="instructions">Business name/disregarded entity name, if different from above</div>
          <div class="form-value">${w9Data.business_name}</div>
        </div>
      </div>
      ` : `
      <div class="form-row">
        <span class="form-label">2</span>
        <div style="flex: 1;">
          <div class="instructions">Business name/disregarded entity name, if different from above</div>
          <div class="form-value"></div>
        </div>
      </div>
      `}

      <div class="form-row">
        <span class="form-label">3</span>
        <div style="flex: 1;">
          <div class="instructions">Check appropriate box for federal tax classification of the person whose name is entered on line 1:</div>
          <div class="tax-classification">
            <div class="checkbox-group">
              <div class="checkbox-item">
                <span class="checkbox ${isIndividual ? 'checked' : ''}">✓</span>
                <span>Individual/sole proprietor or single-member LLC</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox ${isCCorp ? 'checked' : ''}">✓</span>
                <span>C Corporation</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox ${isSCorp ? 'checked' : ''}">✓</span>
                <span>S Corporation</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox ${isPartnership ? 'checked' : ''}">✓</span>
                <span>Partnership</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox ${isTrustEstate ? 'checked' : ''}">✓</span>
                <span>Trust/estate</span>
              </div>
            </div>
            <div style="margin-top: 5px;">
              <div class="checkbox-item">
                <span class="checkbox ${isLLC ? 'checked' : ''}">✓</span>
                <span>Limited liability company. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership) ▶</span>
                <span style="border-bottom: 1px solid #000; padding: 2px 10px;">
                  ${llcType}
                </span>
              </div>
            </div>
            ${w9Data.other_tax_classification ? `
            <div style="margin-top: 5px;">
              <div class="checkbox-item">
                <span class="checkbox ${isOther ? 'checked' : ''}">✓</span>
                <span>Other (see instructions) ▶</span>
                <span style="border-bottom: 1px solid #000; padding: 2px 10px;">${w9Data.other_tax_classification}</span>
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="form-row">
        <span class="form-label">4</span>
        <div style="flex: 1;">
          <div class="instructions">Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):</div>
          <div style="display: flex; gap: 20px; margin-top: 5px;">
            <div style="flex: 1;">
              Exempt payee code (if any) <span style="border-bottom: 1px solid #000; padding: 2px 10px; display: inline-block; min-width: 50px;">${w9Data.exempt_payee_code || ''}</span>
            </div>
            <div style="flex: 1;">
              Exemption from FATCA reporting code (if any) <span style="border-bottom: 1px solid #000; padding: 2px 10px; display: inline-block; min-width: 50px;">${w9Data.exemption_from_fatca_code || ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="form-row">
        <span class="form-label">5</span>
        <div style="flex: 1;">
          <div class="instructions">Address (number, street, and apt. or suite no.) See instructions.</div>
          <div class="form-value">${w9Data.address_line1}${w9Data.address_line2 ? ' ' + w9Data.address_line2 : ''}</div>
        </div>
      </div>

      <div class="form-row">
        <span class="form-label">6</span>
        <div style="flex: 1;">
          <div class="instructions">City, state, and ZIP code</div>
          <div class="form-value">${w9Data.city}, ${w9Data.state} ${w9Data.zip_code}</div>
        </div>
      </div>

      <div class="form-row">
        <span class="form-label">7</span>
        <div style="flex: 1;">
          <div class="instructions">List account number(s) here (optional)</div>
          <div class="form-value"></div>
        </div>
      </div>
    </div>

    <!-- Part II: Certification -->
    <div class="part-header">Part II: Certification</div>
    
    <div class="certification-text">
      <strong>Under penalties of perjury, I certify that:</strong><br><br>
      1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and<br>
      2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and<br>
      3. I am a U.S. citizen or other U.S. person (defined below); and<br>
      4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.<br><br>
      <strong>Certification instructions.</strong> You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN.
    </div>

    <div class="signature-section">
      <div style="margin-bottom: 10px;">
        <strong>Sign Here</strong>
      </div>
      <div style="display: flex; gap: 20px; align-items: flex-start;">
        <div style="flex: 2;">
          <div class="instructions">Signature of U.S. person ▶</div>
          <img src="${w9Data.signature_data_url}" alt="Signature" class="signature-img" />
        </div>
        <div style="flex: 1;">
          <div class="instructions">Date ▶</div>
          <div style="border-bottom: 1px solid #000; padding: 5px; margin-top: 5px; font-weight: bold;">
            ${new Date(w9Data.signature_date).toLocaleDateString('en-US')}
          </div>
        </div>
      </div>
    </div>

    <!-- Part III: Taxpayer Identification Number -->
    <div class="part-header">Part III: Taxpayer Identification Number (TIN)</div>
    <div class="form-section">
      <div style="margin: 10px 0;">
        <strong>Enter your TIN in the appropriate box.</strong> The TIN provided must match the name given on line 1 to avoid backup withholding.
      </div>
      <div style="display: flex; gap: 20px; margin: 15px 0;">
        <div style="flex: 1;">
          <div style="margin-bottom: 5px;"><strong>Social Security Number</strong></div>
          <div style="border: 2px solid #000; padding: 10px; text-align: center; background: #f9f9f9;">
            <div style="font-size: 9pt; color: #666;">*** REDACTED FOR SECURITY ***</div>
            <div style="font-size: 8pt; color: #999; margin-top: 5px;">SSN/EIN not stored in database</div>
          </div>
        </div>
        <div style="text-align: center; padding-top: 20px; font-weight: bold;">
          OR
        </div>
        <div style="flex: 1;">
          <div style="margin-bottom: 5px;"><strong>Employer Identification Number</strong></div>
          <div style="border: 2px solid #000; padding: 10px; text-align: center; background: #f9f9f9;">
            <div style="font-size: 9pt; color: #666;">*** REDACTED FOR SECURITY ***</div>
            <div style="font-size: 8pt; color: #999; margin-top: 5px;">SSN/EIN not stored in database</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-note">
      Form W-9 (Rev. 12-2024) • Submitted electronically via ShoutOut Platform on ${new Date(w9Data.created_at).toLocaleString('en-US')}<br>
      Talent: ${w9Data.talent_profiles.users.full_name} (${w9Data.talent_profiles.users.email}) • Reference ID: ${w9Data.id}<br>
      <strong>For Official IRS Use Only - This is a digitally completed W-9 form</strong>
    </div>
  </div>
</body>
</html>
  `
}

