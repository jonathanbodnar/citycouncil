import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format phone to E.164
function formatPhone(phone: string): string {
  if (!phone) return '';
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, phone, source, utm_source, talent_slug } = await req.json();

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Email or phone required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const normalizedEmail = email?.toLowerCase().trim() || null;
    const formattedPhone = phone ? formatPhone(phone) : null;

    console.log('Capturing lead:', { email: normalizedEmail, phone: formattedPhone, source });

    // Check if user already exists by email or phone
    let existingUser = null;

    if (normalizedEmail) {
      const { data } = await supabase
        .from('users')
        .select('id, email, phone')
        .eq('email', normalizedEmail)
        .single();
      existingUser = data;
    }

    if (!existingUser && formattedPhone) {
      const { data } = await supabase
        .from('users')
        .select('id, email, phone')
        .eq('phone', formattedPhone)
        .single();
      existingUser = data;
    }

    if (existingUser) {
      // User exists - update with any new info
      const updates: any = {};
      if (normalizedEmail && !existingUser.email) {
        updates.email = normalizedEmail;
      }
      if (formattedPhone && !existingUser.phone) {
        updates.phone = formattedPhone;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('users')
          .update(updates)
          .eq('id', existingUser.id);
        console.log('Updated existing user:', existingUser.id, updates);
      } else {
        console.log('User already exists with all info:', existingUser.id);
      }

      // IMPORTANT: Still ensure beta_signups entry exists for giveaway tracking
      // This handles the case where user exists but hasn't done the giveaway popup yet
      // Note: beta_signups only has phone_number column, not email
      if (source === 'holiday_popup' && formattedPhone) {
        // Check if they already have a beta_signups entry
        const { data: existingSignup } = await supabase
          .from('beta_signups')
          .select('id, source')
          .eq('phone_number', formattedPhone)
          .single();

        if (!existingSignup) {
          // Create new entry
          const { error: insertErr } = await supabase
            .from('beta_signups')
            .insert({
              phone_number: formattedPhone,
              source: 'holiday_popup',
              utm_source: utm_source || null,
              subscribed_at: new Date().toISOString(),
            });
          if (insertErr) {
            console.error('Error creating beta_signups:', insertErr.message);
          } else {
            console.log('Created beta_signups entry for existing user');
          }
        } else if (existingSignup.source !== 'holiday_popup') {
          // Update existing entry to mark as holiday_popup
          await supabase
            .from('beta_signups')
            .update({ source: 'holiday_popup', utm_source: utm_source || null })
            .eq('id', existingSignup.id);
          console.log('Updated beta_signups source to holiday_popup');
        }
      }

      return new Response(
        JSON.stringify({ success: true, existing: true, userId: existingUser.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create new partial user (no auth account yet)
    // Generate a placeholder UUID for the user
    const placeholderId = crypto.randomUUID();
    
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: placeholderId,
        email: normalizedEmail,
        phone: formattedPhone,
        full_name: normalizedEmail ? normalizedEmail.split('@')[0] : null,
        user_type: 'user',
        promo_source: utm_source || source || null,
        sms_subscribed: !!formattedPhone, // Subscribe to SMS if they gave phone
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // Could be duplicate - that's fine
      if (insertError.code === '23505') {
        console.log('Lead already captured (duplicate)');
        return new Response(
          JSON.stringify({ success: true, existing: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      console.error('Error capturing lead:', insertError);
      throw insertError;
    }

    console.log('New lead captured:', newUser.id);

    // Enroll user in appropriate email flow based on source
    await enrollInEmailFlow(supabase, normalizedEmail, newUser.id, source, talent_slug, utm_source);

    // For email-only giveaway entries, schedule delayed prize assignment (60 seconds)
    // This gives them time to add their phone, but if they don't, they still get a prize via email
    if ((source === 'holiday_popup' || source === 'giveaway') && normalizedEmail && !formattedPhone) {
      console.log('Scheduling delayed prize assignment for email-only giveaway entry');
      
      // Use pg_net to schedule a delayed call (60 seconds)
      // First, store a pending assignment record
      const { error: pendingError } = await supabase
        .from('pending_prize_assignments')
        .insert({
          email: normalizedEmail,
          user_id: newUser.id,
          utm_source: utm_source || null,
          scheduled_for: new Date(Date.now() + 60000).toISOString(), // 60 seconds from now
          status: 'pending'
        });
      
      if (pendingError) {
        console.log('Pending prize assignment note:', pendingError.message);
      }
    }

    // Also save to beta_signups for giveaway tracking and analytics
    // Note: beta_signups only has phone_number, not email column
    if (formattedPhone) {
      console.log('Inserting into beta_signups:', { 
        phone: formattedPhone, 
        source: source || 'login_form' 
      });
      
      const { error: betaError } = await supabase
        .from('beta_signups')
        .insert({
          phone_number: formattedPhone,
          source: source || 'login_form',
          utm_source: utm_source || null,
          subscribed_at: new Date().toISOString(),
        });
      
      if (betaError) {
        console.error('Beta signup insert error:', betaError.code, betaError.message);
        // If it's a duplicate, that's fine - but log it
        if (betaError.code === '23505') {
          console.log('Beta signup already exists (duplicate key)');
        }
      } else {
        console.log('Beta signup created successfully');
      }
    }

    return new Response(
      JSON.stringify({ success: true, existing: false, userId: newUser.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error capturing lead:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to capture lead" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Enroll user in email flow based on their source
async function enrollInEmailFlow(
  supabase: any, 
  email: string | null, 
  userId: string, 
  source: string | null,
  talentSlug: string | null,
  utmSource: string | null
) {
  if (!email) return;

  try {
    // Determine which flow to enroll in based on source
    let flowId: string | null = null;
    
    if (source === 'bio_page' || talentSlug) {
      flowId = 'aaaa1111-1111-1111-1111-111111111111'; // bio_page_welcome
    } else if (source === 'holiday_popup' || source === 'giveaway') {
      flowId = 'aaaa2222-2222-2222-2222-222222222222'; // giveaway_welcome
    } else if (source === 'login_form' || source === 'signup' || source === 'direct') {
      flowId = 'aaaa3333-3333-3333-3333-333333333333'; // direct_signup_welcome
    }

    if (!flowId) {
      console.log('No email flow for source:', source);
      return;
    }

    // Check if already enrolled in this flow
    const { data: existing } = await supabase
      .from('user_email_flow_status')
      .select('id')
      .eq('email', email)
      .eq('flow_id', flowId)
      .single();

    if (existing) {
      console.log('User already enrolled in email flow:', flowId);
      return;
    }

    // Get the first message to determine initial delay
    const { data: firstMessage } = await supabase
      .from('email_flow_messages')
      .select('delay_minutes, delay_hours, delay_days')
      .eq('flow_id', flowId)
      .eq('sequence_order', 1)
      .eq('is_active', true)
      .single();

    // Calculate when to send first email
    const nextScheduledAt = new Date();
    if (firstMessage) {
      nextScheduledAt.setDate(nextScheduledAt.getDate() + (firstMessage.delay_days || 0));
      nextScheduledAt.setHours(nextScheduledAt.getHours() + (firstMessage.delay_hours || 0));
      nextScheduledAt.setMinutes(nextScheduledAt.getMinutes() + (firstMessage.delay_minutes || 0));
    }

    // Enroll in flow
    const { error } = await supabase.from('user_email_flow_status').insert({
      email: email,
      user_id: userId,
      flow_id: flowId,
      current_message_order: 0,
      next_email_scheduled_at: nextScheduledAt.toISOString(),
      source_url: utmSource || null,
      source_talent_slug: talentSlug || null,
    });

    if (error && !error.message?.includes('duplicate')) {
      console.error('Error enrolling in email flow:', error);
    } else {
      console.log('Enrolled in email flow:', flowId);
    }
  } catch (err) {
    console.error('Error in enrollInEmailFlow:', err);
  }
}
