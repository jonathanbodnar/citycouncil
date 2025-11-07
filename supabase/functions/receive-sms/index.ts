// Twilio Webhook to Receive SMS Replies from Talent
// This function receives incoming SMS messages and stores them in the database

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
    const body = formData.get('Body') as string; // Message content
    const messageSid = formData.get('MessageSid') as string; // Twilio message ID

    console.log('📩 Incoming SMS:', { from, body, messageSid });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Clean phone number (remove all non-digits)
    let cleanPhone = from.replace(/\D/g, '');
    
    // If phone starts with 1 and is 11 digits, strip the leading 1
    // Twilio sends +16145551234, we need to try multiple formats
    if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    console.log('Phone lookup:', { from, cleanPhone });
    
    // Try multiple phone formats to find the user
    // Format 1: 10 digits (4692079703)
    // Format 2: 11 digits with 1 (14692079703)
    // Format 3: With + prefix (+14692079703)
    // Format 4: With +1 prefix (+14692079703)
    
    const phoneVariations = [
      cleanPhone,                    // 4692079703
      `1${cleanPhone}`,              // 14692079703
      `+${cleanPhone}`,              // +4692079703
      `+1${cleanPhone}`,             // +14692079703
      from                           // Original format from Twilio
    ];
    
    console.log('Trying phone variations:', phoneVariations);
    
    // Find the talent by phone number (try all variations)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name, phone')
      .in('phone', phoneVariations);
    
    const user = users && users.length > 0 ? users[0] : null;
    
    console.log('User lookup result:', { user, error: userError });

    if (userError || !user) {
      console.error('❌ User not found for phone:', from);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/xml' 
          }
        }
      );
    }

    // Find talent profile
    const { data: talent, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (talentError || !talent) {
      console.error('❌ Talent profile not found for user:', user.id);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/xml' 
          }
        }
      );
    }

    // Save the incoming message to database
    const { error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        talent_id: talent.id,
        from_admin: false, // This is from talent
        message: body,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error saving message:', insertError);
      throw insertError;
    }

    console.log('✅ Message saved to database');

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

