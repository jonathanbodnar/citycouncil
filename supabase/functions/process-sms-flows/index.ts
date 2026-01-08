import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowMessage {
  id: string;
  flow_id: string;
  sequence_order: number;
  message_text: string;
  delay_hours: number;
  delay_days: number;
  include_coupon: boolean;
  include_link: boolean;
  link_utm: string;
  is_active: boolean;
}

interface UserFlowStatus {
  id: string;
  phone: string;
  user_id: string;
  flow_id: string;
  current_message_order: number;
  coupon_code: string;
  metadata: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("🔄 Processing SMS flows...");

    // Get all users who are due for their next message
    const now = new Date().toISOString();
    const { data: dueUsers, error: dueError } = await supabase
      .from("user_sms_flow_status")
      .select(`
        *,
        sms_flows!inner(id, name, is_active)
      `)
      .is("flow_completed_at", null)
      .eq("is_paused", false)
      .lte("next_message_scheduled_at", now)
      .limit(100); // Process in batches

    if (dueError) {
      console.error("Error fetching due users:", dueError);
      throw dueError;
    }

    console.log(`📬 Found ${dueUsers?.length || 0} users due for messages`);

    let sentCount = 0;
    let errorCount = 0;

    for (const userStatus of dueUsers || []) {
      try {
        // Skip if flow is not active
        if (!userStatus.sms_flows?.is_active) {
          console.log(`⏭️ Skipping ${userStatus.phone} - flow ${userStatus.sms_flows?.name} is inactive`);
          continue;
        }

        // Get the next message in the sequence
        const nextMessageOrder = userStatus.current_message_order + 1;
        const { data: nextMessage, error: msgError } = await supabase
          .from("sms_flow_messages")
          .select("*")
          .eq("flow_id", userStatus.flow_id)
          .eq("sequence_order", nextMessageOrder)
          .eq("is_active", true)
          .single();

        if (msgError || !nextMessage) {
          // No more messages in flow - mark as completed
          console.log(`✅ Flow completed for ${userStatus.phone}`);
          await supabase
            .from("user_sms_flow_status")
            .update({
              flow_completed_at: now,
              updated_at: now,
            })
            .eq("id", userStatus.id);
          continue;
        }

        // Build the message
        let messageText = nextMessage.message_text;

        // Replace placeholders
        if (userStatus.metadata?.talent_name) {
          messageText = messageText.replace("{talent_name}", userStatus.metadata.talent_name);
        }

        // Add coupon code if needed
        if (nextMessage.include_coupon && userStatus.coupon_code) {
          // If message already has a URL, append coupon parameter
          if (messageText.includes("shoutout.us")) {
            const separator = messageText.includes("?") ? "&" : "?";
            messageText = messageText.replace(
              /(https:\/\/shoutout\.us[^\s]*)/,
              `$1${separator}coupon=${userStatus.coupon_code}`
            );
          } else {
            // Add URL with coupon
            const utm = nextMessage.link_utm || "sms";
            messageText += `\nhttps://shoutout.us?utm=${utm}&coupon=${userStatus.coupon_code}`;
          }
        }

        // Send the SMS
        console.log(`📤 Sending to ${userStatus.phone}: ${messageText.substring(0, 50)}...`);

        const { error: smsError } = await supabase.functions.invoke("send-sms", {
          body: {
            to: userStatus.phone,
            message: messageText,
            useUserNumber: true,
          },
        });

        if (smsError) {
          console.error(`❌ SMS send error for ${userStatus.phone}:`, smsError);
          errorCount++;

          // Log the failure
          await supabase.from("sms_send_log").insert({
            phone: userStatus.phone,
            user_id: userStatus.user_id,
            flow_id: userStatus.flow_id,
            message_id: nextMessage.id,
            message_text: messageText,
            status: "failed",
            error_message: smsError.message || "Unknown error",
          });

          continue;
        }

        // Log success
        await supabase.from("sms_send_log").insert({
          phone: userStatus.phone,
          user_id: userStatus.user_id,
          flow_id: userStatus.flow_id,
          message_id: nextMessage.id,
          message_text: messageText,
          status: "sent",
        });

        // Calculate next scheduled time
        const nextScheduledAt = new Date();
        
        // Get the NEXT message after this one to calculate delay
        const { data: followingMessage } = await supabase
          .from("sms_flow_messages")
          .select("delay_hours, delay_days")
          .eq("flow_id", userStatus.flow_id)
          .eq("sequence_order", nextMessageOrder + 1)
          .eq("is_active", true)
          .single();

        if (followingMessage) {
          nextScheduledAt.setDate(nextScheduledAt.getDate() + (followingMessage.delay_days || 0));
          nextScheduledAt.setHours(nextScheduledAt.getHours() + (followingMessage.delay_hours || 0));
        }

        // Update user status
        await supabase
          .from("user_sms_flow_status")
          .update({
            current_message_order: nextMessageOrder,
            last_message_sent_at: now,
            next_message_scheduled_at: followingMessage ? nextScheduledAt.toISOString() : null,
            updated_at: now,
          })
          .eq("id", userStatus.id);

        sentCount++;
        console.log(`✅ Sent message #${nextMessageOrder} to ${userStatus.phone}`);

      } catch (userError: any) {
        console.error(`Error processing user ${userStatus.phone}:`, userError);
        errorCount++;
      }
    }

    // Also check for new giveaway entries that need to start the welcome flow
    await processNewGiveawayEntries(supabase);

    // Check for 72-hour followup flow
    await process72HourFollowup(supabase);

    // Check for users ready to start ongoing flow
    await processOngoingFlowStart(supabase);

    console.log(`✅ Processing complete: ${sentCount} sent, ${errorCount} errors`);

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
    console.error("Error processing SMS flows:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Process new giveaway entries - add them to welcome flow
async function processNewGiveawayEntries(supabase: any) {
  console.log("🎁 Checking for new giveaway entries...");

  // Get giveaway entries from last 24 hours that aren't in the welcome flow yet
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: newEntries, error } = await supabase
    .from("beta_signups")
    .select("phone_number, email, prize_won")
    .gte("created_at", yesterday.toISOString())
    .not("phone_number", "is", null);

  if (error) {
    console.error("Error fetching giveaway entries:", error);
    return;
  }

  const welcomeFlowId = "11111111-1111-1111-1111-111111111111";
  const followupFlowId = "22222222-2222-2222-2222-222222222222";

  for (const entry of newEntries || []) {
    // Check if already in flow
    const { data: existing } = await supabase
      .from("user_sms_flow_status")
      .select("id")
      .eq("phone", entry.phone_number)
      .eq("flow_id", welcomeFlowId)
      .single();

    if (existing) continue;

    // Get user ID if exists
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("phone", entry.phone_number)
      .single();

    // Get coupon code based on prize
    const couponCodes: Record<string, string> = {
      FREE_SHOUTOUT: "WINNER100",
      "15_OFF": "SAVE15",
      "10_OFF": "SAVE10",
      "25_DOLLARS": "TAKE25",
    };
    const couponCode = couponCodes[entry.prize_won] || "";

    // Add to welcome flow (immediate send)
    const { error: insertError } = await supabase.from("user_sms_flow_status").insert({
      phone: entry.phone_number,
      user_id: user?.id || null,
      flow_id: welcomeFlowId,
      current_message_order: 0,
      next_message_scheduled_at: new Date().toISOString(), // Send immediately
      coupon_code: couponCode,
    });

    if (insertError && !insertError.message?.includes("duplicate")) {
      console.error("Error adding to welcome flow:", insertError);
    } else {
      console.log(`➕ Added ${entry.phone_number} to welcome flow`);
    }

    // Also schedule for 72-hour followup
    const followupTime = new Date();
    followupTime.setHours(followupTime.getHours() + 72);

    await supabase.from("user_sms_flow_status").insert({
      phone: entry.phone_number,
      user_id: user?.id || null,
      flow_id: followupFlowId,
      current_message_order: 0,
      next_message_scheduled_at: followupTime.toISOString(),
      coupon_code: couponCode,
    }).catch(() => {}); // Ignore duplicates
  }
}

// Process 72-hour followup - only send if coupon not used
async function process72HourFollowup(supabase: any) {
  console.log("⏰ Checking 72-hour followup eligibility...");

  const followupFlowId = "22222222-2222-2222-2222-222222222222";
  const now = new Date().toISOString();

  // Get users due for followup
  const { data: dueFollowups } = await supabase
    .from("user_sms_flow_status")
    .select("*")
    .eq("flow_id", followupFlowId)
    .eq("current_message_order", 0)
    .lte("next_message_scheduled_at", now)
    .is("flow_completed_at", null);

  for (const status of dueFollowups || []) {
    // Check if coupon was used (order placed with this coupon)
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("coupon_code", status.coupon_code)
      .limit(1);

    if (orders && orders.length > 0) {
      // Coupon used - skip followup and mark complete
      console.log(`⏭️ Skipping followup for ${status.phone} - coupon used`);
      await supabase
        .from("user_sms_flow_status")
        .update({
          flow_completed_at: now,
          coupon_used: true,
        })
        .eq("id", status.id);
    }
    // If coupon not used, the regular flow processing will handle sending
  }
}

// Start ongoing flow for users who completed followup 1 week ago
async function processOngoingFlowStart(supabase: any) {
  console.log("📱 Checking for ongoing flow eligibility...");

  const followupFlowId = "22222222-2222-2222-2222-222222222222";
  const ongoingFlowId = "33333333-3333-3333-3333-333333333333";

  // Get users who completed followup flow at least 7 days ago
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: completedFollowups } = await supabase
    .from("user_sms_flow_status")
    .select("phone, user_id, coupon_code")
    .eq("flow_id", followupFlowId)
    .not("flow_completed_at", "is", null)
    .lte("flow_completed_at", weekAgo.toISOString());

  for (const status of completedFollowups || []) {
    // Check if already in ongoing flow
    const { data: existing } = await supabase
      .from("user_sms_flow_status")
      .select("id")
      .eq("phone", status.phone)
      .eq("flow_id", ongoingFlowId)
      .single();

    if (existing) continue;

    // Add to ongoing flow
    const { error } = await supabase.from("user_sms_flow_status").insert({
      phone: status.phone,
      user_id: status.user_id,
      flow_id: ongoingFlowId,
      current_message_order: 0,
      next_message_scheduled_at: new Date().toISOString(), // Start immediately
      coupon_code: status.coupon_code,
    });

    if (!error) {
      console.log(`➕ Added ${status.phone} to ongoing flow`);
    }
  }
}

