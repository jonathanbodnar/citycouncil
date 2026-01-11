import { useState } from 'react';
import { supabase } from '../services/supabase';

interface PhoneVerificationResult {
  valid: boolean;
  phone?: string;
  nationalFormat?: string;
  lineType?: string;
  carrier?: string;
  canReceiveSMS?: boolean;
  warning?: string | null;
  error?: string;
  errorCode?: string;
}

export function usePhoneVerification() {
  const [verifying, setVerifying] = useState(false);

  const verifyPhone = async (phone: string): Promise<PhoneVerificationResult> => {
    setVerifying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone', {
        body: { phone },
      });

      if (error) {
        console.error('Error calling verify-phone function:', error);
        return {
          valid: false,
          error: error.message || 'Failed to verify phone number',
        };
      }

      return data as PhoneVerificationResult;
    } catch (err: any) {
      console.error('Phone verification error:', err);
      return {
        valid: false,
        error: err.message || 'Failed to verify phone number',
      };
    } finally {
      setVerifying(false);
    }
  };

  return {
    verifyPhone,
    verifying,
  };
}

