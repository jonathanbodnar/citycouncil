import React, { useState } from 'react';
import { XMarkIcon, DevicePhoneMobileIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface PhoneNumberPromptProps {
  onComplete: () => void;
  onDismiss: () => void;
}

const PhoneNumberPrompt: React.FC<PhoneNumberPromptProps> = ({ onComplete, onDismiss }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handleSavePhone = async () => {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    if (cleanedPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Save phone to users table in E.164 format
      const formattedPhone = `+1${cleanedPhone}`;
      const { error } = await supabase
        .from('users')
        .update({ phone: formattedPhone })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Phone number saved successfully!');
      onComplete();
    } catch (error: any) {
      console.error('Error saving phone number:', error);
      toast.error(error.message || 'Failed to save phone number');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-6 mb-6 border-2 border-blue-500/50 relative">
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>

      {/* Icon */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-blue-500/20 rounded-full">
          <DevicePhoneMobileIcon className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Add Your Phone Number</h3>
          <p className="text-sm text-gray-300">Required for account security & payouts</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-white/5 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-300 mb-2 font-semibold">Why we need this:</p>
        <ul className="text-xs text-gray-400 space-y-1">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span><strong>Two-Factor Authentication:</strong> Secure your account with SMS verification</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span><strong>Payout Integration:</strong> Required by Plaid & Moov for bank verification</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span><strong>Fraud Prevention:</strong> Helps protect your earnings and identity</span>
          </li>
        </ul>
      </div>

      {/* Phone input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-white mb-2">
          Phone Number *
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
          className="w-full px-4 py-2.5 glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="(555) 123-4567"
          maxLength={14}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSavePhone}
          disabled={saving || phoneNumber.replace(/\D/g, '').length !== 10}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Phone Number'}
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2.5 glass border border-white/30 rounded-lg text-white font-semibold hover:bg-white/10 transition-all duration-300"
        >
          Later
        </button>
      </div>
    </div>
  );
};

export default PhoneNumberPrompt;

