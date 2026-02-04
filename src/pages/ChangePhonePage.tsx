import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';
import { DevicePhoneMobileIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

type PageState = 'loading' | 'valid' | 'invalid' | 'verifying' | 'success';

const ChangePhonePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [pageState, setPageState] = useState<PageState>('loading');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setPageState('invalid');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('phone_change_tokens')
          .select('user_id, expires_at, used, users!inner(email)')
          .eq('token', token)
          .single();

        if (error || !data) {
          console.log('Token not found:', error);
          setPageState('invalid');
          return;
        }

        if (data.used) {
          console.log('Token already used');
          setPageState('invalid');
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          console.log('Token expired');
          setPageState('invalid');
          return;
        }

        setUserId(data.user_id);
        setUserEmail((data.users as any)?.email || null);
        setPageState('valid');
      } catch (error) {
        console.error('Error validating token:', error);
        setPageState('invalid');
      }
    };

    validateToken();
  }, [token]);

  // Cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  // Format phone for display
  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otpCode];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtpCode(newOtp);
    const lastIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[lastIndex]?.focus();
  };

  // Send verification code to new phone
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = `+1${phone}`;
      
      // Check if phone is already in use by another user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formattedPhone)
        .neq('id', userId)
        .single();

      if (existingUser) {
        toast.error('This phone number is already associated with another account');
        setLoading(false);
        return;
      }

      // Send OTP to the new phone
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: formattedPhone, email: userEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.rateLimited) {
          toast.error('Please wait before requesting another code');
          setOtpCooldown(60);
        } else {
          throw new Error(data.error || 'Failed to send code');
        }
      } else {
        toast.success('Verification code sent!');
        setPageState('verifying');
        setOtpCooldown(60);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and update phone
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const code = otpCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = `+1${phone}`;
      
      // Verify OTP
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/verify-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: formattedPhone, code, email: userEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid code');
      }

      // OTP verified - update user's phone number
      const { error: updateError } = await supabase
        .from('users')
        .update({ phone: formattedPhone })
        .eq('id', userId);

      if (updateError) {
        throw new Error('Failed to update phone number');
      }

      // Mark token as used
      await supabase
        .from('phone_change_tokens')
        .update({ used: true })
        .eq('token', token);

      // Also update beta_signups if they have an entry
      await supabase
        .from('beta_signups')
        .update({ phone_number: formattedPhone })
        .eq('phone_number', formattedPhone);

      setPageState('success');
      toast.success('Phone number updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify code');
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    
    setLoading(true);
    try {
      const formattedPhone = `+1${phone}`;
      
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: formattedPhone, email: userEmail }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('New code sent!');
        setOtpCooldown(60);
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        toast.error(data.error || 'Failed to resend code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Validating link...</p>
        </div>
      </div>
    );
  }

  // Invalid/expired token
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Link Invalid or Expired</h2>
          <p className="text-gray-400 mb-6">
            This link is no longer valid. It may have expired or already been used.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Phone Number Updated!</h2>
          <p className="text-gray-400 mb-6">
            Your phone number has been successfully updated. You can now log in using your new number.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link to="/" className="flex justify-center">
            <Logo size="lg" theme="dark" />
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Update Phone Number
          </h2>
          {userEmail && (
            <p className="mt-2 text-center text-sm text-gray-400">
              For account: <span className="text-white">{userEmail}</span>
            </p>
          )}
        </div>

        {/* Enter new phone number */}
        {pageState === 'valid' && (
          <form className="mt-8 space-y-6" onSubmit={handleSendOtp}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                New Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">+1</span>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  autoFocus
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                  placeholder="(555) 555-5555"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                We'll send a verification code to confirm this is your number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
              {loading ? 'Sending code...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {/* Verify OTP */}
        {pageState === 'verifying' && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
            <div className="text-center">
              <p className="text-gray-300 mb-2">
                Enter the 6-digit code sent to
              </p>
              <p className="text-white font-medium">{formatPhoneDisplay(phone)}</p>
            </div>

            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border border-gray-600 bg-gray-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.join('').length !== 6}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Verifying...' : 'Update Phone Number'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setPageState('valid');
                  setOtpCode(['', '', '', '', '', '']);
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCooldown > 0 || loading}
                className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePhonePage;
