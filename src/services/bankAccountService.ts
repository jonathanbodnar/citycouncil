// Bank Account Service
// Handles secure retrieval and decryption of bank account information for Fortis API calls

import { supabase } from './supabase';
import { bankEncryption } from './encryption';

interface BankAccountInfo {
  id: string;
  talent_id: string;
  account_holder_name: string;
  bank_name: string;
  account_type: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface EncryptedBankInfo extends BankAccountInfo {
  account_number_encrypted: string;
  account_number_iv: string;
  account_number_masked: string;
  routing_number_encrypted: string;
  routing_number_iv: string;
  routing_number_masked: string;
}

interface DecryptedBankInfo extends BankAccountInfo {
  account_number: string;
  routing_number: string;
}

export class BankAccountService {
  
  // Get encrypted bank account info for display (masked numbers)
  public async getBankAccountForDisplay(talentId: string): Promise<{
    id: string;
    talent_id: string;
    account_holder_name: string;
    bank_name: string;
    account_type: 'checking' | 'savings';
    is_verified: boolean;
    created_at: string;
    updated_at: string;
    account_number_masked: string;
    routing_number_masked: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('vendor_bank_info')
        .select(`
          id,
          talent_id,
          account_holder_name,
          bank_name,
          account_type,
          account_number_masked,
          routing_number_masked,
          is_verified,
          created_at,
          updated_at
        `)
        .eq('talent_id', talentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No bank account found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching bank account for display:', error);
      throw error;
    }
  }

  // Get decrypted bank account info for Fortis API calls (admin only)
  public async getBankAccountForPayouts(talentId: string): Promise<DecryptedBankInfo | null> {
    try {
      console.log('Retrieving encrypted bank account for talent:', talentId);
      
      const { data, error } = await supabase
        .from('vendor_bank_info')
        .select('*')
        .eq('talent_id', talentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No bank account found
          return null;
        }
        throw error;
      }

      const encryptedData = data as EncryptedBankInfo;

      // Decrypt sensitive information
      const { accountNumber, routingNumber } = await bankEncryption.decryptBankInfo(
        {
          encrypted: encryptedData.account_number_encrypted,
          iv: encryptedData.account_number_iv
        },
        {
          encrypted: encryptedData.routing_number_encrypted,
          iv: encryptedData.routing_number_iv
        }
      );

      console.log('Bank account decrypted successfully for payout processing');

      return {
        id: encryptedData.id,
        talent_id: encryptedData.talent_id,
        account_holder_name: encryptedData.account_holder_name,
        bank_name: encryptedData.bank_name,
        account_type: encryptedData.account_type,
        account_number: accountNumber,
        routing_number: routingNumber,
        is_verified: encryptedData.is_verified,
        created_at: encryptedData.created_at,
        updated_at: encryptedData.updated_at
      };

    } catch (error) {
      console.error('Error retrieving/decrypting bank account:', error);
      throw error;
    }
  }

  // Update bank account information with encryption
  public async updateBankAccount(
    talentId: string,
    bankInfo: {
      account_holder_name: string;
      bank_name: string;
      account_number: string;
      routing_number: string;
      account_type: 'checking' | 'savings';
    }
  ): Promise<void> {
    try {
      console.log('Updating bank account with encryption for talent:', talentId);

      // Encrypt sensitive information
      const { encryptedAccount, encryptedRouting } = await bankEncryption.encryptBankInfo(
        bankInfo.account_number,
        bankInfo.routing_number
      );

      const { error } = await supabase
        .from('vendor_bank_info')
        .upsert([{
          talent_id: talentId,
          account_holder_name: bankInfo.account_holder_name,
          bank_name: bankInfo.bank_name,
          account_type: bankInfo.account_type,
          // Store encrypted data
          account_number_encrypted: encryptedAccount.encrypted,
          account_number_iv: encryptedAccount.iv,
          routing_number_encrypted: encryptedRouting.encrypted,
          routing_number_iv: encryptedRouting.iv,
          // Store masked versions for display
          account_number_masked: bankEncryption.maskAccountNumber(bankInfo.account_number),
          routing_number_masked: bankEncryption.maskRoutingNumber(bankInfo.routing_number),
        }]);

      if (error) throw error;

      console.log('Bank account updated and encrypted successfully');
    } catch (error) {
      console.error('Error updating bank account:', error);
      throw error;
    }
  }

  // Verify bank account (admin only)
  public async verifyBankAccount(talentId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('vendor_bank_info')
        .update({ is_verified: true })
        .eq('talent_id', talentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error verifying bank account:', error);
      throw error;
    }
  }
}

export const bankAccountService = new BankAccountService();
