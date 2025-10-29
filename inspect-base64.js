require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectBase64() {
  console.log('\n🔍 Inspecting base64 data format...\n');

  // Check promo videos
  const { data: promos } = await supabase
    .from('talent_profiles')
    .select('id, promo_video_url, temp_full_name')
    .like('promo_video_url', 'data:%')
    .limit(1);

  if (promos && promos.length > 0) {
    const url = promos[0].promo_video_url;
    console.log('📹 Promo Video Sample:');
    console.log('  Talent:', promos[0].temp_full_name);
    console.log('  First 100 chars:', url.substring(0, 100));
    console.log('  Has comma:', url.includes(','));
    console.log('  Has semicolon:', url.includes(';'));
    console.log('  Format check:', url.match(/^data:([^;]+);base64,(.+)$/) ? '✅ Valid format' : '❌ Invalid format');
    console.log('');
  }

  // Check order videos
  const { data: orders } = await supabase
    .from('orders')
    .select('id, video_url')
    .like('video_url', 'data:%')
    .limit(1);

  if (orders && orders.length > 0) {
    const url = orders[0].video_url;
    console.log('🎬 Order Video Sample:');
    console.log('  Order ID:', orders[0].id);
    console.log('  First 100 chars:', url.substring(0, 100));
    console.log('  Has comma:', url.includes(','));
    console.log('  Has semicolon:', url.includes(';'));
    console.log('  Format check:', url.match(/^data:([^;]+);base64,(.+)$/) ? '✅ Valid format' : '❌ Invalid format');
    console.log('');
  }
}

inspectBase64();

