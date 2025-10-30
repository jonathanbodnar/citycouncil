import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    const apiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const accountUrl = Deno.env.get('ACTIVECAMPAIGN_URL');

    if (!apiKey || !accountUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'ActiveCampaign not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update contact
    const contactData = {
      contact: {
        email: email.toLowerCase().trim(),
      }
    };

    const contactResponse = await fetch(`${accountUrl}/api/3/contact/sync`, {
      method: 'POST',
      headers: {
        'Api-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    if (!contactResponse.ok) {
      const errorText = await contactResponse.text();
      console.error('ActiveCampaign contact creation failed:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to add contact' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contactResult = await contactResponse.json();
    const contactId = contactResult.contact.id;

    // Get lists
    const listsResponse = await fetch(`${accountUrl}/api/3/lists`, {
      method: 'GET',
      headers: {
        'Api-Token': apiKey,
      },
    });

    if (!listsResponse.ok) {
      console.error('Failed to fetch lists');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch lists' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listsData = await listsResponse.json();
    const betaList = listsData.lists?.find((list: any) => list.name.toLowerCase() === 'beta');
    const masterList = listsData.lists?.find((list: any) => list.name.toLowerCase() === 'master list');

    // Add to both lists
    const promises = [];
    
    if (betaList) {
      promises.push(
        fetch(`${accountUrl}/api/3/contactLists`, {
          method: 'POST',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contactList: {
              list: betaList.id,
              contact: contactId,
              status: 1,
            },
          }),
        })
      );
    }

    if (masterList) {
      promises.push(
        fetch(`${accountUrl}/api/3/contactLists`, {
          method: 'POST',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contactList: {
              list: masterList.id,
              contact: contactId,
              status: 1,
            },
          }),
        })
      );
    }

    await Promise.all(promises);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

