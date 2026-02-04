import React, { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import MFAVerification from '../components/MFAVerification';
import { DevicePhoneMobileIcon, KeyIcon, ArrowLeftIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

type LoginMode = 'email' | 'phone' | 'password' | 'otp';

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = searchParams.get('returnTo') || '/';
  
  // Login mode state - default to email if we have a giveaway email stored
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  
  // Email-first state - initialize from localStorage if available
  const [email, setEmail] = useState(() => {
    const stored = localStorage.getItem('giveaway_email');
    console.log('[LoginPage] Initial email from localStorage:', stored);
    return stored || '';
  });
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [showChangePhoneModal, setShowChangePhoneModal] = useState(false);
  const [changePhoneLoading, setChangePhoneLoading] = useState(false);
  
  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [phoneHint, setPhoneHint] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Password login state
  const [password, setPassword] = useState('');
  
  // General state
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const { user, signIn, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  
  // Check for stored giveaway email on mount and on navigation
  useEffect(() => {
    const storedEmail = localStorage.getItem('giveaway_email');
    console.log('[LoginPage] Checking for giveaway_email on navigation:', storedEmail);
    if (storedEmail && !email) {
      console.log('[LoginPage] Found giveaway_email, setting and looking up:', storedEmail);
      setEmail(storedEmail);
      handleEmailLookup(storedEmail);
    } else if (storedEmail && email === storedEmail && loginMode === 'email') {
      // Email already set from initial state, just do the lookup
      console.log('[LoginPage] Email already set, doing lookup:', storedEmail);
      handleEmailLookup(storedEmail);
    }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Look up user's phone by email and auto-send OTP
  const handleEmailLookup = async (emailToLookup: string) => {
    const normalizedEmail = emailToLookup.toLowerCase().trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return;
    }
    
    setLoading(true);
    try {
      // Look up user by email
      const { data: userData, error } = await supabase
        .from('users')
        .select('phone')
        .eq('email', normalizedEmail)
        .single();
      
      if (error || !userData?.phone) {
        // No user found or no phone on file - fall back to phone entry
        setLoading(false);
        return;
      }
      
      // User has phone on file - store it and auto-send OTP
      const phoneDigits = userData.phone.replace(/\D/g, '').slice(-10);
      setUserPhone(userData.phone);
      setPhone(phoneDigits);
      
      // Auto-send OTP to their phone
      const result = await sendPhoneOtp(phoneDigits);
      
      if (result.rateLimited) {
        toast.error(result.error || 'Please wait before requesting another code');
        setOtpCooldown(60);
        setLoginMode('otp');
      } else if (result.success) {
        toast.success('Verification code sent to your phone!');
        setPhoneHint(result.phoneHint || `***-***-${phoneDigits.slice(-4)}`);
        setLoginMode('otp');
        setOtpCooldown(60);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        // Failed to send - let them enter phone manually
        toast.error(result.error || 'Failed to send code');
      }
    } catch (error: any) {
      console.error('Email lookup error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle email form submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      // Look up user by email
      const { data: userData, error } = await supabase
        .from('users')
        .select('phone')
        .eq('email', normalizedEmail)
        .single();
      
      if (error || !userData) {
        // No user found - they might need to sign up
        toast.error('No account found with this email. Please sign up first.');
        setLoading(false);
        return;
      }
      
      if (!userData.phone) {
        // User exists but no phone - they can add one via password login
        toast('No phone on file. Use password login or contact support.', { icon: '📞' });
        setLoginMode('password');
        setLoading(false);
        return;
      }
      
      // User has phone on file - auto-send OTP
      const phoneDigits = userData.phone.replace(/\D/g, '').slice(-10);
      setUserPhone(userData.phone);
      setPhone(phoneDigits);
      
      const result = await sendPhoneOtp(phoneDigits);
      
      if (result.rateLimited) {
        toast.error(result.error || 'Please wait before requesting another code');
        setOtpCooldown(60);
        setLoginMode('otp');
      } else if (result.success) {
        toast.success('Verification code sent to your phone!');
        setPhoneHint(result.phoneHint || `***-***-${phoneDigits.slice(-4)}`);
        setLoginMode('otp');
        setOtpCooldown(60);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        toast.error(result.error || 'Failed to send code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle change phone number request
  const handleChangePhoneRequest = async () => {
    if (!email) {
      toast.error('Please enter your email first');
      return;
    }
    
    setChangePhoneLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-change-phone-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Check your email for a link to update your phone number');
        setShowChangePhoneModal(false);
      } else {
        toast.error(data.error || 'Failed to send email');
      }
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setChangePhoneLoading(false);
    }
  };

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  // Handle redirect after successful login
  useEffect(() => {
    const handleRedirect = async () => {
      console.log('LoginPage useEffect triggered:', { 
        hasUser: !!user, 
        showMFAVerification,
        userId: user?.id,
        userType: user?.user_type 
      });
      
      if (user && user.id && !showMFAVerification) {
        console.log('LoginPage: REDIRECT LOGIC RUNNING');
        
        const fulfillmentToken = sessionStorage.getItem('fulfillment_redirect_token');
        
        if (fulfillmentToken) {
          sessionStorage.removeItem('fulfillment_redirect_token');
          navigate(`/fulfill/${fulfillmentToken}`, { replace: true });
          return;
        }
        
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('user_type')
            .eq('id', user.id)
            .single();
          
          if (!error && userData?.user_type === 'talent') {
            navigate('/dashboard', { replace: true });
          } else if (user.user_type === 'talent') {
            navigate('/dashboard', { replace: true });
          } else {
            navigate(returnTo, { replace: true });
          }
        } catch (err) {
          console.error('LoginPage: Error checking user type:', err);
          if (user.user_type === 'talent') {
            navigate('/dashboard', { replace: true });
          } else {
            navigate(returnTo, { replace: true });
          }
        }
      }
    };
    
    handleRedirect();
  }, [user, showMFAVerification, navigate, returnTo]);

  // Don't render the form if user is already logged in
  if (user && !showMFAVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Format phone number as user types
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
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // Only take last digit
    setOtpCode(newOtp);
    
    // Auto-focus next input
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
    // Focus the last filled input or the next empty one
    const lastIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[lastIndex]?.focus();
  };

  // Send OTP code
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    try {
      const result = await sendPhoneOtp(phone);
      
      if (result.rateLimited) {
        toast.error(result.error || 'Please wait before requesting another code');
        setOtpCooldown(60);
      } else if (result.success) {
        toast.success('Verification code sent!');
        setPhoneHint(result.phoneHint || '');
        setLoginMode('otp');
        setOtpCooldown(60);
        // Focus first OTP input
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        toast.error(result.error || 'Failed to send code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    try {
      const result = await verifyPhoneOtp(phone, code);
      
      if (result.success) {
        if (result.magicLink) {
          // Fall back to magic link redirect if needed
          toast.success('Verified! Logging you in...');
          window.location.href = result.magicLink;
        } else {
          // Session was set directly - the auth state listener will handle redirect
          toast.success('Welcome back!');
          // The useEffect watching `user` will handle the redirect
        }
      } else {
        toast.error(result.error || 'Invalid code');
        // Clear the OTP inputs on error
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    
    setLoading(true);
    try {
      const result = await sendPhoneOtp(phone);
      
      if (result.success) {
        toast.success('New code sent!');
        setOtpCooldown(60);
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        toast.error(result.error || 'Failed to resend code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Password login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
      toast.error('Login is taking too long. Please try again.');
    }, 10000);

    try {
      const result = await signIn(email, password);
      clearTimeout(timeout);

      // Check if MFA is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        
        let factorId: string | null = null;
        
        if (factors?.totp && factors.totp.length > 0) {
          const verifiedTotp = factors.totp.find((f: any) => f.status === 'verified');
          if (verifiedTotp) factorId = verifiedTotp.id;
        }
        
        if (!factorId && factors?.phone && factors.phone.length > 0) {
          const verifiedPhone = factors.phone.find((f: any) => f.status === 'verified');
          if (verifiedPhone) {
            factorId = verifiedPhone.id;
            await supabase.auth.mfa.challenge({ factorId });
            toast.success('Verification code sent to your phone!');
          }
        }
        
        if (factorId) {
          setMfaFactorId(factorId);
          setShowMFAVerification(true);
          setLoading(false);
          return;
        }
      }

      toast.success('Welcome back! Redirecting...');
      setTimeout(() => navigate(returnTo), 1000);
    } catch (error: any) {
      clearTimeout(timeout);
      toast.error(error.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    setShowMFAVerification(false);
    toast.success('Welcome back!');
  };

  const handleMFACancel = () => {
    setShowMFAVerification(false);
    setMfaFactorId('');
    supabase.auth.signOut();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      const redirectUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5173/reset-password'
        : 'https://shoutout.us/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      toast.success('If an account exists with this email, you will receive a password reset link.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  // Show MFA verification if required
  if (showMFAVerification && mfaFactorId) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <MFAVerification
          factorId={mfaFactorId}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
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
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Or{' '}
            <Link
              to={`/signup${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              create a new account
            </Link>
          </p>
        </div>

        {/* Email-First Mode (default) */}
        {loginMode === 'email' && (
          <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                className="appearance-none block w-full px-4 py-3 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-400">
                We'll send a code to the phone number on your account
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              {loading ? 'Looking up account...' : 'Continue'}
            </button>
            
            {/* Change phone number link - show after email is entered */}
            {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowChangePhoneModal(true)}
                  className="text-xs text-gray-500 hover:text-gray-400 underline"
                >
                  Changed your phone number?
                </button>
              </div>
            )}

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 text-gray-400 bg-transparent">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMode('phone')}
              className="group relative w-full flex justify-center py-3 px-4 glass border border-white/30 text-sm font-medium rounded-xl text-white hover:bg-white hover:text-purple-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
            >
              <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
              Use phone number instead
            </button>
          </form>
        )}

        {/* Phone OTP Mode (manual phone entry) */}
        {loginMode === 'phone' && (
          <form className="mt-8 space-y-6" onSubmit={handleSendOtp}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
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
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                  placeholder="(555) 555-5555"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                We'll send you a 6-digit code to verify your identity
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
              {loading ? 'Sending code...' : 'Send verification code'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 text-gray-400 bg-transparent">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMode('email')}
              className="group relative w-full flex justify-center py-3 px-4 glass border border-white/30 text-sm font-medium rounded-xl text-white hover:bg-white hover:text-purple-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
            >
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              Use email instead
            </button>
          </form>
        )}

        {/* OTP Verification Mode */}
        {loginMode === 'otp' && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
            <div className="text-center">
              <p className="text-gray-300 mb-2">
                Enter the 6-digit code sent to
              </p>
              <p className="text-white font-medium">{phoneHint || formatPhoneDisplay(phone)}</p>
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
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setLoginMode(userPhone ? 'email' : 'phone');
                  setOtpCode(['', '', '', '', '', '']);
                }}
                className="text-gray-400 hover:text-gray-300 flex items-center"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Back
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
            
            {/* Change phone number link - only show if they came from email lookup */}
            {userPhone && email && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowChangePhoneModal(true)}
                  className="text-xs text-gray-500 hover:text-gray-400 underline"
                >
                  Changed your phone number?
                </button>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 text-gray-400 bg-transparent">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMode('password')}
              className="group relative w-full flex justify-center py-3 px-4 glass border border-white/30 text-sm font-medium rounded-xl text-white hover:bg-white hover:text-purple-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
            >
              <KeyIcon className="h-5 w-5 mr-2" />
              Use password instead
            </button>
          </form>
        )}

        {/* Password Mode */}
        {loginMode === 'password' && (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-t-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-b-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)}
                className="text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                Forgot your password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Signing in...' : 'Sign in with password'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 text-gray-400 bg-transparent">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMode('email')}
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium rounded-xl text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
            >
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              Use email instead
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-8 max-w-md w-full border border-white/30 shadow-modern-xl">
            <h3 className="text-2xl font-bold text-white mb-2">Reset Password</h3>
            <p className="text-gray-300 mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <form onSubmit={handleForgotPassword}>
              <div className="mb-4">
                <label htmlFor="reset-email" className="block text-sm font-medium text-white mb-2">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 glass-strong border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                  }}
                  className="flex-1 px-4 py-3 glass border border-white/30 rounded-xl text-white font-medium hover:glass-strong transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-modern"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Phone Number Modal */}
      {showChangePhoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-8 max-w-md w-full border border-white/30 shadow-modern-xl">
            <h3 className="text-2xl font-bold text-white mb-2">Update Phone Number</h3>
            <p className="text-gray-300 mb-6">
              We'll send a secure link to <span className="font-medium text-white">{email}</span> where you can update your phone number.
            </p>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowChangePhoneModal(false)}
                className="flex-1 px-4 py-3 glass border border-white/30 rounded-xl text-white font-medium hover:glass-strong transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangePhoneRequest}
                disabled={changePhoneLoading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-modern"
              >
                {changePhoneLoading ? 'Sending...' : 'Send Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
