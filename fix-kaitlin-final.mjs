import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const email = 'libertyhangout@libertyhangout.info';
  const phone = '+17402522290';
  
  console.log('Finding existing auth user...\n');
  
  // Get ALL auth users and search manually (since direct query wasn't finding it)
  const { data: allUsers, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  
  // Find by email (case insensitive)
  const authUser = allUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (authUser) {
    console.log('✅ Found existing auth user:');
    console.log(`  ID: ${authUser.id}`);
    console.log(`  Email: ${authUser.email}`);
    console.log(`  Phone: ${authUser.phone || 'NOT SET'}`);
    console.log(`  Created: ${authUser.created_at}`);
    
    // Update to add phone if missing
    if (!authUser.phone || authUser.phone !== phone) {
      console.log('\n📞 Adding/updating phone number...');
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        authUser.id,
        { phone: phone, phone_confirm: true }
      );
      
      if (updateError) {
        console.error('Error updating phone:', updateError);
      } else {
        console.log('✅ Phone number added/updated');
      }
    }
    
    console.log('\n✅ Kaitlin can now log in!');
    console.log('She should request a new OTP code and try again.');
  } else {
    console.log('❌ No auth user found with email:', email);
    console.log('\nSearching for similar emails...');
    const similar = allUsers.users.filter(u => u.email?.toLowerCase().includes('liberty'));
    console.log(`Found ${similar.length} users with "liberty" in email:`);
    similar.forEach(u => console.log(`  ${u.id} - ${u.email}`));
  }
}

main();
