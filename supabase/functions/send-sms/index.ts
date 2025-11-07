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

// Helper function to shorten URLs using Twilio's link shortening
async function shortenUrl(longUrl: string): Promise<string> {
  if (!TWILIO_MESSAGING_SERVICE_SID) {
    console.log('Twilio Messaging Service SID not configured, skipping link shortening');
    return longUrl;
  }

  try {
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;
    const shortenUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/Services/${TWILIO_MESSAGING_SERVICE_SID}/ShortUrls.json`;

    console.log('Shortening URL:', longUrl);

    const response = await fetch(shortenUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Url: longUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Twilio link shortening error:', errorData);
      // Fall back to original URL if shortening fails
      return longUrl;
    }

    const data = await response.json();
    console.log('URL shortened successfully:', data.short_url);
    return data.short_url;
  } catch (error) {
    console.error('Error shortening URL:', error);
    // Fall back to original URL if shortening fails
    return longUrl;
  }
}

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
      talentId
    });

    // Extract and shorten URLs in the message
    let processedMessage = message;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlRegex);

    if (urls && urls.length > 0) {
      console.log(`Found ${urls.length} URL(s) to shorten`);
      
      // Shorten each URL
      for (const url of urls) {
        const shortUrl = await shortenUrl(url);
        processedMessage = processedMessage.replace(url, shortUrl);
      }

      console.log('Original message length:', message.length);
      console.log('Processed message length:', processedMessage.length);
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const body = new URLSearchParams({
      To: formattedTo,
      Body: processedMessage,
    });

    // Use Messaging Service if available, otherwise use From number
    if (TWILIO_MESSAGING_SERVICE_SID) {
      body.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
    } else {
      body.append('From', TWILIO_PHONE_NUMBER);
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
        originalLength: message.length,
        shortenedLength: processedMessage.length,
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

