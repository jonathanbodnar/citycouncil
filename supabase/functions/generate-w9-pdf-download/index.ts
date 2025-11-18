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
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
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

    // Generate HTML
    const html = generateW9Html(w9Data)

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    })
  } catch (error: any) {
    console.error('Error in generate-w9-pdf-download:', error)
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

function generateW9Html(w9Data: any): string {
  // Pre-calculate checkbox states
  const isIndividual = w9Data.tax_classification === 'individual'
  const isCCorp = w9Data.tax_classification === 'c_corporation'
  const isSCorp = w9Data.tax_classification === 's_corporation'
  const isPartnership = w9Data.tax_classification === 'partnership'
  const isTrustEstate = w9Data.tax_classification === 'trust_estate'
  const isLLC = ['llc_c', 'llc_s', 'llc_p'].includes(w9Data.tax_classification)
  const isOther = w9Data.tax_classification === 'other'
  const llcType = w9Data.tax_classification === 'llc_c' ? 'C' : w9Data.tax_classification === 'llc_s' ? 'S' : w9Data.tax_classification === 'llc_p' ? 'P' : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Form W-9 (Rev. March 2024)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.2;
      margin: 20px;
      color: #000;
      background: white;
    }
    .form-container {
      max-width: 8in;
      margin: 0 auto;
    }
    .form-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .form-title {
      font-size: 16pt;
      font-weight: bold;
      margin: 0;
    }
    .form-subtitle {
      font-size: 8pt;
      margin: 2px 0;
    }
    .dept-info {
      text-align: left;
      font-size: 8pt;
      line-height: 1.3;
    }
    .instructions-link {
      text-align: right;
      font-size: 8pt;
    }
    .field-box {
      border: 1px solid #000;
      padding: 5px;
      margin: 3px 0;
    }
    .field-label {
      font-size: 7pt;
      font-weight: bold;
      display: block;
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 10pt;
      min-height: 16px;
      padding: 2px 0;
    }
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
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
      border: 1.5px solid #000;
      display: inline-block;
      flex-shrink: 0;
      text-align: center;
      line-height: 12px;
      font-size: 10pt;
      font-weight: bold;
    }
    .checkbox.checked::before {
      content: "X";
    }
    .inline-input {
      border-bottom: 1px solid #000;
      padding: 0 5px;
      min-width: 40px;
      display: inline-block;
    }
    .section-title {
      background: #000;
      color: white;
      font-weight: bold;
      padding: 4px 8px;
      margin: 15px 0 8px 0;
      font-size: 9pt;
    }
    .tin-section {
      border: 2px solid #000;
      padding: 10px;
      margin: 10px 0;
    }
    .tin-boxes {
      display: flex;
      justify-content: space-around;
      margin-top: 10px;
      gap: 20px;
    }
    .tin-box {
      text-align: center;
      flex: 1;
    }
    .tin-label {
      font-weight: bold;
      font-size: 8pt;
      margin-bottom: 5px;
    }
    .tin-value {
      border: 2px solid #000;
      padding: 10px;
      text-align: center;
      min-height: 35px;
      font-size: 10pt;
      background: #f5f5f5;
    }
    .cert-section {
      border: 2px solid #000;
      padding: 10px;
      margin: 10px 0;
    }
    .cert-text {
      font-size: 8pt;
      line-height: 1.4;
      margin: 5px 0;
    }
    .signature-row {
      display: flex;
      gap: 20px;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #000;
    }
    .sig-field {
      flex: 2;
    }
    .date-field {
      flex: 1;
    }
    .sig-label {
      font-size: 7pt;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .sig-line {
      border-bottom: 1px solid #000;
      min-height: 40px;
      padding-top: 5px;
    }
    .signature-img {
      max-height: 40px;
      max-width: 100%;
    }
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #999;
      text-align: center;
      font-size: 7pt;
      color: #666;
    }
    .small-text {
      font-size: 7pt;
      color: #333;
    }
    .flex-row {
      display: flex;
      gap: 10px;
    }
    .flex-col {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <!-- Header -->
    <div class="form-header">
      <div>
        <div class="form-title">Form W-9</div>
        <div class="form-subtitle">(Rev. March 2024)</div>
        <div class="dept-info">
          Department of the Treasury<br>
          Internal Revenue Service
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 10pt; font-weight: bold;">Request for Taxpayer</div>
        <div style="font-size: 10pt; font-weight: bold;">Identification Number and Certification</div>
        <div class="instructions-link" style="margin-top: 8px;">
          ▶ Go to <strong>www.irs.gov/FormW9</strong> for instructions and the latest information.
        </div>
      </div>
    </div>

    <!-- Line 1: Name -->
    <div class="field-box">
      <span class="field-label">1  Name (as shown on your income tax return). Name is required on this line; do not leave this line blank.</span>
      <div class="field-value">${w9Data.name || ''}</div>
    </div>

    <!-- Line 2: Business name -->
    <div class="field-box">
      <span class="field-label">2  Business name/disregarded entity name, if different from above</span>
      <div class="field-value">${w9Data.business_name || ''}</div>
    </div>

    <!-- Line 3a & 4: Tax classification and exemptions -->
    <div class="flex-row">
      <div class="field-box" style="flex: 3;">
        <span class="field-label">3a  Check appropriate box for federal tax classification of the person whose name is entered on line 1. Check only one of the following seven boxes.</span>
        <div class="checkbox-group" style="margin-top: 8px;">
          <div class="checkbox-item">
            <span class="checkbox ${isIndividual ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">Individual/sole proprietor or single-member LLC</span>
          </div>
          <div class="checkbox-item">
            <span class="checkbox ${isCCorp ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">C Corporation</span>
          </div>
          <div class="checkbox-item">
            <span class="checkbox ${isSCorp ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">S Corporation</span>
          </div>
          <div class="checkbox-item">
            <span class="checkbox ${isPartnership ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">Partnership</span>
          </div>
          <div class="checkbox-item">
            <span class="checkbox ${isTrustEstate ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">Trust/estate</span>
          </div>
        </div>
        <div style="margin-top: 5px;">
          <div class="checkbox-item">
            <span class="checkbox ${isLLC ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">Limited liability company. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership) ▶ 
            <span class="inline-input">${llcType}</span></span>
          </div>
        </div>
        <div style="margin-top: 5px;">
          <div class="checkbox-item">
            <span class="checkbox ${isOther ? 'checked' : ''}"></span>
            <span style="font-size: 8pt;">Other (see instructions) ▶ 
            <span class="inline-input">${w9Data.other_tax_classification || ''}</span></span>
          </div>
        </div>
      </div>
      <div class="field-box" style="flex: 1;">
        <span class="field-label">4  Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):</span>
        <div style="margin-top: 5px;">
          <div class="small-text">Exempt payee code (if any)</div>
          <div class="inline-input" style="width: 100%; text-align: center;">&nbsp;</div>
        </div>
        <div style="margin-top: 8px;">
          <div class="small-text">Exemption from FATCA reporting code (if any)</div>
          <div class="inline-input" style="width: 100%; text-align: center;">&nbsp;</div>
        </div>
      </div>
    </div>

    <!-- Line 5: Address -->
    <div class="field-box">
      <span class="field-label">5  Address (number, street, and apt. or suite no.) See instructions.</span>
      <div class="field-value">${w9Data.address || ''}</div>
    </div>

    <!-- Line 6: City, state, ZIP -->
    <div class="field-box">
      <span class="field-label">6  City, state, and ZIP code</span>
      <div class="field-value">${w9Data.city || ''}, ${w9Data.state || ''} ${w9Data.zip_code || ''}</div>
    </div>

    <!-- Line 7: Account numbers -->
    <div class="field-box">
      <span class="field-label">7  List account number(s) here (optional)</span>
      <div class="field-value">&nbsp;</div>
    </div>

    <!-- Part I: TIN -->
    <div class="section-title">Part I      Taxpayer Identification Number (TIN)</div>
    <div class="tin-section">
      <div style="font-size: 8pt; margin-bottom: 10px;">
        Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding. For individuals, this is generally your social security number (SSN). However, for a resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other entities, it is your employer identification number (EIN). If you do not have a number, see How to get a TIN, later.
      </div>
      <div class="tin-boxes">
        <div class="tin-box">
          <div class="tin-label">Social security number</div>
          <div class="tin-value">
            <div style="color: #999; font-size: 8pt;">*** REDACTED ***</div>
            <div style="color: #999; font-size: 7pt; margin-top: 3px;">Not stored for security</div>
          </div>
        </div>
        <div style="text-align: center; padding-top: 25px; font-weight: bold;">or</div>
        <div class="tin-box">
          <div class="tin-label">Employer identification number</div>
          <div class="tin-value">
            <div style="color: #999; font-size: 8pt;">*** REDACTED ***</div>
            <div style="color: #999; font-size: 7pt; margin-top: 3px;">Not stored for security</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Part II: Certification -->
    <div class="section-title">Part II     Certification</div>
    <div class="cert-section">
      <div class="cert-text">
        Under penalties of perjury, I certify that:
      </div>
      <div class="cert-text">
        1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and<br>
        2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and<br>
        3. I am a U.S. citizen or other U.S. person (defined below); and<br>
        4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.
      </div>
      <div class="cert-text" style="font-weight: bold; margin-top: 8px;">
        Certification instructions. You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and, generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN. See the instructions for Part II, later.
      </div>
      
      <div class="signature-row">
        <div class="sig-field">
          <div class="sig-label">Sign Here ▶</div>
          <div class="sig-label" style="margin-top: 2px;">Signature of U.S. person</div>
          <div class="sig-line">
            ${w9Data.signature_data_url ? `<img src="${w9Data.signature_data_url}" class="signature-img" alt="Signature" />` : ''}
          </div>
        </div>
        <div class="date-field">
          <div class="sig-label">Date ▶</div>
          <div class="sig-line" style="text-align: center; padding-top: 15px; font-weight: bold;">
            ${new Date(w9Data.signature_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <strong>Form W-9 (Rev. 3-2024)</strong> • Cat. No. 10231X<br>
      Submitted electronically via ShoutOut Platform on ${new Date(w9Data.created_at).toLocaleString('en-US')}<br>
      Talent: ${w9Data.talent_profiles.users.full_name} (${w9Data.talent_profiles.users.email})<br>
      Reference ID: ${w9Data.id}
    </div>
  </div>
</body>
</html>`
}
