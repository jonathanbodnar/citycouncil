import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Check ALL beta_signups entries (not just last 24h)
  const { data: allSignups } = await supabase
    .from('beta_signups')
    .select('phone_number, email, source, prize_won, created_at, subscribed_at')
    .not('phone_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15);
  
  console.log(`All giveaway entries with phone: ${allSignups?.length || 0}\n`);
  allSignups?.forEach(s => {
    console.log(`${s.created_at || s.subscribed_at}:`);
    console.log(`  Phone: ${s.phone_number}`);
    console.log(`  Email: ${s.email}`);
    console.log(`  Source: ${s.source}`);
    console.log(`  Prize: ${s.prize_won}`);
    console.log();
  });
}

main();

