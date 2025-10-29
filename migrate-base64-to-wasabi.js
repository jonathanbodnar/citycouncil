#!/usr/bin/env node

/**
 * Migration Script: Base64 to Wasabi S3
 * 
 * This script migrates all base64-encoded images and videos in the database
 * to Wasabi S3 storage and updates the database with the new URLs.
 * 
 * Usage:
 *   node migrate-base64-to-wasabi.js
 * 
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - WASABI_ACCESS_KEY_ID
 *   - WASABI_SECRET_ACCESS_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const AWS = require('aws-sdk');

// Configuration
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const wasabi = new AWS.S3({
  endpoint: 's3.us-central-1.wasabisys.com',
  accessKeyId: process.env.WASABI_ACCESS_KEY_ID || process.env.REACT_APP_WASABI_ACCESS_KEY_ID,
  secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY || process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY,
  region: 'us-central-1',
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

// Statistics
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0
};

/**
 * Upload base64 data to Wasabi
 */
async function uploadToWasabi(base64Data, fileName, bucket) {
  try {
    // Extract base64 content and mime type
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 data format');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    console.log(`  📦 Uploading ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB) to ${bucket}...`);

    const uploadResult = await wasabi.upload({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: mimeType,
    }).promise();

    // Generate pre-signed URL (7 days expiry)
    const signedUrl = wasabi.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: fileName,
      Expires: 604800 // 7 days
    });

    return signedUrl;
  } catch (error) {
    console.error(`  ❌ Upload failed:`, error.message);
    throw error;
  }
}

/**
 * Migrate talent profile promo videos
 */
async function migrateTalentPromoVideos() {
  console.log('\n📹 Migrating talent promo videos...\n');

  const { data: profiles, error } = await supabase
    .from('talent_profiles')
    .select('id, promo_video_url, temp_full_name')
    .like('promo_video_url', 'data:%');

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('✅ No promo videos to migrate\n');
    return;
  }

  console.log(`Found ${profiles.length} promo videos to migrate\n`);

  for (const profile of profiles) {
    stats.total++;
    console.log(`Processing: ${profile.temp_full_name || profile.id}`);

    try {
      const extension = profile.promo_video_url.includes('video/mp4') ? 'mp4' : 
                       profile.promo_video_url.includes('video/webm') ? 'webm' : 'mp4';
      const fileName = `videos/promo-${profile.id}-${Date.now()}.${extension}`;
      
      const wasabiUrl = await uploadToWasabi(
        profile.promo_video_url,
        fileName,
        'shoutoutorders'
      );

      // Update database
      const { error: updateError } = await supabase
        .from('talent_profiles')
        .update({ promo_video_url: wasabiUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      console.log(`  ✅ Migrated successfully: ${wasabiUrl}\n`);
      stats.success++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate: ${error.message}\n`);
      stats.failed++;
    }
  }
}

/**
 * Migrate talent profile avatars
 */
async function migrateTalentAvatars() {
  console.log('\n🖼️  Migrating talent avatars...\n');

  const { data: profiles, error } = await supabase
    .from('talent_profiles')
    .select('id, temp_avatar_url, temp_full_name')
    .like('temp_avatar_url', 'data:%');

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('✅ No avatars to migrate\n');
    return;
  }

  console.log(`Found ${profiles.length} avatars to migrate\n`);

  for (const profile of profiles) {
    stats.total++;
    console.log(`Processing: ${profile.temp_full_name || profile.id}`);

    try {
      const extension = profile.temp_avatar_url.includes('image/png') ? 'png' :
                       profile.temp_avatar_url.includes('image/jpeg') ? 'jpg' :
                       profile.temp_avatar_url.includes('image/jpg') ? 'jpg' :
                       profile.temp_avatar_url.includes('image/webp') ? 'webp' : 'jpg';
      const fileName = `avatars/temp-${profile.id}-${Date.now()}.${extension}`;
      
      const wasabiUrl = await uploadToWasabi(
        profile.temp_avatar_url,
        fileName,
        'shoutout-assets'
      );

      // Update database
      const { error: updateError } = await supabase
        .from('talent_profiles')
        .update({ temp_avatar_url: wasabiUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      console.log(`  ✅ Migrated successfully: ${wasabiUrl}\n`);
      stats.success++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate: ${error.message}\n`);
      stats.failed++;
    }
  }
}

/**
 * Migrate user avatars
 */
async function migrateUserAvatars() {
  console.log('\n👤 Migrating user avatars...\n');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, avatar_url, full_name')
    .like('avatar_url', 'data:%');

  if (error) {
    console.error('❌ Error fetching users:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('✅ No user avatars to migrate\n');
    return;
  }

  console.log(`Found ${users.length} user avatars to migrate\n`);

  for (const user of users) {
    stats.total++;
    console.log(`Processing: ${user.full_name || user.id}`);

    try {
      const extension = user.avatar_url.includes('image/png') ? 'png' :
                       user.avatar_url.includes('image/jpeg') ? 'jpg' :
                       user.avatar_url.includes('image/jpg') ? 'jpg' :
                       user.avatar_url.includes('image/webp') ? 'webp' : 'jpg';
      const fileName = `avatars/user-${user.id}-${Date.now()}.${extension}`;
      
      const wasabiUrl = await uploadToWasabi(
        user.avatar_url,
        fileName,
        'shoutout-assets'
      );

      // Update database
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: wasabiUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      console.log(`  ✅ Migrated successfully: ${wasabiUrl}\n`);
      stats.success++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate: ${error.message}\n`);
      stats.failed++;
    }
  }
}

/**
 * Migrate order videos
 */
async function migrateOrderVideos() {
  console.log('\n🎬 Migrating order videos...\n');

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, video_url')
    .like('video_url', 'data:%');

  if (error) {
    console.error('❌ Error fetching orders:', error);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('✅ No order videos to migrate\n');
    return;
  }

  console.log(`Found ${orders.length} order videos to migrate\n`);

  for (const order of orders) {
    stats.total++;
    console.log(`Processing order: ${order.id}`);

    try {
      const extension = order.video_url.includes('video/mp4') ? 'mp4' : 
                       order.video_url.includes('video/webm') ? 'webm' : 'mp4';
      const fileName = `videos/${order.id}-${Date.now()}.${extension}`;
      
      const wasabiUrl = await uploadToWasabi(
        order.video_url,
        fileName,
        'shoutoutorders'
      );

      // Update database
      const { error: updateError } = await supabase
        .from('orders')
        .update({ video_url: wasabiUrl })
        .eq('id', order.id);

      if (updateError) throw updateError;

      console.log(`  ✅ Migrated successfully: ${wasabiUrl}\n`);
      stats.success++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate: ${error.message}\n`);
      stats.failed++;
    }
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  Base64 to Wasabi Migration Script                ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // Check environment variables
  if (!process.env.SUPABASE_URL && !process.env.REACT_APP_SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not set');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }
  if (!process.env.WASABI_ACCESS_KEY_ID && !process.env.REACT_APP_WASABI_ACCESS_KEY_ID) {
    console.error('❌ WASABI_ACCESS_KEY_ID not set');
    process.exit(1);
  }
  if (!process.env.WASABI_SECRET_ACCESS_KEY && !process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY) {
    console.error('❌ WASABI_SECRET_ACCESS_KEY not set');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');
  console.log('Starting migration...\n');

  const startTime = Date.now();

  try {
    // Run migrations
    await migrateTalentPromoVideos();
    await migrateTalentAvatars();
    await migrateUserAvatars();
    await migrateOrderVideos();

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  Migration Complete                                ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(`📊 Summary:`);
    console.log(`   Total items:     ${stats.total}`);
    console.log(`   ✅ Successful:   ${stats.success}`);
    console.log(`   ❌ Failed:       ${stats.failed}`);
    console.log(`   ⏱️  Duration:     ${duration}s\n`);

    if (stats.failed > 0) {
      console.log('⚠️  Some items failed to migrate. Check the logs above for details.\n');
      process.exit(1);
    } else {
      console.log('🎉 All items migrated successfully!\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();

