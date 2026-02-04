import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SendGrid API key (same as used by process-email-flows)
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const FROM_EMAIL = "noreply@shoutout.us";

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Processing change phone request for:', normalizedEmail);

    // Look up user by email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !userData) {
      // Don't reveal if user exists or not
      console.log('No user found with email:', normalizedEmail);
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists with this email, a link will be sent.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Generate secure token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    const { error: insertError } = await supabase
      .from('phone_change_tokens')
      .insert({
        user_id: userData.id,
        token: token,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      // Table might not exist, create it
      if (insertError.code === '42P01') {
        console.log('Creating phone_change_tokens table...');
        throw new Error("Database not configured. Please contact support.");
      }
      console.error('Error storing token:', insertError);
      throw new Error("Failed to generate secure link");
    }

    // Determine the correct base URL based on environment
    const baseUrl = Deno.env.get("SITE_URL") || "https://shoutout.us";
    const changePhoneUrl = `${baseUrl}/change-phone/${token}`;

    // Send email via SendGrid
    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      throw new Error("Email service not configured");
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://shoutout.us/whiteicon.png" alt="ShoutOut" style="height: 60px;" />
        </div>
        
        <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">Update Your Phone Number</h1>
        
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Hi${userData.full_name ? ` ${userData.full_name}` : ''},
        </p>
        
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          You requested to update the phone number associated with your ShoutOut account. Click the button below to set a new phone number:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${changePhoneUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Update Phone Number
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">
          This link expires in 1 hour. If you didn't request this change, you can safely ignore this email.
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${changePhoneUrl}" style="color: #3b82f6; word-break: break-all;">${changePhoneUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} ShoutOut. All rights reserved.
        </p>
      </div>
    `;

    const textContent = `
Hi${userData.full_name ? ` ${userData.full_name}` : ''},

You requested to update the phone number associated with your ShoutOut account.

Click here to update your phone number: ${changePhoneUrl}

This link expires in 1 hour. If you didn't request this change, you can safely ignore this email.

© ${new Date().getFullYear()} ShoutOut. All rights reserved.
    `;

    const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: normalizedEmail }] }],
        from: { email: FROM_EMAIL, name: "ShoutOut" },
        subject: "Update Your Phone Number - ShoutOut",
        content: [
          { type: "text/plain", value: textContent },
          { type: "text/html", value: htmlContent },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('SendGrid API error:', errorText);
      throw new Error("Failed to send email");
    }

    console.log('Change phone email sent successfully to:', normalizedEmail);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending change phone email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send email",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
