import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

// Twilio credentials
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
// OTP codes use dedicated number (+19863335069), fallback to user number, then talent number
const OTP_SMS_PHONE_NUMBER = Deno.env.get("OTP_SMS_PHONE_NUMBER") || Deno.env.get("USER_SMS_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a 6-digit OTP code
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone to E.164
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !OTP_SMS_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone } = await req.json();

    if (!phone) {
      throw new Error("Phone number is required");
    }

    const formattedPhone = formatPhone(phone);
    console.log('Processing OTP request for phone:', formattedPhone);

    // Check if user exists with this phone number
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, user_type')
      .eq('phone', formattedPhone)
      .single();

    if (userError || !userData) {
      console.log('No user found with phone:', formattedPhone);
      // Return success anyway to prevent phone enumeration attacks
      // But don't actually send an SMS
      return new Response(
        JSON.stringify({
          success: true,
          message: "If a user exists with this phone number, they will receive a code.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log('Found user:', userData.id, userData.email);

    // Rate limiting: Check for recent OTP requests (max 1 per minute)
    const { data: recentOtp } = await supabase
      .from('phone_otp_codes')
      .select('created_at')
      .eq('phone', formattedPhone)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentOtp) {
      console.log('Rate limited - recent OTP exists');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please wait 60 seconds before requesting another code.",
          rateLimited: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    // Generate OTP code
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('phone_otp_codes')
      .insert({
        phone: formattedPhone,
        code: otpCode,
        user_id: userData.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      throw new Error("Failed to generate verification code");
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const message = `Your ShoutOut login code is: ${otpCode}\n\nThis code expires in 5 minutes. Don't share it with anyone.`;

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: OTP_SMS_PHONE_NUMBER,
        Body: message,
      }),
    });

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.json();
      console.error('Twilio API error:', errorData);
      throw new Error(`Failed to send verification code`);
    }

    const twilioData = await twilioResponse.json();
    console.log('OTP SMS sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent!",
        // Return partial phone for display (last 4 digits)
        phoneHint: `***-***-${formattedPhone.slice(-4)}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send verification code",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

