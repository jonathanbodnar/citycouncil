export interface AddContactResponse {
  success: boolean;
  error?: string;
}

export const addToActiveCampaign = async (
  email: string,
  firstName?: string,
  lastName?: string
): Promise<AddContactResponse> => {
  try {
    const apiKey = process.env.REACT_APP_ACTIVECAMPAIGN_API_KEY;
    const accountUrl = process.env.REACT_APP_ACTIVECAMPAIGN_URL;

    if (!apiKey || !accountUrl) {
      console.error('ActiveCampaign credentials not configured');
      return { success: false, error: 'Configuration error' };
    }

    // First, create or update the contact
    const contactData = {
      contact: {
        email: email.toLowerCase().trim(),
        firstName: firstName || '',
        lastName: lastName || ''
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
      return { success: false, error: 'Failed to add contact' };
    }

    const contactResult = await contactResponse.json();
    const contactId = contactResult.contact.id;

    // Get list IDs - we need to find "beta" and "Master List"
    const listsResponse = await fetch(`${accountUrl}/api/3/lists`, {
      method: 'GET',
      headers: {
        'Api-Token': apiKey,
      },
    });

    if (!listsResponse.ok) {
      console.error('Failed to fetch lists');
      return { success: false, error: 'Failed to fetch lists' };
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
              status: 1, // 1 = subscribed
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

    return { success: true };
  } catch (error: any) {
    console.error('Error adding to ActiveCampaign:', error);
    return { success: false, error: error.message };
  }
};

