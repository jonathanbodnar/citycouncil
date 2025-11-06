// supabase/functions/convert-to-talent/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';

console.log('convert-to-talent Edge Function started');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
      } 
    });
  }

  try {
    const { userId, fullName, phone } = await req.json();
    
    if (!userId) {
      throw new Error('userId is required');
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update user to talent with service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        user_type: 'talent',
        full_name: fullName,
        phone: phone,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update user:', updateError);
      throw updateError;
    }

    console.log(`Successfully converted user ${userId} to talent`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });

  } catch (error) {
    console.error('convert-to-talent function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 400,
    });
  }
});

