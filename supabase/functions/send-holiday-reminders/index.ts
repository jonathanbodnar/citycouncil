import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const USER_SMS_PHONE_NUMBER = Deno.env.get('USER_SMS_PHONE_NUMBER') || Deno.env.get('TWILIO_PHONE_NUMBER');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const REMINDER_MESSAGE = "Only 6 hours left to get 25% off your personalized ShoutOut video! Use code SANTA25 🎄 https://shoutout.us";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🎄 Checking for holiday popup reminder recipients...');

    // Get users who signed up 42 hours ago (6 hours left on their 48hr countdown)
    const { data: recipients, error: fetchError } = await supabase.rpc('get_holiday_popup_reminder_recipients');

    if (fetchError) {
      console.error('Error fetching recipients:', fetchError);
      throw fetchError;
    }

    if (!recipients || recipients.length === 0) {
      console.log('✅ No reminders to send at this time');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No reminders to send',
        sent_count: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📱 Found ${recipients.length} users to send reminders to`);

    let sent_count = 0;
    let failed_count = 0;

    for (const recipient of recipients) {
      try {
        console.log(`Sending reminder to ${recipient.phone_number} (signed up ${recipient.hours_since_signup.toFixed(1)} hours ago)`);

        // Send SMS via Twilio
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: recipient.phone_number,
              From: USER_SMS_PHONE_NUMBER!,
              Body: REMINDER_MESSAGE
            })
          }
        );

        const twilioData = await twilioResponse.json();

        if (twilioResponse.ok) {
          // Mark reminder as sent
          await supabase.rpc('mark_holiday_reminder_sent', { signup_id: recipient.id });
          sent_count++;
          console.log(`✅ Reminder sent to ${recipient.phone_number}`);
        } else {
          failed_count++;
          console.error(`❌ Failed to send to ${recipient.phone_number}:`, twilioData);
        }

        // Rate limit: 1 message per 100ms
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error sending to ${recipient.phone_number}:`, error);
        failed_count++;
      }
    }

    console.log(`🎄 Holiday reminders complete: ${sent_count} sent, ${failed_count} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent_count,
      failed_count,
      total: recipients.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in send-holiday-reminders:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

