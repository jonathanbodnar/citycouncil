import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials not configured");
    }

    const { phone } = await req.json();

    if (!phone) {
      throw new Error("Phone number required");
    }

    // Format to E.164
    const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

    console.log('Verifying phone:', formattedPhone);

    // Call Twilio Lookup API v2
    const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(formattedPhone)}?Fields=line_type_intelligence`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const response = await fetch(lookupUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Twilio Lookup error:', errorData);
      
      // Common Twilio error codes:
      // 20404 - Invalid phone number format or doesn't exist
      // 21211 - Invalid phone number
      // 21217 - Phone number doesn't exist
      
      return new Response(
        JSON.stringify({
          valid: false,
          error: errorData.message || "Invalid phone number",
          errorCode: errorData.code,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // Still return 200 so frontend can handle gracefully
        }
      );
    }

    const data = await response.json();
    console.log('Lookup result:', data);

    // Extract line type (mobile, landline, voip)
    const lineType = data.line_type_intelligence?.type || 'unknown';
    const carrier = data.line_type_intelligence?.carrier_name || 'unknown';
    
    // Check if it's a valid SMS-capable number
    const canReceiveSMS = lineType === 'mobile' || lineType === 'voip';

    return new Response(
      JSON.stringify({
        valid: true,
        phone: data.phone_number, // Returns in E.164 format
        nationalFormat: data.national_format,
        countryCode: data.country_code,
        lineType: lineType,
        carrier: carrier,
        canReceiveSMS: canReceiveSMS,
        warning: lineType === 'landline' ? 'This appears to be a landline and may not receive SMS' : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error verifying phone:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: error.message || "Failed to verify phone number",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

