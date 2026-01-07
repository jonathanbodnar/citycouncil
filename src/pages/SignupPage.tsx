import React, { useState, useRef, useEffect } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';
import PhoneInput from '../components/PhoneInput';
import toast from 'react-hot-toast';
import { EnvelopeIcon, DevicePhoneMobileIcon, KeyIcon, ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

type Step = 'email' | 'phone' | 'otp';

const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get('returnTo') || '/';
  
  // Capture UTM source from URL or localStorage
  const getPromoSource = (): string | null => {
    const simpleUtm = searchParams.get('utm');
    if (simpleUtm) return simpleUtm;
    
    const utmSource = searchParams.get('utm_source');
    if (utmSource) {
      const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
      const normalizedSource = utmSource.toLowerCase();
      return fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : utmSource;
    }
    
    try {
      return localStorage.getItem('promo_source_global') || localStorage.getItem('promo_source') || null;
    } catch {
      return null;
    }
  };
  
  const promoSource = getPromoSource();
  
  // Form state
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [phoneHint, setPhoneHint] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { user } = useAuth();

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  // Email validation
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Phone validation (at least 10 digits)
  const isValidPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
  };

  // Handle email submission - check if user exists with phone, skip to OTP if so
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    setLoading(true);
    
    try {
      // Use edge function to check user and send OTP if they have a phone
      // This bypasses RLS since edge functions use service role
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ 
            email: normalizedEmail,
            checkEmailOnly: true // New flag: check if user has phone, send OTP if so
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.sentToExistingPhone) {
        // User exists with phone - OTP was sent, skip to code step
        console.log('📧 Existing user with phone, OTP sent');
        setPhone(data.phone || '');
        setPhoneHint(data.phoneHint);
        setStep('otp');
        setResendCooldown(60);
        toast.success('Welcome back! Code sent to your phone.');
        
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
        
        return;
      }
      
      if (data.rateLimited) {
        toast.error(data.error);
        setResendCooldown(60);
        if (data.phoneHint) {
          setPhoneHint(data.phoneHint);
          setStep('otp');
        }
        return;
      }
      
      // No existing user with phone - capture email and go to phone step
      // The edge function already captured the lead, just proceed
      if (data.needsPhone) {
        console.log('📧 User needs phone, proceeding to phone step');
      }
      
      setStep('phone');
      
    } catch (error: any) {
      console.log('Email check error:', error.message);
      // On error, just proceed to phone step
      setStep('phone');
    } finally {
      setLoading(false);
    }
  };

  // Handle phone submission - send OTP
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPhone(phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone, email }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        if (data.rateLimited) {
          toast.error(data.error);
          setResendCooldown(60);
          return;
        }
        throw new Error(data.error);
      }
      
      setPhoneHint(data.phoneHint);
      setStep('otp');
      setResendCooldown(60);
      
      // Show appropriate message based on whether user exists
      if (data.isExistingUser) {
        toast.success('Welcome back! Login code sent.');
      } else {
        toast.success('Verification code sent!');
      }
      
      // Focus first OTP input
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits entered
    if (digit && index === 5) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        handleOtpSubmit(fullCode);
      }
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      handleOtpSubmit(pastedData);
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP and create account (or login if existing user)
  const handleOtpSubmit = async (code?: string) => {
    const otpCode = code || otp.join('');
    
    if (otpCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    
    console.log('🔐 Verifying OTP:', { phone, email, codeLength: otpCode.length });
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/verify-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone, code: otpCode, email, promoSource }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      // Show appropriate message based on login vs registration
      if (data.isLogin) {
        toast.success('Welcome back! Logging you in...');
      } else {
        toast.success('Account created! Logging you in...');
        
        // Only fire tracking events for NEW registrations
        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', 'CompleteRegistration', {
            content_name: 'User Registration',
            status: 'complete'
          });
        }
        
        if (typeof window !== 'undefined' && (window as any).ratag) {
          (window as any).ratag('conversion', { to: 3337 });
        }
        
        // Send to Zapier only for new registrations
        supabase.functions.invoke('send-user-webhook', {
          body: {
            name: email.split('@')[0],
            email: email,
            registered_at: new Date().toISOString()
          }
        }).catch(console.error);
      }
      
      // Set session directly if tokens are provided (preferred method)
      if (data.session?.access_token && data.session?.refresh_token) {
        console.log('Setting session directly with tokens');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        
        if (sessionError) {
          console.error('Error setting session:', sessionError);
          // Fall back to magic link if available
          if (data.magicLink) {
            window.location.href = data.magicLink;
            return;
          }
        } else {
          // Session set successfully, navigate
          console.log('Session set successfully, navigating to:', returnTo);
          navigate(returnTo, { replace: true });
          return;
        }
      }
      
      // Fallback: use magic link to log in
      if (data.magicLink) {
        window.location.href = data.magicLink;
      } else {
        navigate(returnTo, { replace: true });
      }
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify code');
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone, email }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setResendCooldown(60);
      toast.success('New code sent!');
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Step indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {['email', 'phone', 'otp'].map((s, i) => (
        <React.Fragment key={s}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === s
                ? 'bg-primary-600 text-white'
                : ['email', 'phone', 'otp'].indexOf(step) > i
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {i + 1}
          </div>
          {i < 2 && (
            <div
              className={`w-12 h-0.5 ${
                ['email', 'phone', 'otp'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link to="/" className="flex justify-center">
            <Logo size="lg" theme="dark" />
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Login or Register
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Enter your email and verify with your phone
          </p>
        </div>

        <StepIndicator />

        <div className="glass rounded-xl p-6">
          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <EnvelopeIcon className="h-8 w-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-white">Enter your email</h3>
                <p className="text-sm text-gray-400 mt-1">We'll use this for order confirmations</p>
              </div>
              
              <div>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-600 bg-gray-800 placeholder-gray-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Checking...' : 'Continue'}
                {!loading && <ArrowRightIcon className="h-4 w-4" />}
              </button>
            </form>
          )}

          {/* Step 2: Phone */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DevicePhoneMobileIcon className="h-8 w-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-white">Verify your phone</h3>
                <p className="text-sm text-gray-400 mt-1">We'll send you a code to verify</p>
              </div>
              
              <div>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  placeholder="(555) 123-4567"
                  required={true}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 hover:bg-gray-800 focus:outline-none transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Code'}
                  {!loading && <ArrowRightIcon className="h-4 w-4" />}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: OTP */}
          {step === 'otp' && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <KeyIcon className="h-8 w-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-white">Enter verification code</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Sent to {phoneHint || phone}
                </p>
              </div>
              
              {/* Single OTP input for best autofill compatibility (macOS/iOS/Android) */}
              <div>
                <input
                  ref={(el) => { otpInputRefs.current[0] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  className="w-full h-16 text-center text-3xl font-mono font-bold tracking-[0.5em] border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-gray-600"
                  value={otp.join('')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    const newOtp = value.split('').concat(Array(6).fill('')).slice(0, 6);
                    setOtp(newOtp);
                    
                    // Auto-submit when 6 digits entered
                    if (value.length === 6) {
                      handleOtpSubmit(value);
                    }
                  }}
                  onPaste={(e) => {
                    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (pastedData.length === 6) {
                      e.preventDefault();
                      const newOtp = pastedData.split('');
                      setOtp(newOtp);
                      handleOtpSubmit(pastedData);
                    }
                  }}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setOtp(['', '', '', '', '', '']);
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 hover:bg-gray-800 focus:outline-none transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={() => handleOtpSubmit()}
                  disabled={loading || otp.join('').length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Create Account'}
                </button>
              </div>
              
              {/* Resend */}
              <div className="text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm text-primary-400 hover:text-primary-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive a code? Resend"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Terms */}
        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="text-primary-400 hover:text-primary-300">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-primary-400 hover:text-primary-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
