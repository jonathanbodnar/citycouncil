// Twilio Webhook to Receive SMS Replies from Talent AND Users
// This function receives incoming SMS messages and stores them in the database
// If sender doesn't have a talent profile, one is created so they appear in Comms Center

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📞 Webhook received from:', req.headers.get('user-agent'));
    console.log('📋 Content-Type:', req.headers.get('content-type'));
    
    // Parse Twilio's form data
    const contentType = req.headers.get('content-type') || '';
    let formData: FormData;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      formData = await req.formData();
    } else {
      // Fallback: try to parse as text and convert to FormData
      const text = await req.text();
      console.log('📝 Raw body:', text);
      formData = new FormData();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        formData.append(key, value);
      });
    }
    
    const from = formData.get('From') as string; // Phone number that sent the message
    let body = formData.get('Body') as string; // Message content
    const messageSid = formData.get('MessageSid') as string; // Twilio message ID

    // Decode URL-encoded characters (including emojis)
    // Twilio may send emojis as URL-encoded UTF-8
    if (body) {
      try {
        body = decodeURIComponent(body);
      } catch (e) {
        // If decoding fails, use original
        console.warn('⚠️ Could not decode message body:', e);
      }
    }

    console.log('📩 Incoming SMS:', { from, body, messageSid });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for STOP/unsubscribe keywords
    const stopKeywords = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];
    const messageNormalized = (body || '').toLowerCase().trim();
    
    if (stopKeywords.includes(messageNormalized)) {
      console.log('🛑 STOP request received from:', from);
      
      // Clean phone number for lookup
      let cleanPhoneForStop = from.replace(/\D/g, '');
      if (cleanPhoneForStop.length === 11 && cleanPhoneForStop.startsWith('1')) {
        cleanPhoneForStop = cleanPhoneForStop.substring(1);
      }
      
      // Try multiple phone formats
      const phoneFormats = [
        cleanPhoneForStop,
        `+1${cleanPhoneForStop}`,
        `1${cleanPhoneForStop}`,
        from
      ];
      
      // 1. Delete from beta_signups (giveaway entries)
      const { error: deleteError } = await supabase
        .from('beta_signups')
        .delete()
        .in('phone_number', phoneFormats);
      
      if (deleteError) {
        console.error('❌ Error deleting from beta_signups:', deleteError);
      } else {
        console.log('✅ Removed from beta_signups (giveaway)');
      }
      
      // 2. Mark user as opted out in users table (add sms_opted_out flag)
      const { error: userOptOutError } = await supabase
        .from('users')
        .update({ sms_opted_out: true, sms_opted_out_at: new Date().toISOString() })
        .in('phone', phoneFormats);
      
      if (userOptOutError) {
        console.error('❌ Error marking user as opted out:', userOptOutError);
      } else {
        console.log('✅ Marked user as SMS opted out');
      }
      
      // 3. Log the opt-out for audit trail
      await supabase
        .from('sms_logs')
        .insert({
          phone_number: from,
          message: body,
          status: 'opt_out',
          sent_at: new Date().toISOString()
        })
        .then(() => console.log('✅ Logged opt-out request'))
        .catch(err => console.error('❌ Error logging opt-out:', err));
      
      // Return empty response - Twilio will handle the STOP automatically
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      );
    }

    // Clean phone number (remove all non-digits)
    let cleanPhone = from.replace(/\D/g, '');
    
    // If phone starts with 1 and is 11 digits, strip the leading 1
    // Twilio sends +16145551234, we need to try multiple formats
    if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    console.log('Phone lookup:', { from, cleanPhone });
    
    // Try multiple phone formats to find the user
    const phoneVariations = [
      cleanPhone,                    // 4692079703
      `1${cleanPhone}`,              // 14692079703
      `+${cleanPhone}`,              // +4692079703
      `+1${cleanPhone}`,             // +14692079703
      from                           // Original format from Twilio
    ];
    
    console.log('Trying phone variations:', phoneVariations);
    
    // Find the user by phone number (try all variations)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name, phone, user_type')
      .in('phone', phoneVariations);
    
    let user = users && users.length > 0 ? users[0] : null;
    
    console.log('User lookup result:', { user, error: userError });

    // If no user found, create a placeholder user for this phone number
    if (!user) {
      console.log('📝 Creating placeholder user for phone:', cleanPhone);
      
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          full_name: `SMS User (${cleanPhone})`,
          phone: cleanPhone,
          user_type: 'user',
          email: `sms_${cleanPhone}@placeholder.shoutout.us`
        })
        .select()
        .single();
      
      if (createUserError) {
        console.error('❌ Error creating placeholder user:', createUserError);
        // Still try to save the message somehow - maybe log it
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
        );
      }
      
      user = newUser;
      console.log('✅ Created placeholder user:', user);
    }

    // Find or create talent profile for this user
    let { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // If no talent profile exists, create a placeholder one so they appear in Comms Center
    if (talentError || !talent) {
      console.log('📝 Creating placeholder talent profile for user:', user.id);
      
      const { data: newTalent, error: createTalentError } = await supabase
        .from('talent_profiles')
        .insert({
          user_id: user.id,
          username: `sms_user_${cleanPhone}`,
          bio: 'SMS conversation - not a real talent profile',
          pricing: 1,  // Minimum allowed by check constraint
          is_active: false,  // Not visible on site
          is_coming_soon: false,
          temp_full_name: user.full_name,
          category: 'other',
          fulfillment_time_hours: 168  // 7 days default
        })
        .select('id')
        .single();
      
      if (createTalentError) {
        console.error('❌ Error creating placeholder talent profile:', createTalentError);
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
        );
      }
      
      talent = newTalent;
      console.log('✅ Created placeholder talent profile:', talent);
    }

    // Save the incoming message to database
    const { error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        talent_id: talent.id,
        from_admin: false, // This is from the person (talent or user)
        message: body,
        status: 'sent',
        sent_at: new Date().toISOString(),
        read_by_admin: false
      });

    if (insertError) {
      console.error('❌ Error saving message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved to database for talent_id:', talent.id);

    // Respond to Twilio with empty TwiML (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        }
      }
    );

  } catch (error: any) {
    console.error('❌ Error processing incoming SMS:', error);
    
    // Still return valid TwiML even on error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200, // Always return 200 to Twilio
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        }
      }
    );
  }
});

