import { supabase } from './supabase';

export interface FortisIntentionResponse {
  clientToken: string;
  environment: string;
  locationId: string;
  amount: number; // cents
  orderReference: string;
}

export async function createFortisIntention(amountCents: number): Promise<FortisIntentionResponse> {
  const { data, error } = await supabase.functions.invoke('fortis-intention', {
    body: { amount_cents: amountCents },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create Fortis intention');
  }
  return data as FortisIntentionResponse;
}

export async function verifyFortisTransaction(transactionId: string): Promise<{ statusCode: number; transaction: any }> {
  const { data, error } = await supabase.functions.invoke('fortis-verify', {
    body: { transaction_id: transactionId },
  });
  if (error) {
    throw new Error(error.message || 'Failed to verify Fortis transaction');
  }
  return { statusCode: data?.statusCode, transaction: data?.transaction };
}


