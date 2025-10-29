#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWasabiAccess() {
  console.log('🧪 Testing Wasabi URL access...\n');

  // Get a few sample URLs
  const { data: talents } = await supabase
    .from('talent_profiles')
    .select('temp_full_name, temp_avatar_url')
    .not('temp_avatar_url', 'is', null)
    .like('temp_avatar_url', '%wasabisys.com%')
    .limit(3);

  if (!talents || talents.length === 0) {
    console.log('❌ No Wasabi URLs found in database');
    return;
  }

  for (const talent of talents) {
    console.log(`Testing: ${talent.temp_full_name}`);
    console.log(`URL: ${talent.temp_avatar_url}\n`);

    try {
      const response = await fetch(talent.temp_avatar_url, {
        method: 'HEAD'
      });

      console.log(`Status: ${response.status}`);
      console.log(`Headers:`);
      console.log(`  Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin')}`);
      console.log(`  Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.status === 200) {
        console.log('✅ URL is accessible!\n');
      } else {
        console.log(`❌ URL returned ${response.status}\n`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

testWasabiAccess();

