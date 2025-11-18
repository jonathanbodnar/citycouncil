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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { data: adminData, error: adminDataError } = await supabaseClient
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (adminDataError || adminData?.user_type !== 'admin') {
      throw new Error('Unauthorized - Admin access required')
    }

    const url = new URL(req.url)
    const w9Id = url.searchParams.get('w9Id')

    if (!w9Id) {
      throw new Error('Missing w9Id parameter')
    }

    const { data: w9Data, error: w9Error } = await supabaseClient
      .from('w9_forms')
      .select('*')
      .eq('id', w9Id)
      .single()

    if (w9Error || !w9Data) {
      console.error('Error fetching W-9:', w9Error)
      throw new Error('W-9 not found')
    }

    const { data: talentData, error: talentError } = await supabaseClient
      .from('talent_profiles')
      .select('id, user_id')
      .eq('id', w9Data.talent_id)
      .single()

    if (talentError || !talentData) {
      console.error('Error fetching talent:', talentError)
      throw new Error('Talent profile not found')
    }

    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('full_name, email')
      .eq('id', talentData.user_id)
      .single()

    if (userDataError || !userData) {
      console.error('Error fetching user:', userDataError)
      throw new Error('User not found')
    }

    w9Data.talent_profiles = {
      id: talentData.id,
      users: userData
    }

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
    @page { size: 8.5in 11in; margin: 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.2;
      padding: 0.5in;
      color: #000;
      background: white;
    }
    .form {
      max-width: 7.5in;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #000;
      padding-bottom: 5px;
      margin-bottom: 5px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left { flex: 1; }
    .form-title {
      font-size: 20pt;
      font-weight: bold;
      line-height: 1;
    }
    .form-rev {
      font-size: 7pt;
      margin-top: 2px;
    }
    .dept {
      font-size: 7pt;
      margin-top: 3px;
      line-height: 1.3;
    }
    .header-right {
      text-align: right;
      padding-left: 20px;
    }
    .header-title {
      font-size: 11pt;
      font-weight: bold;
      line-height: 1.2;
    }
    .instructions {
      font-size: 7pt;
      margin-top: 5px;
    }
    .intro {
      font-size: 7pt;
      margin: 5px 0;
      padding: 3px 0;
    }
    .field {
      border: 1.5px solid #000;
      padding: 4px;
      margin: 2px 0;
      min-height: 24px;
    }
    .field-label {
      font-size: 6.5pt;
      font-weight: normal;
      display: block;
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 10pt;
      min-height: 16px;
      font-weight: 500;
    }
    .split-row {
      display: flex;
      gap: 5px;
    }
    .split-left { flex: 7; }
    .split-right { flex: 3; }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      margin: 2px 0;
      gap: 4px;
    }
    .checkbox {
      width: 10px;
      height: 10px;
      border: 1.5px solid #000;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1px;
    }
    .checkbox.checked::before { content: "X"; }
    .checkbox-label {
      font-size: 7pt;
      line-height: 1.3;
    }
    .small-input {
      border-bottom: 1px solid #000;
      display: inline-block;
      min-width: 30px;
      padding: 0 3px;
    }
    .section-header {
      background: #000;
      color: white;
      padding: 3px 8px;
      font-weight: bold;
      font-size: 8pt;
      margin: 10px 0 5px 0;
    }
    .tin-section {
      border: 2px solid #000;
      padding: 8px;
      margin: 5px 0;
    }
    .tin-instruction {
      font-size: 6.5pt;
      line-height: 1.3;
      margin-bottom: 8px;
    }
    .tin-boxes {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 15px;
      margin-top: 8px;
    }
    .tin-box {
      text-align: center;
      flex: 1;
    }
    .tin-label {
      font-size: 7pt;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .tin-value {
      border: 2px solid #000;
      padding: 12px;
      text-align: center;
      background: #f8f8f8;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }
    .redacted {
      color: #666;
      font-size: 8pt;
      font-weight: bold;
    }
    .cert-section {
      border: 2px solid #000;
      padding: 8px;
      margin: 5px 0;
    }
    .cert-text {
      font-size: 6.5pt;
      line-height: 1.4;
      margin: 4px 0;
    }
    .cert-bold {
      font-weight: bold;
      margin-top: 6px;
    }
    .signature-area {
      border-top: 1.5px solid #000;
      margin-top: 10px;
      padding-top: 8px;
    }
    .sig-row {
      display: flex;
      gap: 15px;
    }
    .sig-col { flex: 3; }
    .date-col { flex: 1; }
    .sig-label {
      font-size: 6.5pt;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .sig-line {
      border-bottom: 1px solid #000;
      min-height: 50px;
      padding: 5px;
    }
    .signature-img {
      max-height: 45px;
      max-width: 100%;
    }
    .requester-box {
      border: 1.5px solid #000;
      padding: 4px;
      margin: 2px 0;
      min-height: 60px;
      background: #fafafa;
    }
    .footer {
      margin-top: 15px;
      padding-top: 8px;
      border-top: 1px solid #999;
      text-align: center;
      font-size: 6.5pt;
      color: #666;
    }
    .cat-no {
      font-size: 6.5pt;
      text-align: right;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="form">
    <!-- Header -->
    <div class="header">
      <div class="header-row">
        <div class="header-left">
          <div class="form-title">Form W-9</div>
          <div class="form-rev">(Rev. March 2024)</div>
          <div class="dept">
            Department of the Treasury<br>
            Internal Revenue Service
          </div>
        </div>
        <div class="header-right">
          <div class="header-title">
            Request for Taxpayer<br>
            Identification Number and Certification
          </div>
          <div class="instructions">
            <strong>▶ Go to <a href="http://www.irs.gov/FormW9" style="color:#000;text-decoration:underline;">www.irs.gov/FormW9</a> for instructions and the latest information.</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="intro">
      <strong>Before you begin.</strong> For guidance related to the purpose of Form W-9, see <em>Purpose of Form</em>, below.
    </div>

    <!-- Line 1 -->
    <div class="field">
      <span class="field-label"><strong>1</strong> Name of entity/individual. An entry is required. (For a sole proprietor or disregarded entity, enter the owner's name on line 1, and enter the business/disregarded entity's name on line 2.)</span>
      <div class="field-value">${w9Data.name || ''}</div>
    </div>

    <!-- Line 2 -->
    <div class="field">
      <span class="field-label"><strong>2</strong> Business name/disregarded entity name, if different from above</span>
      <div class="field-value">${w9Data.business_name || ''}</div>
    </div>

    <!-- Line 3a and 4 (split row) -->
    <div class="split-row">
      <div class="split-left">
        <div class="field" style="min-height: 120px;">
          <span class="field-label"><strong>3a</strong> Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1. Check only one of the following seven boxes.</span>
          <div style="margin-top: 4px;">
            <div class="checkbox-row">
              <span class="checkbox ${isIndividual ? 'checked' : ''}"></span>
              <span class="checkbox-label">Individual/sole proprietor or single-member LLC</span>
            </div>
            <div class="checkbox-row">
              <span class="checkbox ${isCCorp ? 'checked' : ''}"></span>
              <span class="checkbox-label">C Corporation</span>
            </div>
            <div class="checkbox-row">
              <span class="checkbox ${isSCorp ? 'checked' : ''}"></span>
              <span class="checkbox-label">S Corporation</span>
            </div>
            <div class="checkbox-row">
              <span class="checkbox ${isPartnership ? 'checked' : ''}"></span>
              <span class="checkbox-label">Partnership</span>
            </div>
            <div class="checkbox-row">
              <span class="checkbox ${isTrustEstate ? 'checked' : ''}"></span>
              <span class="checkbox-label">Trust/estate</span>
            </div>
            <div class="checkbox-row">
              <span class="checkbox ${isLLC ? 'checked' : ''}"></span>
              <span class="checkbox-label">Limited liability company. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership) ▶ <span class="small-input">${llcType}</span></span>
            </div>
            <div class="checkbox-row">
              <span class="checkbox ${isOther ? 'checked' : ''}"></span>
              <span class="checkbox-label">Other (see instructions) ▶ <span class="small-input">${w9Data.other_tax_classification || ''}</span></span>
            </div>
          </div>
        </div>
      </div>
      <div class="split-right">
        <div class="field" style="min-height: 120px;">
          <span class="field-label"><strong>4</strong> Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):</span>
          <div style="margin-top: 8px;">
            <div class="checkbox-label" style="margin-bottom: 2px;">Exempt payee code (if any)</div>
            <div class="small-input" style="width: 100%; text-align: center; min-height: 18px;">${w9Data.exempt_payee_code || ''}</div>
          </div>
          <div style="margin-top: 8px;">
            <div class="checkbox-label" style="margin-bottom: 2px;">Exemption from FATCA reporting code (if any)</div>
            <div class="small-input" style="width: 100%; text-align: center; min-height: 18px;">${w9Data.exemption_from_fatca_code || ''}</div>
            <div class="checkbox-label" style="margin-top: 2px; font-size: 6pt;">(Applies to accounts maintained outside the United States.)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Line 3b (if applicable) -->
    <div class="field" style="font-size: 7pt; padding: 2px 4px; min-height: auto;">
      <strong>3b</strong> If on line 3a you checked "Partnership" or "Trust/estate," or checked "LLC" and entered "P" as its tax classification, and you are providing this form to a partnership, trust, or estate in which you have an ownership interest, check this box if you have any foreign partners, owners, or beneficiaries. See instructions ▶ <span class="checkbox" style="margin-left: 5px;"></span>
    </div>

    <!-- Lines 5, 6, 7 with Requester box -->
    <div class="split-row">
      <div style="flex: 1;">
        <!-- Line 5 -->
        <div class="field">
          <span class="field-label"><strong>5</strong> Address (number, street, and apt. or suite no.) See instructions.</span>
          <div class="field-value">${w9Data.address_line1 || ''}${w9Data.address_line2 ? ', ' + w9Data.address_line2 : ''}</div>
        </div>
        <!-- Line 6 -->
        <div class="field">
          <span class="field-label"><strong>6</strong> City, state, and ZIP code</span>
          <div class="field-value">${w9Data.city || ''}, ${w9Data.state || ''} ${w9Data.zip_code || ''}</div>
        </div>
        <!-- Line 7 -->
        <div class="field">
          <span class="field-label"><strong>7</strong> List account number(s) here (optional)</span>
          <div class="field-value"></div>
        </div>
      </div>
      <div style="flex: 0 0 2.5in; margin-left: 5px;">
        <div class="requester-box">
          <span class="field-label">Requester's name and address (optional)</span>
        </div>
      </div>
    </div>

    <!-- Part I -->
    <div class="section-header">Part I      Taxpayer Identification Number (TIN)</div>
    <div class="tin-section">
      <div class="tin-instruction">
        Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding. For individuals, this is generally your social security number (SSN). However, for a resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other entities, it is your employer identification number (EIN). If you do not have a number, see <em>How to get a TIN</em>, later.
      </div>
      <div style="font-size: 6.5pt; margin-top: 5px;">
        <strong>Note:</strong> If the account is in more than one name, see the instructions for line 1. See also <em>What Name and Number To Give the Requester</em> for guidelines on whose number to enter.
      </div>
      <div class="tin-boxes">
        <div class="tin-box">
          <div class="tin-label">Social security number</div>
          <div class="tin-value">
            <div class="redacted">– – –</div>
            <div style="font-size: 6pt; color: #999; margin-top: 3px;">REDACTED FOR SECURITY</div>
          </div>
        </div>
        <div style="font-weight: bold; padding-top: 25px;">or</div>
        <div class="tin-box">
          <div class="tin-label">Employer identification number</div>
          <div class="tin-value">
            <div class="redacted">– –</div>
            <div style="font-size: 6pt; color: #999; margin-top: 3px;">REDACTED FOR SECURITY</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Part II -->
    <div class="section-header">Part II     Certification</div>
    <div class="cert-section">
      <div class="cert-text">
        Under penalties of perjury, I certify that:
      </div>
      <div class="cert-text" style="margin-left: 10px;">
        <strong>1.</strong> The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and<br>
        <strong>2.</strong> I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and<br>
        <strong>3.</strong> I am a U.S. citizen or other U.S. person (defined below); and<br>
        <strong>4.</strong> The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.
      </div>
      <div class="cert-text cert-bold">
        Certification instructions. You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and, generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN. See the instructions for Part II, later.
      </div>
      
      <div class="signature-area">
        <div class="sig-row">
          <div class="sig-col">
            <div class="sig-label">Sign<br>Here</div>
            <div class="sig-label" style="margin-top: 2px;">Signature of<br>U.S. person ▶</div>
            <div class="sig-line">
              ${w9Data.signature_data_url ? `<img src="${w9Data.signature_data_url}" class="signature-img" alt="Signature">` : ''}
            </div>
          </div>
          <div class="date-col">
            <div class="sig-label">Date ▶</div>
            <div class="sig-line" style="text-align: center; padding-top: 20px; font-weight: bold; font-size: 10pt;">
              ${new Date(w9Data.signature_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="cat-no">Cat. No. 10231X     Form W-9 (Rev. 3-2024)</div>

    <!-- Electronic submission footer -->
    <div class="footer">
      <strong>Electronic Submission via ShoutOut Platform</strong><br>
      Submitted: ${new Date(w9Data.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}<br>
      Talent: ${w9Data.talent_profiles.users.full_name} (${w9Data.talent_profiles.users.email})<br>
      Reference ID: ${w9Data.id}
    </div>
  </div>
</body>
</html>`
}
