import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Twilio credentials and Messaging Service SID for link shortening
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NOTE: Twilio automatically shortens links when using a Messaging Service
// with link shortening enabled. No manual API call needed!

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const { to, message, talentId } = await req.json();

    if (!to || !message) {
      throw new Error("Missing required fields: to, message");
    }

    // Format phone number to E.164 if not already
    const formattedTo = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`;

    console.log('Sending SMS:', {
      to: formattedTo,
      from: TWILIO_PHONE_NUMBER,
      messageLength: message.length,
      talentId,
      usingMessagingService: !!TWILIO_MESSAGING_SERVICE_SID
    });

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const body = new URLSearchParams({
      To: formattedTo,
      Body: message,
    });

    // Use Messaging Service if available (don't include From when using MessagingServiceSid)
    // Otherwise use From number directly
    if (TWILIO_MESSAGING_SERVICE_SID) {
      body.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
      console.log('Using Messaging Service for automatic link shortening');
    } else {
      body.append('From', TWILIO_PHONE_NUMBER);
      console.log('Using direct From number (no link shortening)');
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.json();
      console.error('Twilio API error:', errorData);
      throw new Error(`Twilio error: ${errorData.message || twilioResponse.statusText}`);
    }

    const twilioData = await twilioResponse.json();
    console.log('SMS sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        status: twilioData.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to send SMS",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

