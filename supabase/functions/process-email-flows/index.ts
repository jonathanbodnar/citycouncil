import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailFlowMessage {
  id: string;
  flow_id: string;
  sequence_order: number;
  subject: string;
  preview_text: string;
  html_content: string;
  plain_text_content: string;
  delay_minutes: number;
  delay_hours: number;
  delay_days: number;
  send_at_time: string | null;
  include_coupon: boolean;
  coupon_code: string | null;
  is_active: boolean;
}

interface UserFlowStatus {
  id: string;
  email: string;
  user_id: string;
  flow_id: string;
  current_message_order: number;
  coupon_code: string;
  source_talent_slug: string;
  metadata: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");

    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("📧 Processing email flows...");

    // Get all users who are due for their next email
    const now = new Date().toISOString();
    const { data: dueUsers, error: dueError } = await supabase
      .from("user_email_flow_status")
      .select(`
        *,
        email_flows!inner(id, name, display_name, is_active)
      `)
      .is("flow_completed_at", null)
      .eq("is_paused", false)
      .eq("unsubscribed", false)
      .lte("next_email_scheduled_at", now)
      .limit(50); // Process in smaller batches for emails

    if (dueError) {
      console.error("Error fetching due users:", dueError);
      throw dueError;
    }

    console.log(`📬 Found ${dueUsers?.length || 0} users due for emails`);

    let sentCount = 0;
    let errorCount = 0;

    for (const userStatus of dueUsers || []) {
      try {
        // Skip if flow is not active
        if (!userStatus.email_flows?.is_active) {
          console.log(`⏭️ Skipping ${userStatus.email} - flow ${userStatus.email_flows?.name} is inactive`);
          continue;
        }

        // Check if user has unsubscribed globally
        const { data: unsubscribed } = await supabase
          .from("email_unsubscribes")
          .select("id")
          .eq("email", userStatus.email)
          .single();

        if (unsubscribed) {
          console.log(`⏭️ Skipping ${userStatus.email} - globally unsubscribed`);
          await supabase
            .from("user_email_flow_status")
            .update({ unsubscribed: true, updated_at: now })
            .eq("id", userStatus.id);
          continue;
        }

        // Get the next message in the sequence
        const nextMessageOrder = userStatus.current_message_order + 1;
        const { data: nextMessage, error: msgError } = await supabase
          .from("email_flow_messages")
          .select("*")
          .eq("flow_id", userStatus.flow_id)
          .eq("sequence_order", nextMessageOrder)
          .eq("is_active", true)
          .single();

        if (msgError || !nextMessage) {
          // No more messages in flow - mark as completed
          console.log(`✅ Flow completed for ${userStatus.email}`);
          await supabase
            .from("user_email_flow_status")
            .update({
              flow_completed_at: now,
              updated_at: now,
            })
            .eq("id", userStatus.id);
          continue;
        }

        // Get user info for personalization
        let firstName = "there";
        let fullName = "";
        if (userStatus.user_id) {
          const { data: user } = await supabase
            .from("users")
            .select("full_name")
            .eq("id", userStatus.user_id)
            .single();
          if (user?.full_name) {
            fullName = user.full_name;
            firstName = user.full_name.split(" ")[0];
          }
        }

        // Get talent name if from bio page
        let talentName = "";
        if (userStatus.source_talent_slug) {
          const { data: talent } = await supabase
            .from("talent_profiles")
            .select("temp_full_name")
            .eq("slug", userStatus.source_talent_slug)
            .single();
          if (talent?.temp_full_name) {
            talentName = talent.temp_full_name;
          }
        }

        // Build the email content with variable replacement
        let htmlContent = nextMessage.html_content;
        let subject = nextMessage.subject;
        const couponCode = nextMessage.coupon_code || userStatus.coupon_code || "";

        // Replace variables
        const unsubscribeUrl = `https://shoutout.us/unsubscribe?email=${encodeURIComponent(userStatus.email)}`;
        
        htmlContent = htmlContent
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{full_name\}\}/g, fullName)
          .replace(/\{\{coupon_code\}\}/g, couponCode)
          .replace(/\{\{talent_name\}\}/g, talentName)
          .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
          .replace(/\{\{email\}\}/g, userStatus.email);

        subject = subject
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{talent_name\}\}/g, talentName)
          .replace(/\{\{coupon_code\}\}/g, couponCode);

        // Send the email via SendGrid
        console.log(`📤 Sending email to ${userStatus.email}: "${subject}"`);

        const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: userStatus.email }],
            }],
            from: {
              email: "noreply@shoutout.us",
              name: "ShoutOut",
            },
            subject: subject,
            content: [
              {
                type: "text/html",
                value: htmlContent,
              },
            ],
            tracking_settings: {
              click_tracking: { enable: true },
              open_tracking: { enable: true },
            },
          }),
        });

        if (!sendGridResponse.ok) {
          const errorText = await sendGridResponse.text();
          console.error(`❌ SendGrid error for ${userStatus.email}:`, errorText);
          errorCount++;

          // Log the failure
          await supabase.from("email_send_log").insert({
            email: userStatus.email,
            user_id: userStatus.user_id,
            flow_id: userStatus.flow_id,
            message_id: nextMessage.id,
            subject: subject,
            status: "failed",
            error_message: errorText,
          });

          continue;
        }

        // Get SendGrid message ID from headers
        const sendgridMessageId = sendGridResponse.headers.get("X-Message-Id") || null;

        // Log success
        await supabase.from("email_send_log").insert({
          email: userStatus.email,
          user_id: userStatus.user_id,
          flow_id: userStatus.flow_id,
          message_id: nextMessage.id,
          subject: subject,
          sendgrid_message_id: sendgridMessageId,
          status: "sent",
        });

        // Calculate next scheduled time
        const nextScheduledAt = new Date();
        
        // Get the NEXT message after this one to calculate delay
        const { data: followingMessage } = await supabase
          .from("email_flow_messages")
          .select("delay_minutes, delay_hours, delay_days, send_at_time")
          .eq("flow_id", userStatus.flow_id)
          .eq("sequence_order", nextMessageOrder + 1)
          .eq("is_active", true)
          .single();

        if (followingMessage) {
          nextScheduledAt.setDate(nextScheduledAt.getDate() + (followingMessage.delay_days || 0));
          nextScheduledAt.setHours(nextScheduledAt.getHours() + (followingMessage.delay_hours || 0));
          nextScheduledAt.setMinutes(nextScheduledAt.getMinutes() + (followingMessage.delay_minutes || 0));

          // If specific send time is set, adjust to that time
          if (followingMessage.send_at_time) {
            const [hours, minutes] = followingMessage.send_at_time.split(":").map(Number);
            nextScheduledAt.setHours(hours, minutes, 0, 0);
            // If the time has already passed today, schedule for tomorrow
            if (nextScheduledAt < new Date()) {
              nextScheduledAt.setDate(nextScheduledAt.getDate() + 1);
            }
          }
        }

        // Update user status
        await supabase
          .from("user_email_flow_status")
          .update({
            current_message_order: nextMessageOrder,
            last_email_sent_at: now,
            next_email_scheduled_at: followingMessage ? nextScheduledAt.toISOString() : null,
            updated_at: now,
          })
          .eq("id", userStatus.id);

        sentCount++;
        console.log(`✅ Sent email #${nextMessageOrder} to ${userStatus.email}`);

        // Add a small delay between emails to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (userError: any) {
        console.error(`Error processing user ${userStatus.email}:`, userError);
        errorCount++;
      }
    }

    console.log(`✅ Email processing complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        errors: errorCount,
        processed: dueUsers?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing email flows:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

