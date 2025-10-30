import { supabase } from './supabase';

export interface AddContactResponse {
  success: boolean;
  error?: string;
}

export const addToActiveCampaign = async (
  email: string
): Promise<AddContactResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('activecampaign-add', {
      body: { email }
    });

    if (error) {
      console.error('ActiveCampaign Edge Function error:', error);
      return { success: false, error: error.message };
    }

    return data as AddContactResponse;
  } catch (error: any) {
    console.error('Error calling ActiveCampaign:', error);
    return { success: false, error: error.message };
  }
};

