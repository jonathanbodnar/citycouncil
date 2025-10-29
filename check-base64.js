#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBase64Data() {
  console.log('🔍 Checking for base64 data in database...\n');

  // Check talent promo videos
  const { data: promoVideos } = await supabase
    .from('talent_profiles')
    .select('id, temp_full_name, promo_video_url')
    .like('promo_video_url', 'data:%');

  // Check talent avatars
  const { data: talentAvatars } = await supabase
    .from('talent_profiles')
    .select('id, temp_full_name, temp_avatar_url')
    .like('temp_avatar_url', 'data:%');

  // Check user avatars
  const { data: userAvatars } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .like('avatar_url', 'data:%');

  // Check order videos
  const { data: orderVideos } = await supabase
    .from('orders')
    .select('id, video_url')
    .like('video_url', 'data:%');

  console.log('📊 Results:');
  console.log(`   Promo videos with base64:  ${promoVideos?.length || 0}`);
  console.log(`   Talent avatars with base64: ${talentAvatars?.length || 0}`);
  console.log(`   User avatars with base64:   ${userAvatars?.length || 0}`);
  console.log(`   Order videos with base64:   ${orderVideos?.length || 0}`);
  console.log();

  const total = (promoVideos?.length || 0) + 
                (talentAvatars?.length || 0) + 
                (userAvatars?.length || 0) + 
                (orderVideos?.length || 0);

  if (total === 0) {
    console.log('✅ No base64 data found - your database is clean!');
    console.log('📝 This means either:');
    console.log('   1. You already ran the SQL cleanup queries');
    console.log('   2. All images were uploaded directly to Wasabi');
    console.log('   3. There are no images/videos uploaded yet\n');
  } else {
    console.log(`⚠️  Found ${total} items with base64 data that need migration\n`);
  }
}

checkBase64Data();

