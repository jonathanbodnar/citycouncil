require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testNewUrls() {
  console.log('\n🧪 Testing newly migrated Wasabi URLs...\n');

  // Test promo video
  const { data: promo } = await supabase
    .from('talent_profiles')
    .select('promo_video_url, temp_full_name')
    .eq('id', '66b0dd3f-10aa-413a-9c44-fc150b8cf218')
    .single();

  if (promo?.promo_video_url) {
    console.log('📹 Testing Promo Video:');
    console.log('  Talent:', promo.temp_full_name);
    console.log('  URL:', promo.promo_video_url.substring(0, 150) + '...');
    
    try {
      const response = await fetch(promo.promo_video_url, { method: 'HEAD' });
      console.log('  Status:', response.status);
      console.log('  ✅', response.ok ? 'ACCESSIBLE!' : 'NOT ACCESSIBLE');
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log('');
  }

  // Test order video
  const { data: order } = await supabase
    .from('orders')
    .select('video_url, id')
    .eq('id', 'ab0c8d57-e2fd-42b2-b30e-a0d91f6cf777')
    .single();

  if (order?.video_url) {
    console.log('🎬 Testing Order Video:');
    console.log('  Order ID:', order.id);
    console.log('  URL:', order.video_url.substring(0, 150) + '...');
    
    try {
      const response = await fetch(order.video_url, { method: 'HEAD' });
      console.log('  Status:', response.status);
      console.log('  ✅', response.ok ? 'ACCESSIBLE!' : 'NOT ACCESSIBLE');
    } catch (error) {
      console.log('  ❌ Error:', error.message);
    }
    console.log('');
  }
}

testNewUrls();

