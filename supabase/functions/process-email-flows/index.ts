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

    // First, process any pending prize assignments (for email-only giveaway entries)
    await processPendingPrizeAssignments(supabase);

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

        // Get order info if this is a post-purchase flow
        let orderId = "";
        let orderTalentName = "";
        let recipientName = "";
        let occasion = "";
        let deliveryHours = "";
        let amount = "";
        
        if (userStatus.flow_id === 'bbbb5555-5555-5555-5555-555555555555') {
          // Post-purchase flow - fetch the user's most recent order
          const { data: order } = await supabase
            .from("orders")
            .select(`
              id,
              recipient_name,
              occasion,
              total_price,
              talent_profiles!inner(
                temp_full_name,
                fulfillment_time_hours
              )
            `)
            .eq("user_id", userStatus.user_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          
          if (order) {
            orderId = order.id.split('-')[0]; // Show shortened order ID
            orderTalentName = order.talent_profiles?.temp_full_name || "";
            recipientName = order.recipient_name || "";
            occasion = order.occasion || "Special Occasion";
            deliveryHours = order.talent_profiles?.fulfillment_time_hours?.toString() || "48";
            amount = order.total_price?.toFixed(2) || "0.00";
          }
        }

        // Get talent info if from bio page
        let talentName = "";
        let talentPhotoUrl = "";
        let talentProfileLink = "https://shoutout.us";
        let talentPhotoHtml = "";
        
        if (userStatus.source_talent_slug) {
          const { data: talent } = await supabase
            .from("talent_profiles")
            .select("temp_full_name, temp_avatar_url, slug, username")
            .eq("slug", userStatus.source_talent_slug)
            .single();
          if (talent) {
            talentName = talent.temp_full_name || "";
            talentPhotoUrl = talent.temp_avatar_url || "";
            const talentSlug = talent.slug || talent.username || userStatus.source_talent_slug;
            talentProfileLink = `https://shoutout.us/${talentSlug}`;
            
            // Generate talent photo HTML for email header (circular)
            if (talentPhotoUrl) {
              talentPhotoHtml = `<img src="${talentPhotoUrl}" alt="${talentName}" width="100" height="100" style="border-radius: 50%; border: 3px solid rgba(124, 58, 237, 0.5); object-fit: cover;">`;
            } else {
              // Fallback to initials avatar
              const initials = talentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              talentPhotoHtml = `<div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; color: white;">${initials}</div>`;
            }
          }
        }
        
        // Generate square talent photo for ShoutOut card (120x120)
        let talentPhotoSquare = "";
        if (userStatus.source_talent_slug && talentPhotoUrl) {
          talentPhotoSquare = `<img src="${talentPhotoUrl}" alt="${talentName}" width="120" height="120" style="width: 120px; height: 120px; object-fit: cover; display: block;">`;
        } else if (userStatus.source_talent_slug && talentName) {
          // Fallback: show initials in square format
          const initials = talentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
          talentPhotoSquare = `<div style="width: 120px; height: 120px; background: linear-gradient(135deg, #7c3aed, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: bold; color: white;">${initials}</div>`;
        }

        // Build the email content with variable replacement
        let htmlContent = nextMessage.html_content;
        let subject = nextMessage.subject;
        const couponCode = nextMessage.coupon_code || userStatus.coupon_code || "";

        // Replace variables
        const unsubscribeUrl = `https://shoutout.us/unsubscribe?email=${encodeURIComponent(userStatus.email)}`;
        const reviewLink = `https://shoutout.us/review?email=${encodeURIComponent(userStatus.email)}`;
        
        htmlContent = htmlContent
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{full_name\}\}/g, fullName)
          .replace(/\{\{coupon_code\}\}/g, couponCode)
          .replace(/\{\{talent_name\}\}/g, orderTalentName || talentName)
          .replace(/\{\{talent\}\}/g, orderTalentName || talentName)
          .replace(/\{\{talent_photo_html\}\}/g, talentPhotoHtml)
          .replace(/\{\{talent_photo_square\}\}/g, talentPhotoSquare)
          .replace(/\{\{talent_photo_url\}\}/g, talentPhotoUrl)
          .replace(/\{\{talent_profile_link\}\}/g, talentProfileLink)
          .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
          .replace(/\{\{review_link\}\}/g, reviewLink)
          .replace(/\{\{email\}\}/g, userStatus.email)
          .replace(/\{\{order_id\}\}/g, orderId)
          .replace(/\{\{recipient_name\}\}/g, recipientName)
          .replace(/\{\{occasion\}\}/g, occasion)
          .replace(/\{\{delivery_hours\}\}/g, deliveryHours)
          .replace(/\{\{amount\}\}/g, amount);

        subject = subject
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{talent_name\}\}/g, orderTalentName || talentName)
          .replace(/\{\{talent\}\}/g, orderTalentName || talentName)
          .replace(/\{\{coupon_code\}\}/g, couponCode)
          .replace(/\{\{order_id\}\}/g, orderId);

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
              click_tracking: { enable: false },
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

          // Pause the flow immediately - no point retrying invalid emails
          console.log(`⏸️ Pausing flow for ${userStatus.email} due to send failure`);
          await supabase
            .from("user_email_flow_status")
            .update({
              is_paused: true,
              metadata: {
                ...userStatus.metadata,
                pause_reason: `Send failed: ${errorText.substring(0, 200)}`,
                paused_at: now
              },
              updated_at: now,
            })
            .eq("id", userStatus.id);

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

// Prize types and their info
const PRIZES: Record<string, { code: string; textMessage: string }> = {
  FREE_SHOUTOUT: { code: 'WINNER100', textMessage: 'a FREE personalized ShoutOut (up to $100 value) from top conservatives' },
  '15_OFF': { code: 'SAVE15', textMessage: '15% off a personalized ShoutOut from top conservatives' },
  '10_OFF': { code: 'SAVE10', textMessage: '10% off a personalized ShoutOut from top conservatives' },
  '25_DOLLARS': { code: 'TAKE25', textMessage: '$25 off a personalized ShoutOut from top conservatives' }
};

type Prize = 'FREE_SHOUTOUT' | '15_OFF' | '10_OFF' | '25_DOLLARS';

// Determine random prize
async function determinePrize(supabase: any): Promise<Prize> {
  const now = new Date();
  const cstOffset = -6 * 60;
  const cstTime = new Date(now.getTime() + (cstOffset - now.getTimezoneOffset()) * 60000);
  const todayCST = cstTime.toISOString().split('T')[0];
  
  const cstDayStartUTC = new Date(`${todayCST}T00:00:00-06:00`).toISOString();
  const cstDayEndUTC = new Date(`${todayCST}T23:59:59-06:00`).toISOString();
  
  const { data: todayWinners } = await supabase
    .from('beta_signups')
    .select('id')
    .eq('source', 'holiday_popup')
    .eq('prize_won', 'FREE_SHOUTOUT')
    .gte('subscribed_at', cstDayStartUTC)
    .lte('subscribed_at', cstDayEndUTC)
    .limit(1);

  const canWinFreeShoutout = !todayWinners || todayWinners.length === 0;
  const rand = Math.random() * 100;
  
  if (canWinFreeShoutout && rand < 25) {
    return 'FREE_SHOUTOUT';
  } else if (rand < 50) {
    return '15_OFF';
  } else if (rand < 75) {
    return '10_OFF';
  } else {
    return '25_DOLLARS';
  }
}

// Process pending prize assignments for email-only giveaway entries
async function processPendingPrizeAssignments(supabase: any) {
  const now = new Date().toISOString();
  
  // Get pending assignments that are due (scheduled_for has passed)
  const { data: pendingAssignments, error } = await supabase
    .from('pending_prize_assignments')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(20);

  if (error) {
    console.log('Note: pending_prize_assignments table may not exist yet:', error.message);
    return;
  }

  if (!pendingAssignments || pendingAssignments.length === 0) {
    return;
  }

  console.log(`🎁 Processing ${pendingAssignments.length} pending prize assignments`);

  for (const assignment of pendingAssignments) {
    try {
      // Check if user has added phone in the meantime
      const { data: user } = await supabase
        .from('users')
        .select('id, phone')
        .eq('email', assignment.email)
        .single();

      if (user?.phone) {
        // User added phone - skip (they'll get prize through normal flow)
        console.log(`⏭️ Skipping ${assignment.email} - phone was added`);
        await supabase
          .from('pending_prize_assignments')
          .update({ 
            status: 'skipped', 
            skip_reason: 'Phone added by user',
            processed_at: now 
          })
          .eq('id', assignment.id);
        continue;
      }

      // Check if user already has a coupon in their email flow
      const { data: existingFlow } = await supabase
        .from('user_email_flow_status')
        .select('coupon_code')
        .eq('email', assignment.email)
        .eq('flow_id', 'aaaa2222-2222-2222-2222-222222222222')
        .single();

      if (existingFlow?.coupon_code) {
        console.log(`⏭️ Skipping ${assignment.email} - already has coupon`);
        await supabase
          .from('pending_prize_assignments')
          .update({ 
            status: 'skipped', 
            skip_reason: 'Already has coupon',
            processed_at: now 
          })
          .eq('id', assignment.id);
        continue;
      }

      // Assign a random prize
      const prize = await determinePrize(supabase);
      const prizeInfo = PRIZES[prize];
      console.log(`🎉 Assigning prize to ${assignment.email}: ${prize} (${prizeInfo.code})`);

      // Update the email flow status with the coupon code
      const { error: updateError } = await supabase
        .from('user_email_flow_status')
        .update({ 
          coupon_code: prizeInfo.code,
          metadata: { prize_type: prize, assigned_at: now }
        })
        .eq('email', assignment.email)
        .eq('flow_id', 'aaaa2222-2222-2222-2222-222222222222');

      if (updateError) {
        // Try to insert if update failed
        await supabase
          .from('user_email_flow_status')
          .insert({
            email: assignment.email,
            user_id: assignment.user_id || user?.id,
            flow_id: 'aaaa2222-2222-2222-2222-222222222222',
            current_message_order: 0,
            next_email_scheduled_at: new Date(Date.now() + 60000).toISOString(),
            coupon_code: prizeInfo.code,
            source_url: assignment.utm_source || null,
            metadata: { prize_type: prize, assigned_at: now }
          });
      }

      // Mark assignment as processed
      await supabase
        .from('pending_prize_assignments')
        .update({ 
          status: 'processed', 
          prize_assigned: prize,
          coupon_code: prizeInfo.code,
          processed_at: now 
        })
        .eq('id', assignment.id);

      console.log(`✅ Prize assigned to ${assignment.email}: ${prizeInfo.code}`);

    } catch (err: any) {
      console.error(`Error processing assignment for ${assignment.email}:`, err);
    }
  }
}

