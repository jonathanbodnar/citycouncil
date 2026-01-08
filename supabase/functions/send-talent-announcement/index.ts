import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { talentId, talentName, talentUsername } = await req.json();

    if (!talentId || !talentName || !talentUsername) {
      throw new Error("Missing required fields: talentId, talentName, talentUsername");
    }

    console.log(`📢 Sending talent announcement for ${talentName}`);

    // Create a unique 24-hour coupon for this talent announcement
    const couponCode = `NEW${talentUsername.toUpperCase().substring(0, 6)}25`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create the coupon in the database
    const { error: couponError } = await supabase.from("coupons").insert({
      code: couponCode,
      discount_type: "percentage",
      discount_value: 25,
      expires_at: expiresAt.toISOString(),
      max_uses: null, // Unlimited uses
      current_uses: 0,
      is_active: true,
      talent_id: talentId, // Only valid for this talent
      description: `25% off ${talentName} - New Talent Announcement`,
    });

    if (couponError && !couponError.message?.includes("duplicate")) {
      console.error("Error creating coupon:", couponError);
      // Continue anyway - coupon might already exist
    }

    // Get all users with phone numbers (excluding talent users)
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, phone, full_name")
      .not("phone", "is", null)
      .neq("user_type", "talent")
      .neq("user_type", "admin");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`📱 Sending to ${users?.length || 0} users`);

    // Also get giveaway entries with phones (some might not be in users table)
    const { data: giveawayEntries } = await supabase
      .from("beta_signups")
      .select("phone_number")
      .not("phone_number", "is", null);

    // Combine and dedupe phone numbers
    const phoneSet = new Set<string>();
    users?.forEach((u) => u.phone && phoneSet.add(u.phone));
    giveawayEntries?.forEach((e) => e.phone_number && phoneSet.add(e.phone_number));

    const allPhones = Array.from(phoneSet);
    console.log(`📱 Total unique phones: ${allPhones.length}`);

    // Build announcement messages
    const message1 = `We're excited to announce that ${talentName} is now on ShoutOut! 🎉 Get 25% off a personalized video ShoutOut from them today only.`;
    const message2 = `https://shoutout.us/${talentUsername}?utm=announcement&coupon=${couponCode}`;

    let sentCount = 0;
    let errorCount = 0;

    // Send to all phones in batches
    const batchSize = 50;
    for (let i = 0; i < allPhones.length; i += batchSize) {
      const batch = allPhones.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (phone) => {
          try {
            // Send first message
            await supabase.functions.invoke("send-sms", {
              body: {
                to: phone,
                message: message1,
                useUserNumber: true,
              },
            });

            // Small delay then send second message with link
            await new Promise((resolve) => setTimeout(resolve, 500));

            await supabase.functions.invoke("send-sms", {
              body: {
                to: phone,
                message: message2,
                useUserNumber: true,
              },
            });

            // Log the send
            await supabase.from("sms_send_log").insert({
              phone,
              flow_id: "44444444-4444-4444-4444-444444444444",
              message_text: `${message1}\n${message2}`,
              status: "sent",
              metadata: { talent_id: talentId, talent_name: talentName },
            });

            sentCount++;
          } catch (error: any) {
            console.error(`Error sending to ${phone}:`, error);
            errorCount++;
          }
        })
      );

      // Rate limiting between batches
      if (i + batchSize < allPhones.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Announcement complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        errors: errorCount,
        total: allPhones.length,
        couponCode,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending talent announcement:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

