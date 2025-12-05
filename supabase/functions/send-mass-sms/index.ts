import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
// Use separate phone numbers for different audiences
// TWILIO_PHONE_NUMBER = Talent dedicated number (for talent SMS)
// USER_SMS_PHONE_NUMBER = User campaigns number (for users/beta/holiday)
const TALENT_SMS_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
const USER_SMS_PHONE_NUMBER = Deno.env.get('USER_SMS_PHONE_NUMBER') || Deno.env.get('TWILIO_PHONE_NUMBER');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMassSMSRequest {
  campaign_name: string;
  message: string;
  target_audience: 'beta' | 'registered' | 'all' | 'talent' | 'holiday_popup';
  excluded_user_ids?: string[];
}

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
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!userData || userData.user_type !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const { campaign_name, message, target_audience, excluded_user_ids = [] }: SendMassSMSRequest = await req.json();

    // Validate message length
    if (message.length > 160) {
      return new Response(JSON.stringify({ error: 'Message must be 160 characters or less' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get recipients
    const { data: allRecipients, error: recipientsError } = await supabase.rpc('get_users_by_segment', {
      segment: target_audience
    });

    if (recipientsError || !allRecipients || allRecipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found', details: recipientsError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter out excluded users
    const excludedSet = new Set(excluded_user_ids);
    const recipients = allRecipients.filter((r: any) => !excludedSet.has(r.id));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'All recipients were excluded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Sending to ${recipients.length} recipients (${excluded_user_ids.length} excluded)`)

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from('sms_campaigns')
      .insert({
        created_by: user.id,
        campaign_name,
        message,
        target_audience,
        recipient_count: recipients.length,
        status: 'sending'
      })
      .select()
      .single();

    if (campaignError) {
      throw campaignError;
    }

    // Send SMS to each recipient (with rate limiting)
    let sent_count = 0;
    let failed_count = 0;

    // Use talent dedicated number for talent, user number for everyone else
    const fromNumber = target_audience === 'talent' ? TALENT_SMS_PHONE_NUMBER! : USER_SMS_PHONE_NUMBER!;
    console.log(`Using phone number for ${target_audience}: ${fromNumber}`);

    for (const recipient of recipients) {
      try {
        // Send via Twilio
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
              From: fromNumber,
              Body: message
            })
          }
        );

        const twilioData = await twilioResponse.json();

        // Log SMS
        await supabase.from('sms_logs').insert({
          campaign_id: campaign.id,
          recipient_id: recipient.id,
          phone_number: recipient.phone_number,
          message,
          status: twilioResponse.ok ? 'sent' : 'failed',
          error_message: twilioResponse.ok ? null : (twilioData.message || 'Unknown error'),
          sent_at: new Date().toISOString(),
          twilio_sid: twilioData.sid || null
        });

        if (twilioResponse.ok) {
          sent_count++;
        } else {
          failed_count++;
          console.error(`Failed to send SMS to ${recipient.phone_number}:`, twilioData);
        }

        // Rate limit: 1 message per 100ms (10/second)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to send SMS to ${recipient.phone_number}:`, error);
        failed_count++;

        // Log failed SMS
        await supabase.from('sms_logs').insert({
          campaign_id: campaign.id,
          recipient_id: recipient.id,
          phone_number: recipient.phone_number,
          message,
          status: 'failed',
          error_message: error.message || 'Unknown error'
        });
      }
    }

    // Update campaign status
    await supabase
      .from('sms_campaigns')
      .update({
        sent_count,
        failed_count,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaign.id,
      sent_count,
      failed_count,
      total: recipients.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in send-mass-sms:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
