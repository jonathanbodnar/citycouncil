#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWasabiURLs() {
  console.log('🔍 Checking for Wasabi URLs in database...\n');

  // Check talent avatars
  const { data: talents } = await supabase
    .from('talent_profiles')
    .select('id, temp_full_name, temp_avatar_url')
    .not('temp_avatar_url', 'is', null)
    .limit(10);

  console.log('📸 Sample Talent Avatars:');
  talents?.forEach(t => {
    const isWasabi = t.temp_avatar_url?.includes('wasabisys.com');
    const isBase64 = t.temp_avatar_url?.startsWith('data:');
    console.log(`   ${t.temp_full_name}: ${isWasabi ? '✅ Wasabi' : isBase64 ? '❌ Base64' : '❓ Other'}`);
    if (!isWasabi && !isBase64) {
      console.log(`      URL: ${t.temp_avatar_url?.substring(0, 60)}...`);
    }
  });

  // Check promo videos
  const { data: promoVideos } = await supabase
    .from('talent_profiles')
    .select('id, temp_full_name, promo_video_url')
    .not('promo_video_url', 'is', null)
    .limit(5);

  console.log('\n🎥 Sample Promo Videos:');
  promoVideos?.forEach(t => {
    const isWasabi = t.promo_video_url?.includes('wasabisys.com');
    const isBase64 = t.promo_video_url?.startsWith('data:');
    console.log(`   ${t.temp_full_name}: ${isWasabi ? '✅ Wasabi' : isBase64 ? '❌ Base64' : '❓ Other'}`);
  });

  console.log('\n');
}

checkWasabiURLs();

