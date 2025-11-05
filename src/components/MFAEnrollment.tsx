import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { QrCodeIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface MFAEnrollmentProps {
  onComplete: () => void;
  onSkip?: () => void;
  required?: boolean;
}

const MFAEnrollment: React.FC<MFAEnrollmentProps> = ({ onComplete, onSkip, required = false }) => {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const startEnrollment = async () => {
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
      console.error('MFA enrollment error:', error);
      toast.error('Failed to start MFA enrollment');
    } finally {
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
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: verifyCode
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
            You'll need an authenticator app like Google Authenticator or Authy.
          </p>
          <div className="space-y-3">
            <button
              onClick={startEnrollment}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
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

      {/* QR Code Step */}
      {step === 'qr' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Scan QR Code</h3>
            <button
              onClick={() => setStep('intro')}
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
              onClick={() => setStep('qr')}
              className="text-gray-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Enter the 6-digit code from your authenticator app:
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
          </div>
        </div>
      )}
    </div>
  );
};

export default MFAEnrollment;

