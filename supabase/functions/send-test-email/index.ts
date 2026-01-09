import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");

    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    const { to_email, subject, html_content } = await req.json();

    if (!to_email || !subject || !html_content) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to_email, subject, html_content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`📧 Sending test email to ${to_email}: "${subject}"`);

    const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to_email }],
        }],
        from: {
          email: "noreply@shoutout.us",
          name: "ShoutOut",
        },
        subject: subject,
        content: [
          {
            type: "text/html",
            value: html_content,
          },
        ],
        tracking_settings: {
          click_tracking: { enable: false },
          open_tracking: { enable: false },
        },
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error("SendGrid error:", errorText);
      throw new Error(`SendGrid error: ${errorText}`);
    }

    console.log("✅ Test email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: `Test email sent to ${to_email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

