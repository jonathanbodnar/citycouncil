import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { ShieldCheckIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import MFAEnrollmentDual from './MFAEnrollmentDual';
import toast from 'react-hot-toast';

const MFASettings: React.FC = () => {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;

      if (data) {
        const activeFactors = data.totp.filter((f: any) => f.status === 'verified') || [];
        setMfaFactors(activeFactors);
        setMfaEnabled(activeFactors.length > 0);
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async (factorId: string) => {
    if (!window.confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
      return;
    }

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorId
      });

      if (error) throw error;

      toast.success('MFA disabled successfully');
      await checkMFAStatus();
    } catch (error: any) {
      console.error('Error disabling MFA:', error);
      toast.error('Failed to disable MFA');
    }
  };

  if (loading) {
    return (
      <div className="glass-strong rounded-2xl p-6 border border-white/30">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (showEnrollment) {
    return (
      <div className="glass-strong rounded-2xl p-6 border border-white/30">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Enable Two-Factor Authentication</h3>
          <button
            onClick={() => setShowEnrollment(false)}
            className="text-gray-400 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <MFAEnrollmentDual
          onComplete={async () => {
            toast.success('MFA enabled successfully!');
            setShowEnrollment(false);
            await checkMFAStatus();
          }}
          onSkip={() => setShowEnrollment(false)}
          required={false}
        />
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl p-6 border border-white/30">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
            mfaEnabled ? 'bg-green-100' : 'bg-gray-700'
          }`}>
            <ShieldCheckIcon className={`h-6 w-6 ${
              mfaEnabled ? 'text-green-600' : 'text-gray-400'
            }`} />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-white">
              Two-Factor Authentication
            </h3>
            <p className="text-sm text-gray-400">
              {mfaEnabled 
                ? 'Your account is protected with MFA'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          mfaEnabled 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-700 text-gray-400'
        }`}>
          {mfaEnabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>

      {mfaEnabled ? (
        <div className="mt-6 space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-white mb-3">Active Methods:</h4>
            {mfaFactors.map((factor) => (
              <div key={factor.id} className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-400 mr-3" />
                  <div>
                    <p className="text-white font-medium">
                      {factor.friendly_name || 'Authenticator App'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {factor.factor_type === 'totp' ? 'TOTP (Time-based codes)' : 'SMS (Text messages)'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisableMFA(factor.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Disable
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowEnrollment(true)}
            className="w-full py-2 px-4 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors text-sm"
          >
            Add Another Method
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-400">
              ⚠️ Your account is not protected by MFA. We strongly recommend enabling it to secure your earnings and personal information.
            </p>
          </div>
          
          <button
            onClick={() => setShowEnrollment(true)}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Enable Two-Factor Authentication
          </button>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-700">
        <h4 className="text-sm font-medium text-white mb-2">About MFA</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Protects your account even if your password is compromised</li>
          <li>• Required for accessing payouts and sensitive information</li>
          <li>• Choose between authenticator app (free) or SMS text messages</li>
        </ul>
      </div>
    </div>
  );
};

export default MFASettings;

