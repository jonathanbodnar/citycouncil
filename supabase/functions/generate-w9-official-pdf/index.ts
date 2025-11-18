import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

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

    // Download the official IRS W-9 PDF
    console.log('Fetching official IRS W-9 PDF...')
    const irsFormResponse = await fetch('https://www.irs.gov/pub/irs-pdf/fw9.pdf')
    if (!irsFormResponse.ok) {
      throw new Error('Failed to fetch official IRS W-9 form')
    }
    const irsFormBytes = await irsFormResponse.arrayBuffer()

    // Load the PDF
    const pdfDoc = await PDFDocument.load(irsFormBytes)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const { height } = firstPage.getSize()

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Fill in the form fields
    // Line 1: Name
    firstPage.drawText(w9Data.name || '', {
      x: 130,
      y: height - 193,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })

    // Line 2: Business name
    if (w9Data.business_name) {
      firstPage.drawText(w9Data.business_name, {
        x: 130,
        y: height - 217,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      })
    }

    // Line 3a: Tax classification checkboxes
    const checkboxSize = 8
    let checkboxY = height - 255
    
    // Individual
    if (w9Data.tax_classification === 'individual') {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
    }

    // C Corporation
    if (w9Data.tax_classification === 'c_corporation') {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY - 13,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
    }

    // S Corporation
    if (w9Data.tax_classification === 's_corporation') {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY - 26,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
    }

    // Partnership
    if (w9Data.tax_classification === 'partnership') {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY - 39,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
    }

    // Trust/estate
    if (w9Data.tax_classification === 'trust_estate') {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY - 52,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
    }

    // LLC
    if (['llc_c', 'llc_s', 'llc_p'].includes(w9Data.tax_classification)) {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY - 65,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
      
      // LLC type
      const llcType = w9Data.tax_classification === 'llc_c' ? 'C' : 
                      w9Data.tax_classification === 'llc_s' ? 'S' : 'P'
      firstPage.drawText(llcType, {
        x: 595,
        y: checkboxY - 65,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      })
    }

    // Other
    if (w9Data.tax_classification === 'other') {
      firstPage.drawText('X', {
        x: 128,
        y: checkboxY - 78,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
      if (w9Data.other_tax_classification) {
        firstPage.drawText(w9Data.other_tax_classification, {
          x: 290,
          y: checkboxY - 78,
          size: 9,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        })
      }
    }

    // Line 5: Address
    const addressText = w9Data.address_line2 
      ? `${w9Data.address_line1}, ${w9Data.address_line2}`
      : w9Data.address_line1
    
    firstPage.drawText(addressText || '', {
      x: 130,
      y: height - 387,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })

    // Line 6: City, State, ZIP
    firstPage.drawText(`${w9Data.city || ''}, ${w9Data.state || ''} ${w9Data.zip_code || ''}`, {
      x: 130,
      y: height - 413,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })

    // Add signature image if available
    if (w9Data.signature_data_url) {
      try {
        // Extract base64 data from data URL
        const base64Data = w9Data.signature_data_url.split(',')[1]
        const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        
        // Determine image type from data URL
        let signatureImage
        if (w9Data.signature_data_url.startsWith('data:image/png')) {
          signatureImage = await pdfDoc.embedPng(signatureBytes)
        } else if (w9Data.signature_data_url.startsWith('data:image/jpg') || 
                   w9Data.signature_data_url.startsWith('data:image/jpeg')) {
          signatureImage = await pdfDoc.embedJpg(signatureBytes)
        }

        if (signatureImage) {
          const signatureDims = signatureImage.scale(0.3)
          firstPage.drawImage(signatureImage, {
            x: 150,
            y: height - 755,
            width: signatureDims.width,
            height: signatureDims.height,
          })
        }
      } catch (error) {
        console.error('Error embedding signature:', error)
      }
    }

    // Add date
    const formattedDate = new Date(w9Data.signature_date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
    
    firstPage.drawText(formattedDate, {
      x: 730,
      y: height - 740,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })

    // Add a small footer note about electronic submission
    firstPage.drawText(`Electronic submission via ShoutOut - ${userData.full_name} - ${new Date(w9Data.created_at).toLocaleDateString()}`, {
      x: 50,
      y: 30,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Save the PDF
    const pdfBytes = await pdfDoc.save()

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="W9_${w9Data.name.replace(/[^a-z0-9]/gi, '_')}_${w9Data.id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error in generate-w9-official-pdf:', error)
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

