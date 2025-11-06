import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { QrCodeIcon, ShieldCheckIcon, XMarkIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface MFAEnrollmentDualProps {
  onComplete: () => void;
  onSkip?: () => void;
  required?: boolean;
}

type MFAMethod = 'totp' | 'phone' | null;

const MFAEnrollmentDual: React.FC<MFAEnrollmentDualProps> = ({ onComplete, onSkip, required = false }) => {
  const [step, setStep] = useState<'intro' | 'method-select' | 'phone-entry' | 'qr' | 'verify'>('intro');
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod>(null);
  
  // TOTP states
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  
  // Phone states
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Common states
  const [factorId, setFactorId] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const startTOTPEnrollment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('qr');
      }
    } catch (error: any) {
      console.error('MFA TOTP enrollment error:', error);
      toast.error('Failed to start authenticator app enrollment');
    } finally {
      setLoading(false);
    }
  };

  const startPhoneEnrollment = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      // Format phone to E.164 format (+1XXXXXXXXXX)
      const formattedPhone = `+1${phoneNumber.replace(/\D/g, '')}`;
      
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'phone',
        friendlyName: 'My Phone',
        phone: formattedPhone
      });

      if (error) throw error;

      if (data) {
        setFactorId(data.id);
        
        // Send OTP to phone
        const { error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: data.id
        });

        if (challengeError) throw challengeError;

        toast.success('Verification code sent to your phone!');
        setStep('verify');
      }
    } catch (error: any) {
      console.error('MFA phone enrollment error:', error);
      if (error.message?.includes('Phone') || error.message?.includes('not enabled') || error.message?.includes('SMS')) {
        toast.error('SMS MFA requires Twilio setup ($75/mo). Please use Authenticator App instead.', {
          duration: 5000
        });
        // Auto-redirect back to method selection
        setTimeout(() => {
          setStep('method-select');
        }, 2000);
      } else {
        toast.error(`Failed to start phone enrollment: ${error.message}`);
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
      // For ENROLLMENT, use mfa.verify() not challengeAndVerify()
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: factorId,
        code: verifyCode,
        friendlyName: selectedMethod === 'totp' ? 'Authenticator App' : 'My Phone'
      });

      if (error) throw error;

      toast.success('MFA enabled successfully!');
      onComplete();
    } catch (error: any) {
      console.error('MFA verification error:', error);
      toast.error('Invalid code. Please try again.');
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
              onClick={() => setStep('method-select')}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Enable 2FA
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

      {/* Method Selection */}
      {step === 'method-select' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Choose MFA Method</h3>
            <button
              onClick={() => setStep('intro')}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <p className="text-gray-300 text-sm mb-6">
            Select how you'd like to receive your security codes:
          </p>

          <div className="space-y-3">
            {/* Authenticator App Option */}
            <button
              onClick={() => {
                setSelectedMethod('totp');
                startTOTPEnrollment();
              }}
              disabled={loading}
              className="w-full p-4 border-2 border-gray-700 hover:border-blue-500 rounded-lg transition-colors text-left group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <QrCodeIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-white font-semibold mb-1">Authenticator App</div>
                  <div className="text-gray-400 text-sm">
                    Use Google Authenticator, Authy, or similar app
                  </div>
                </div>
              </div>
            </button>

            {/* SMS Option */}
            <button
              onClick={() => {
                setSelectedMethod('phone');
                setStep('phone-entry');
              }}
              disabled={loading}
              className="w-full p-4 border-2 border-gray-700 hover:border-blue-500 rounded-lg transition-colors text-left group relative"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0 h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <DevicePhoneMobileIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-white font-semibold mb-1 flex items-center gap-2">
                    Text Message (SMS)
                    <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">Requires Setup</span>
                  </div>
                  <div className="text-gray-400 text-sm">
                    Receive codes via text message (Twilio required)
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Phone Entry */}
      {step === 'phone-entry' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Enter Phone Number</h3>
            <button
              onClick={() => setStep('method-select')}
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

      {/* QR Code Step (TOTP only) */}
      {step === 'qr' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Scan QR Code</h3>
            <button
              onClick={() => setStep('method-select')}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Open your authenticator app and scan this QR code:
            </p>
            
            {qrCode && (
              <div className="bg-white p-4 rounded-lg flex justify-center">
                <img 
                  src={qrCode} 
                  alt="MFA QR Code" 
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="bg-gray-800/50 p-4 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">
                Can't scan? Enter this code manually:
              </p>
              <div className="flex items-center justify-between bg-gray-900 p-3 rounded">
                <code className="text-sm text-white font-mono">{secret}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(secret);
                    toast.success('Code copied!');
                  }}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Continue to Verification
            </button>
          </div>
        </div>
      )}

      {/* Verify Step */}
      {step === 'verify' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Enter Verification Code</h3>
            <button
              onClick={() => setStep(selectedMethod === 'totp' ? 'qr' : 'phone-entry')}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              {selectedMethod === 'totp' 
                ? 'Enter the 6-digit code from your authenticator app:'
                : 'Enter the 6-digit code sent to your phone:'}
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

