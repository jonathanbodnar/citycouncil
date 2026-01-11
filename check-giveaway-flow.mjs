import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== Checking Giveaway Welcome Flow ===\n');
  
  // 1. Check recent beta_signups entries
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: recentSignups } = await supabase
    .from('beta_signups')
    .select('phone_number, email, prize_won, created_at')
    .gte('created_at', yesterday.toISOString())
    .not('phone_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`Recent giveaway entries (last 24h): ${recentSignups?.length || 0}`);
  recentSignups?.forEach(s => {
    console.log(`  - ${s.phone_number} won ${s.prize_won} at ${s.created_at}`);
  });
  
  // 2. Check who's in the welcome flow
  const welcomeFlowId = '11111111-1111-1111-1111-111111111111';
  const { data: flowStatus } = await supabase
    .from('user_sms_flow_status')
    .select('*')
    .eq('flow_id', welcomeFlowId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`\nUsers in giveaway_welcome flow: ${flowStatus?.length || 0}`);
  flowStatus?.forEach(s => {
    console.log(`  - ${s.phone}: msg ${s.current_message_order}, next: ${s.next_message_scheduled_at}, paused: ${s.is_paused}, completed: ${s.flow_completed_at ? 'yes' : 'no'}`);
  });
  
  // 3. Check the SMS send log for this flow
  const { data: sendLog } = await supabase
    .from('sms_send_log')
    .select('phone, status, sent_at, error_message')
    .eq('flow_id', welcomeFlowId)
    .order('sent_at', { ascending: false })
    .limit(10);
  
  console.log(`\nRecent sends from giveaway_welcome flow: ${sendLog?.length || 0}`);
  sendLog?.forEach(log => {
    console.log(`  - ${log.phone}: ${log.status} at ${log.sent_at}${log.error_message ? ` - ${log.error_message}` : ''}`);
  });
  
  // 4. Check the flow message
  const { data: flowMessage } = await supabase
    .from('sms_flow_messages')
    .select('*')
    .eq('flow_id', welcomeFlowId)
    .order('sequence_order');
  
  console.log(`\nMessages in giveaway_welcome flow: ${flowMessage?.length || 0}`);
  flowMessage?.forEach(msg => {
    console.log(`  - #${msg.sequence_order}: "${msg.message_text.substring(0, 50)}..." (active: ${msg.is_active})`);
  });
}

main();

