import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface SecureBankInputProps {
  label: string;
  type: 'account' | 'routing';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
}

const SecureBankInput: React.FC<SecureBankInputProps> = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  required = false,
  pattern,
  maxLength
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Mask the value for display when not visible and not focused
  const getMaskedValue = (val: string) => {
    if (isVisible || isFocused || val.length === 0) {
      return val;
    }
    
    if (type === 'account') {
      // Show only last 4 digits for account number
      return val.length > 4 ? '*'.repeat(val.length - 4) + val.slice(-4) : val;
    } else {
      // Show only first 4 digits for routing number
      return val.length > 4 ? val.slice(0, 4) + '*'.repeat(val.length - 4) : val;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const numericValue = e.target.value.replace(/\D/g, '');
    onChange(numericValue);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={getMaskedValue(value)}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          pattern={pattern}
          maxLength={maxLength}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
        >
          {isVisible ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {/* Security notice */}
      <p className="text-xs text-gray-500 mt-1 flex items-center">
        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
        Encrypted and securely stored
      </p>
      
      {/* Validation hints */}
      {type === 'account' && (
        <p className="text-xs text-gray-500 mt-1">
          Enter your full bank account number (8-17 digits)
        </p>
      )}
      {type === 'routing' && (
        <p className="text-xs text-gray-500 mt-1">
          Enter your 9-digit routing number (found on checks)
        </p>
      )}
    </div>
  );
};

export default SecureBankInput;
