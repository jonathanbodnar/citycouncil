import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    console.log('Starting Instagram tracking...');

    // Get all talent with Instagram connected and in promotion program
    const { data: talents, error: talentError } = await supabase
      .from('talent_profiles')
      .select('id, instagram_username, instagram_user_id, instagram_access_token, temp_full_name, users!talent_profiles_user_id_fkey(full_name)')
      .eq('is_participating_in_promotion', true)
      .not('instagram_access_token', 'is', null);

    if (talentError) {
      console.error('Error fetching talents:', talentError);
      throw talentError;
    }

    console.log(`Found ${talents?.length || 0} talent with Instagram connected`);

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const talent of talents || []) {
      try {
        const talentName = Array.isArray(talent.users) 
          ? talent.users[0]?.full_name 
          : talent.users?.full_name || talent.temp_full_name || 'Unknown';
        
        console.log(`\n=== Processing: ${talentName} (@${talent.instagram_username}) ===`);

        // Get user profile (bio and website)
        const profileResponse = await fetch(
          `https://graph.instagram.com/${talent.instagram_user_id}?fields=username,biography,website&access_token=${talent.instagram_access_token}`
        );
        
        if (!profileResponse.ok) {
          const errorText = await profileResponse.text();
          console.error(`Failed to fetch profile for @${talent.instagram_username}:`, errorText);
          errors.push({ talent: talent.instagram_username, error: 'Profile fetch failed', details: errorText });
          errorCount++;
          continue;
        }

        const profileData = await profileResponse.json();
        
        // Check if bio or website contains shoutout.us
        const bioText = profileData.biography || '';
        const websiteUrl = profileData.website || '';
        const hasLink = 
          bioText.toLowerCase().includes('shoutout.us') ||
          websiteUrl.toLowerCase().includes('shoutout.us');

        console.log(`Bio check: ${hasLink ? '✓ FOUND' : '✗ NOT FOUND'}`);
        console.log(`  Bio: "${bioText.substring(0, 100)}${bioText.length > 100 ? '...' : ''}"`);
        console.log(`  Website: "${websiteUrl}"`);

        // Upsert bio tracking
        const { error: bioError } = await supabase
          .from('social_media_bio_tracking')
          .upsert({
            talent_id: talent.id,
            platform: 'instagram',
            has_shoutout_link: hasLink,
            link_found: websiteUrl || bioText.substring(0, 500) || null,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'talent_id,platform'
          });

        if (bioError) {
          console.error('Bio tracking update failed:', bioError);
        }

        // Get recent media (posts)
        const mediaResponse = await fetch(
          `https://graph.instagram.com/${talent.instagram_user_id}/media?fields=id,caption,timestamp,permalink,media_type&limit=25&access_token=${talent.instagram_access_token}`
        );

        if (!mediaResponse.ok) {
          const errorText = await mediaResponse.text();
          console.error(`Failed to fetch media for @${talent.instagram_username}:`, errorText);
          errors.push({ talent: talent.instagram_username, error: 'Media fetch failed', details: errorText });
          errorCount++;
          continue;
        }

        const mediaData = await mediaResponse.json();
        
        let postsFound = 0;
        const posts = mediaData.data || [];
        console.log(`Checking ${posts.length} recent posts...`);

        // Check each post for mentions/tags
        for (const post of posts) {
          const caption = (post.caption || '').toLowerCase();
          const hasTag = 
            caption.includes('@shoutoutvoice') ||
            caption.includes('#shoutout') ||
            caption.includes('#shoutoutvoice') ||
            caption.includes('shoutout.us');

          if (hasTag) {
            console.log(`  ✓ Found tagged post: ${post.id}`);
            
            // Insert tag record (ignore if already exists)
            const { error: insertError } = await supabase
              .from('social_media_tags')
              .upsert({
                talent_id: talent.id,
                platform: 'instagram',
                post_id: post.id,
                post_url: post.permalink,
                post_date: post.timestamp,
                caption: post.caption?.substring(0, 500) || null,
                created_at: new Date().toISOString()
              }, {
                onConflict: 'platform,post_id',
                ignoreDuplicates: true
              });

            if (!insertError) {
              postsFound++;
            } else {
              console.error('Failed to insert post:', insertError);
            }
          }
        }

        console.log(`Summary: ${postsFound} tagged posts found`);
        successCount++;

      } catch (error) {
        console.error(`Error processing talent ${talent.instagram_username}:`, error);
        errors.push({ talent: talent.instagram_username, error: error.message });
        errorCount++;
      }
    }

    console.log('\n=== Tracking Complete ===');
    console.log(`Successful: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    if (errors.length > 0) {
      console.log('Errors:', JSON.stringify(errors, null, 2));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: successCount,
        errors: errorCount,
        total: talents?.length || 0,
        errorDetails: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Instagram tracking error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

