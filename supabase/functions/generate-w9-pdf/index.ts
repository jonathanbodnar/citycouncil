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

    const {
      name,
      businessName,
      taxClassification,
      otherTaxClassification,
      exemptPayeeCode,
      exemptionFromFatcaCode,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      taxId,
      taxIdType,
      signatureDataUrl,
      talentId,
    } = await req.json()

    // Validate required fields with detailed error message
    const missingFields = []
    if (!name) missingFields.push('name')
    if (!addressLine1) missingFields.push('addressLine1')
    if (!city) missingFields.push('city')
    if (!state) missingFields.push('state')
    if (!zipCode) missingFields.push('zipCode')
    if (!taxId) missingFields.push('taxId')
    if (!signatureDataUrl) missingFields.push('signatureDataUrl')
    if (!talentId) missingFields.push('talentId')
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }

    // Verify talent belongs to user
    const { data: talent, error: talentError } = await supabaseClient
      .from('talent_profiles')
      .select('id, user_id')
      .eq('id', talentId)
      .eq('user_id', user.id)
      .single()

    if (talentError || !talent) {
      throw new Error('Talent profile not found or unauthorized')
    }

    // Check if W-9 already exists
    const { data: existingW9 } = await supabaseClient
      .from('w9_forms')
      .select('id')
      .eq('talent_id', talentId)
      .maybeSingle()

    if (existingW9) {
      throw new Error('W-9 already exists for this talent')
    }

    // Get IP address (handle comma-separated proxy IPs by taking the first one)
    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const ipAddress = forwardedFor.split(',')[0].trim() || null

    // Store W-9 data in database (WITHOUT the SSN/EIN)
    const { data: w9Record, error: w9Error } = await supabaseClient
      .from('w9_forms')
      .insert({
        talent_id: talentId,
        name,
        business_name: businessName || null,
        tax_classification: taxClassification,
        other_tax_classification: otherTaxClassification || null,
        exempt_payee_code: exemptPayeeCode || null,
        exemption_from_fatca_code: exemptionFromFatcaCode || null,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        city,
        state,
        zip_code: zipCode,
        signature_data_url: signatureDataUrl,
        signature_date: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || null,
      })
      .select()
      .single()

    if (w9Error) {
      console.error('Error storing W-9:', w9Error)
      throw new Error('Failed to store W-9 data')
    }

    // Generate PDF using a library like PDFKit or jsPDF
    // For now, we'll create a simple HTML-to-PDF approach
    const pdfHtml = generateW9Html({
      name,
      businessName,
      taxClassification,
      otherTaxClassification,
      exemptPayeeCode,
      exemptionFromFatcaCode,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      taxId,
      taxIdType,
      signatureDataUrl,
      signatureDate: new Date().toISOString(),
    })

    // In production, you'd use a PDF generation service
    // For now, we'll return success and indicate PDF generation is pending
    // You can integrate with services like:
    // - Puppeteer (requires custom Deno deployment)
    // - PDF.co API
    // - DocRaptor
    // - PDFShift

    console.log('W-9 stored successfully:', w9Record.id)

    return new Response(
      JSON.stringify({
        success: true,
        w9Id: w9Record.id,
        message: 'W-9 submitted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in generate-w9-pdf:', error)
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

function generateW9Html(data: any): string {
  const taxClassificationLabels: Record<string, string> = {
    individual: 'Individual/sole proprietor or single-member LLC',
    c_corporation: 'C Corporation',
    s_corporation: 'S Corporation',
    partnership: 'Partnership',
    trust_estate: 'Trust/estate',
    llc_c: 'Limited liability company (C Corp)',
    llc_s: 'Limited liability company (S Corp)',
    llc_p: 'Limited liability company (Partnership)',
    other: 'Other',
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Form W-9</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      margin: 40px;
    }
    .header {
      text-align: center;
      font-weight: bold;
      font-size: 14pt;
      margin-bottom: 10px;
    }
    .subheader {
      text-align: center;
      font-size: 9pt;
      margin-bottom: 20px;
    }
    .form-field {
      margin-bottom: 15px;
      border: 1px solid #000;
      padding: 10px;
    }
    .label {
      font-weight: bold;
      font-size: 9pt;
      margin-bottom: 5px;
    }
    .value {
      font-size: 11pt;
      padding: 5px 0;
    }
    .signature {
      margin-top: 20px;
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .signature img {
      max-width: 300px;
      max-height: 80px;
    }
    .certification {
      background-color: #f0f0f0;
      padding: 15px;
      margin: 20px 0;
      border: 1px solid #ccc;
      font-size: 9pt;
    }
    .tin-field {
      font-family: monospace;
      font-size: 12pt;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="header">Form W-9</div>
  <div class="subheader">
    Request for Taxpayer Identification Number and Certification<br>
    (Rev. October 2018)<br>
    Department of the Treasury - Internal Revenue Service
  </div>

  <div class="form-field">
    <div class="label">1. Name (as shown on your income tax return)</div>
    <div class="value">${data.name}</div>
  </div>

  ${
    data.businessName
      ? `
  <div class="form-field">
    <div class="label">2. Business name/disregarded entity name, if different from above</div>
    <div class="value">${data.businessName}</div>
  </div>
  `
      : ''
  }

  <div class="form-field">
    <div class="label">3. Federal tax classification</div>
    <div class="value">
      ${taxClassificationLabels[data.taxClassification] || data.taxClassification}
      ${data.otherTaxClassification ? ` - ${data.otherTaxClassification}` : ''}
    </div>
  </div>

  ${
    data.exemptPayeeCode
      ? `
  <div class="form-field">
    <div class="label">4. Exemptions (codes apply only to certain entities)</div>
    <div class="value">Exempt payee code: ${data.exemptPayeeCode}</div>
  </div>
  `
      : ''
  }

  ${
    data.exemptionFromFatcaCode
      ? `
  <div class="form-field">
    <div class="label">Exemption from FATCA reporting code</div>
    <div class="value">${data.exemptionFromFatcaCode}</div>
  </div>
  `
      : ''
  }

  <div class="form-field">
    <div class="label">5. Address (number, street, and apt. or suite no.)</div>
    <div class="value">
      ${data.addressLine1}${data.addressLine2 ? `, ${data.addressLine2}` : ''}
    </div>
  </div>

  <div class="form-field">
    <div class="label">6. City, state, and ZIP code</div>
    <div class="value">${data.city}, ${data.state} ${data.zipCode}</div>
  </div>

  <div class="form-field">
    <div class="label">7. Taxpayer Identification Number (TIN)</div>
    <div class="value tin-field">
      ${data.taxIdType === 'ssn' ? 'Social Security Number: ' : 'Employer Identification Number: '}
      ${data.taxId}
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
    <img src="${data.signatureDataUrl}" alt="Signature" />
    <div class="value">Date: ${new Date(data.signatureDate).toLocaleDateString()}</div>
  </div>
</body>
</html>
  `
}

