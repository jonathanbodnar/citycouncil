import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prize types and their info
const PRIZES = {
  FREE_SHOUTOUT: { code: 'WINNER100', textMessage: 'a FREE personalized ShoutOut (up to $100 value) from top conservatives' },
  '15_OFF': { code: 'SAVE15', textMessage: '15% off a personalized ShoutOut from top conservatives' },
  '10_OFF': { code: 'SAVE10', textMessage: '10% off a personalized ShoutOut from top conservatives' },
  '25_DOLLARS': { code: 'TAKE25', textMessage: '$25 off a personalized ShoutOut from top conservatives' }
};

type Prize = keyof typeof PRIZES;

// Determine random prize
async function determinePrize(supabase: any): Promise<Prize> {
  // Check if free shoutout already won today (CST)
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, user_id, utm_source } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Processing delayed prize assignment for:', normalizedEmail);

    // Check if user has added phone in the meantime
    const { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('email', normalizedEmail)
      .single();

    if (user?.phone) {
      console.log('User already has phone, skipping email-only prize assignment');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'User has phone' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if user already has a prize (from beta_signups via phone or email flow)
    const { data: existingEmailFlow } = await supabase
      .from('user_email_flow_status')
      .select('coupon_code')
      .eq('email', normalizedEmail)
      .eq('flow_id', 'aaaa2222-2222-2222-2222-222222222222') // giveaway_welcome
      .single();

    if (existingEmailFlow?.coupon_code) {
      console.log('User already has coupon assigned:', existingEmailFlow.coupon_code);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Already has coupon' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Assign a random prize
    const prize = await determinePrize(supabase);
    const prizeInfo = PRIZES[prize];
    console.log('Assigned prize:', prize, prizeInfo.code);

    // Update the email flow status with the coupon code
    const { error: updateError } = await supabase
      .from('user_email_flow_status')
      .update({ 
        coupon_code: prizeInfo.code,
        metadata: { prize_type: prize, assigned_at: new Date().toISOString() }
      })
      .eq('email', normalizedEmail)
      .eq('flow_id', 'aaaa2222-2222-2222-2222-222222222222');

    if (updateError) {
      console.error('Error updating email flow with coupon:', updateError);
      // Try to insert if update failed (maybe flow wasn't created yet)
      const { error: insertError } = await supabase
        .from('user_email_flow_status')
        .insert({
          email: normalizedEmail,
          user_id: user_id || user?.id,
          flow_id: 'aaaa2222-2222-2222-2222-222222222222',
          current_message_order: 0,
          next_email_scheduled_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
          coupon_code: prizeInfo.code,
          source_url: utm_source || null,
          metadata: { prize_type: prize, assigned_at: new Date().toISOString() }
        });

      if (insertError && !insertError.message?.includes('duplicate')) {
        console.error('Error inserting email flow:', insertError);
      }
    }

    // Also create a record in beta_signups for email-only users
    // We'll use a placeholder phone format to track them
    const emailPlaceholderPhone = `+1000${normalizedEmail.replace(/[^0-9]/g, '').slice(0, 7).padEnd(7, '0')}`;
    
    const { error: betaError } = await supabase
      .from('beta_signups')
      .upsert({
        phone_number: emailPlaceholderPhone,
        source: 'holiday_popup_email_only',
        utm_source: utm_source || null,
        subscribed_at: new Date().toISOString(),
        prize_won: prize,
        email_address: normalizedEmail // Store email for reference
      }, {
        onConflict: 'phone_number'
      });

    if (betaError) {
      console.log('Beta signup note:', betaError.message);
    }

    console.log('Delayed prize assignment complete:', { email: normalizedEmail, prize, code: prizeInfo.code });

    return new Response(
      JSON.stringify({ 
        success: true, 
        prize, 
        code: prizeInfo.code,
        email: normalizedEmail 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error in delayed prize assignment:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to assign prize" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

