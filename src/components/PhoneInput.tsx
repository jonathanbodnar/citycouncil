import React, { useState, useEffect } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export default function PhoneInput({
  value,
  onChange,
  label = 'Phone Number',
  placeholder = '(555) 123-4567',
  required = false,
  disabled = false,
  error
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  // Format phone number for display
  const formatPhoneDisplay = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Remove leading 1 if present (we'll add +1 automatically)
    const withoutCountryCode = digits.startsWith('1') ? digits.slice(1) : digits;
    
    // Format as (XXX) XXX-XXXX
    if (withoutCountryCode.length === 0) return '';
    if (withoutCountryCode.length <= 3) return `(${withoutCountryCode}`;
    if (withoutCountryCode.length <= 6) {
      return `(${withoutCountryCode.slice(0, 3)}) ${withoutCountryCode.slice(3)}`;
    }
    return `(${withoutCountryCode.slice(0, 3)}) ${withoutCountryCode.slice(3, 6)}-${withoutCountryCode.slice(6, 10)}`;
  };

  // Convert to E.164 format (+1XXXXXXXXXX)
  const toE164 = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const withoutCountryCode = digits.startsWith('1') ? digits.slice(1) : digits;
    
    if (withoutCountryCode.length === 0) return '';
    if (withoutCountryCode.length !== 10) return ''; // Invalid phone
    
    return `+1${withoutCountryCode}`;
  };

  // Convert from E.164 to display format
  const fromE164 = (phone: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    const withoutCountryCode = digits.startsWith('1') ? digits.slice(1) : digits;
    return formatPhoneDisplay(withoutCountryCode);
  };

  // Initialize display value from E.164 value
  useEffect(() => {
    if (value) {
      setDisplayValue(fromE164(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    const withoutCountryCode = digits.startsWith('1') ? digits.slice(1) : digits;
    
    // Limit to 10 digits
    if (withoutCountryCode.length > 10) return;
    
    // Update display
    const formatted = formatPhoneDisplay(withoutCountryCode);
    setDisplayValue(formatted);
    
    // Update parent with E.164 format
    const e164 = toE164(withoutCountryCode);
    onChange(e164);
  };

  const handleBlur = () => {
    // Validate on blur
    if (displayValue && !value) {
      // Phone is incomplete
      return;
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500 sm:text-sm">+1</span>
        </div>
        <input
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-300' : 'border-gray-300'}
          `}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {displayValue && !error && (
        <p className="mt-1 text-xs text-gray-500">
          Format: {value || 'Incomplete'}
        </p>
      )}
    </div>
  );
}

