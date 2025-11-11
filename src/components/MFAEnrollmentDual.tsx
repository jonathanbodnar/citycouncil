import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { QrCodeIcon, ShieldCheckIcon, XMarkIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface MFAEnrollmentDualProps {
  onComplete: () => void;
  onSkip?: () => void;
  required?: boolean;
  initialPhone?: string; // Pre-fill phone number (E.164 format: +1XXXXXXXXXX)
}

type MFAMethod = 'totp' | 'phone' | null;

const MFAEnrollmentDual: React.FC<MFAEnrollmentDualProps> = ({ onComplete, onSkip, required = false, initialPhone }) => {
  const [step, setStep] = useState<'intro' | 'phone-entry' | 'verify'>('intro');
  const [selectedMethod] = useState<MFAMethod>('phone'); // SMS only
  
  // TOTP states
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  
  // Phone states
  const [phoneNumber, setPhoneNumber] = useState('');

  // Auto-populate phone number if provided
  useEffect(() => {
    if (initialPhone) {
      // Convert E.164 (+1XXXXXXXXXX) to formatted (XXX) XXX-XXXX
      const digits = initialPhone.replace(/\D/g, '').slice(-10); // Get last 10 digits
      if (digits.length === 10) {
        const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        setPhoneNumber(formatted);
      }
    }
  }, [initialPhone]);
  
  // Common states
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Clean up any existing unverified factors (both phone and TOTP) that might be stuck
  useEffect(() => {
    const cleanupStuckFactors = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (!factors?.all) return;

        // Find any unverified factors (phone OR totp)
        const unverifiedFactors = factors.all.filter(
          (f: any) => f.status === 'unverified'
        );

        // Unenroll them
        for (const factor of unverifiedFactors) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
            console.log(`Cleaned up unverified ${factor.factor_type} factor:`, factor.id);
            toast.success(`Cleaned up stuck ${factor.factor_type === 'totp' ? 'authenticator' : 'phone'} setup`, { duration: 2000 });
          } catch (err) {
            console.error('Failed to cleanup factor:', err);
          }
        }
      } catch (error) {
        console.error('Error cleaning up stuck factors:', error);
      }
    };

    cleanupStuckFactors();
  }, []);

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // TOTP enrollment removed - SMS only

  const startPhoneEnrollment = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      // Check if phone MFA is already enrolled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const existingPhoneFactor = factors?.all?.find((f: any) => f.factor_type === 'phone');
      
      if (existingPhoneFactor) {
        console.log('Phone MFA already enrolled, using existing factor:', existingPhoneFactor);
        
        // If it's verified, just complete onboarding
        if (existingPhoneFactor.status === 'verified') {
          toast.success('Phone MFA already set up!');
          onComplete();
          return;
        }
        
        // If it's unverified, unenroll it first
        try {
          await supabase.auth.mfa.unenroll({ factorId: existingPhoneFactor.id });
          console.log('Removed existing unverified phone factor');
        } catch (unenrollError) {
          console.error('Failed to unenroll existing factor:', unenrollError);
        }
      }
      
      // Format phone to E.164 format (+1XXXXXXXXXX)
      const formattedPhone = `+1${phoneNumber.replace(/\D/g, '')}`;
      
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'phone',
        friendlyName: 'My Phone',
        phone: formattedPhone
      });

      if (error) throw error;

      if (data) {
        const enrolledFactorId = data.id;
        setFactorId(enrolledFactorId);
        
        try {
          // Send OTP to phone
          const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
            factorId: enrolledFactorId
          });

          if (challengeError) throw challengeError;
          
          if (challengeData) {
            setChallengeId(challengeData.id);
          }

          // Save phone number to users table for Plaid/Moov integration
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('users')
              .update({ phone: formattedPhone })
              .eq('id', user.id);
            console.log('Phone number saved to users table:', formattedPhone);
          }

          toast.success('Verification code sent to your phone!');
          setStep('verify');
        } catch (challengeError: any) {
          // Challenge failed, clean up the factor that was just created
          console.error('MFA challenge failed, cleaning up factor:', challengeError);
          try {
            await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
            console.log('Successfully cleaned up failed MFA factor');
          } catch (cleanupError) {
            console.error('Failed to cleanup MFA factor:', cleanupError);
          }
          setFactorId('');
          throw challengeError; // Re-throw to be caught by outer catch
        }
      }
    } catch (error: any) {
      console.error('MFA phone enrollment error:', error);
      
      if (error.message?.includes('Phone') || error.message?.includes('not enabled') || error.message?.includes('SMS') || error.message?.includes('factor')) {
        // User-friendly error message
        toast.error('SMS authentication requires Twilio setup. Please contact support.', {
          duration: 5000
        });
        // Reset state and redirect back to method selection
        setPhoneNumber('');
        // Wait a moment then complete
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        toast.error('Failed to start phone enrollment. Please try again.');
        // Reset state
        setPhoneNumber('');
        setStep('phone-entry');
      }
    } finally{
      setLoading(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting MFA verification:', {
        method: selectedMethod,
        factorId: factorId,
        challengeId: challengeId,
        codeLength: verifyCode.length
      });

      // For TOTP, use challengeAndVerify (creates challenge + verifies in one call)
      // For PHONE, use verify with challengeId
      if (selectedMethod === 'totp') {
        const { data, error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factorId,
          code: verifyCode
        });

        if (error) throw error;
        
        console.log('TOTP verification successful:', data);
        toast.success('Authenticator app enabled successfully!');
        onComplete();
      } else if (selectedMethod === 'phone') {
        // For phone, we already have a challengeId from enrollment
        const { data, error } = await supabase.auth.mfa.verify({
          factorId: factorId,
          challengeId: challengeId,
          code: verifyCode
        });

        if (error) throw error;
        
        console.log('Phone verification successful:', data);
        toast.success('SMS authentication enabled successfully!');
        onComplete();
      }
    } catch (error: any) {
      console.error('MFA verification error:', error);
      toast.error(`Invalid code. Please try again. ${error.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (required) {
      toast.error('MFA is required for talent accounts');
      return;
    }
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-6 max-w-md mx-auto">
      {/* Intro Step */}
      {step === 'intro' && (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Secure Your Account
          </h3>
          <p className="text-gray-300 mb-6">
            Enable Two-Factor Authentication (2FA) to add an extra layer of security to your account.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setStep('phone-entry')}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Enable SMS 2FA
            </button>
            {!required && onSkip && (
              <button
                onClick={handleSkip}
                className="w-full text-gray-400 hover:text-gray-300 py-2"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Method selection removed - SMS only */}

      {/* Phone Entry */}
      {step === 'phone-entry' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Enter Phone Number</h3>
            <button
              onClick={() => setStep('intro')}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Enter your mobile phone number to receive verification codes:
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number (US)
              </label>
              <input
                type="tel"
                value={formatPhoneNumber(phoneNumber)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '');
                  if (cleaned.length <= 10) {
                    setPhoneNumber(cleaned);
                  }
                }}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-gray-400">
                Standard messaging rates may apply
              </p>
            </div>

            <button
              onClick={startPhoneEnrollment}
              disabled={loading || phoneNumber.replace(/\D/g, '').length !== 10}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </div>
        </div>
      )}

      {/* QR Code step removed - SMS only */}

      {/* Verify Step */}
      {step === 'verify' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Enter Verification Code</h3>
            <button
              onClick={() => setStep('phone-entry')}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Enter the 6-digit code sent to your phone:
            </p>

            <input
              type="text"
              value={verifyCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerifyCode(value);
              }}
              placeholder="000000"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-2xl font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={6}
              autoFocus
            />

            <button
              onClick={verifyEnrollment}
              disabled={loading || verifyCode.length !== 6}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
            </button>

            {selectedMethod === 'phone' && (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await supabase.auth.mfa.challenge({ factorId });
                    toast.success('Code resent!');
                  } catch (error) {
                    toast.error('Failed to resend code');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full text-gray-400 hover:text-white text-sm"
              >
                Resend Code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MFAEnrollmentDual;

