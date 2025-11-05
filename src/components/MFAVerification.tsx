import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { ShieldCheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface MFAVerificationProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const MFAVerification: React.FC<MFAVerificationProps> = ({ factorId, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: code
      });

      if (error) throw error;

      toast.success('Verification successful!');
      onSuccess();
    } catch (error: any) {
      console.error('MFA verification error:', error);
      toast.error('Invalid code. Please try again.');
      setCode(''); // Clear the code on error
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-8 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">
          Two-Factor Authentication
        </h3>
        <p className="text-gray-300">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(value);
          }}
          onKeyPress={handleKeyPress}
          placeholder="000000"
          className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-3xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={6}
          autoFocus
        />

        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          onClick={onCancel}
          disabled={loading}
          className="w-full flex items-center justify-center text-gray-400 hover:text-white py-2 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to login
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-400 text-center">
          🔒 Your account is protected by two-factor authentication
        </p>
      </div>
    </div>
  );
};

export default MFAVerification;

