import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

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
    const hasMessagingServiceSid = !!TWILIO_MESSAGING_SERVICE_SID;
    console.log('Messaging Service SID available:', hasMessagingServiceSid);
    
    if (hasMessagingServiceSid) {
      body.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
      body.append('ShortenUrls', 'true'); // Explicitly enable link shortening
      console.log('✓ Using MessagingServiceSid:', TWILIO_MESSAGING_SERVICE_SID.substring(0, 8) + '...');
      console.log('✓ ShortenUrls parameter set to: true');
    } else {
      body.append('From', TWILIO_PHONE_NUMBER);
      console.log('✗ Using direct From number (no link shortening available)');
    }
    
    // Log the full request body for debugging
    console.log('Twilio API request body:', Array.from(body.entries()));

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

    // Log SMS to database if talentId is provided (for Comms Center conversation tracking)
    if (talentId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error: dbError } = await supabase
          .from('sms_messages')
          .insert({
            talent_id: talentId,
            from_admin: false, // Mark as system message (not from admin manually)
            message: message,
            status: 'sent',
            sent_at: new Date().toISOString(),
            read_by_admin: true, // Auto-mark as read since admin doesn't need to respond
          });

        if (dbError) {
          console.error('Error logging SMS to database:', dbError);
          // Don't fail the SMS send if logging fails
        } else {
          console.log('✓ SMS logged to sms_messages table for talent:', talentId);
        }
      } catch (dbLogError) {
        console.error('Error in database logging:', dbLogError);
        // Don't fail the SMS send if logging fails
      }
    }

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

