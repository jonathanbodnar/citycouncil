import React, { useState, useEffect, useCallback, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const POPUP_SUBMITTED_KEY = 'holiday_promo_submitted';
const POPUP_CLOSED_KEY = 'holiday_promo_closed_at';
const POPUP_EXPIRY_KEY = 'holiday_promo_popup_expiry';
const WINNER_PRIZE_KEY = 'giveaway_prize';
const WINNER_EXPIRY_KEY = 'giveaway_prize_expiry';
const CLOSE_COOLDOWN_MINUTES = 5;

// Prize types and their probabilities
type Prize = 'FREE_SHOUTOUT' | '25_OFF' | '15_OFF' | '10_OFF' | '25_DOLLARS';

interface PrizeInfo {
  label: string;
  code: string;
  shortLabel: string;
  textMessage: string;
}

const PRIZES: Record<Prize, PrizeInfo> = {
  FREE_SHOUTOUT: {
    label: 'Free ShoutOut',
    code: 'WINNER100',
    shortLabel: 'Free ShoutOut',
    textMessage: 'a FREE personalized ShoutOut (up to $100 value)'
  },
  '25_OFF': {
    label: '25% Off',
    code: 'SANTA25',
    shortLabel: '25% Off',
    textMessage: '25% off'
  },
  '15_OFF': {
    label: '15% Off',
    code: 'SAVE15',
    shortLabel: '15% Off',
    textMessage: '15% off'
  },
  '10_OFF': {
    label: '10% Off',
    code: 'SAVE10',
    shortLabel: '10% Off',
    textMessage: '10% off'
  },
  '25_DOLLARS': {
    label: '$25 Off',
    code: 'TAKE25',
    shortLabel: '$25 Off',
    textMessage: '$25 off'
  }
};

// Step type for the multi-step flow
type Step = 'email' | 'phone' | 'otp' | 'spinning' | 'winner';

// Popup delay based on traffic source
const getPopupDelay = (): number => {
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm') || urlParams.get('utm_source') || '';
  const storedSource = safeGetItem('promo_source_global') || '';
  const source = (utmSource || storedSource).trim().toLowerCase();
  
  // 3 second delay for: SMS, giveaway, DM variations, and talent promo links
  const quickPopupSources = [
    'sms', 'giveaway', 'rgiveaway', 
    'dm', 'dmf', 'dma', 'dmb', 'dmc', 'dmd', 'dme', 'dmfn',
    'shawnlive', 'jeremylive', 'hayleylive'
  ];
  
  if (quickPopupSources.includes(source)) {
    return 3000;
  }
  
  return 15000;
};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
};

// Dispatch event to update header countdown
const dispatchCountdownUpdate = () => {
  window.dispatchEvent(new Event('giveawayCountdownUpdate'));
};

// Get UTM source from various locations
const getUtmSource = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlUtm = urlParams.get('utm');
  const fbUtmSource = urlParams.get('utm_source');
  const storedUtm = safeGetItem('promo_source_global');
  const storedPromoSource = safeGetItem('promo_source');
  
  let sessionUtm: string | null = null;
  let sessionPromoSource: string | null = null;
  try {
    sessionUtm = sessionStorage.getItem('promo_source_global');
    sessionPromoSource = sessionStorage.getItem('promo_source');
  } catch (e) {}
  
  // Normalize Facebook sources
  let normalizedFbSource: string | null = null;
  if (fbUtmSource) {
    const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
    const normalizedSource = fbUtmSource.toLowerCase();
    normalizedFbSource = fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : fbUtmSource;
  }
  
  return urlUtm || normalizedFbSource || storedUtm || storedPromoSource || sessionUtm || sessionPromoSource || null;
};

const HolidayPromoPopup: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [timeLeft, setTimeLeft] = useState({ minutes: 30, seconds: 0 });
  const [giveawayTimeLeft, setGiveawayTimeLeft] = useState({ minutes: 15, seconds: 0 });
  const [giveawayEndTime, setGiveawayEndTime] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Check if popup can be shown
  const canShowPopup = useCallback(() => {
    if (user?.user_type === 'talent' || user?.user_type === 'admin') {
      return false;
    }

    const submitted = safeGetItem(POPUP_SUBMITTED_KEY);
    if (submitted === 'true') {
      return false;
    }

    const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
    if (expiryTime) {
      const expiry = parseInt(expiryTime, 10);
      if (Date.now() > expiry) {
        return false;
      }
    }

    const closedAt = safeGetItem(POPUP_CLOSED_KEY);
    if (closedAt) {
      const closedTime = parseInt(closedAt, 10);
      const cooldownMs = CLOSE_COOLDOWN_MINUTES * 60 * 1000;
      if (Date.now() - closedTime < cooldownMs) {
        return false;
      }
    }

    return true;
  }, [user]);

  // Initial popup show
  useEffect(() => {
    const delay = getPopupDelay();
    
    const timer = setTimeout(() => {
      if (canShowPopup()) {
        setIsVisible(true);
        
        const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
        if (!expiryTime) {
          const expiry = Date.now() + (3 * 60 * 60 * 1000);
          safeSetItem(POPUP_EXPIRY_KEY, expiry.toString());
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [canShowPopup]);

  // Exit intent detection
  useEffect(() => {
    let mouseY = 0;
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseY = e.clientY;
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 || mouseY <= 100) {
        if (!isVisible && canShowPopup()) {
          setIsVisible(true);
          
          const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
          if (!expiryTime) {
            const expiry = Date.now() + (3 * 60 * 60 * 1000);
            safeSetItem(POPUP_EXPIRY_KEY, expiry.toString());
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible, canShowPopup]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Countdown timer for prize expiry
  useEffect(() => {
    if (step !== 'winner' || !wonPrize) return;

    const updateCountdown = () => {
      const expiryTime = safeGetItem(WINNER_EXPIRY_KEY);
      if (!expiryTime) return;

      const expiry = parseInt(expiryTime, 10);
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0 });
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [step, wonPrize]);

  // Giveaway countdown timer
  useEffect(() => {
    if (!isVisible || step === 'winner') return;

    if (!giveawayEndTime) {
      setGiveawayEndTime(Date.now() + 15 * 60 * 1000);
    }

    const updateGiveawayCountdown = () => {
      if (!giveawayEndTime) return;
      
      const now = Date.now();
      const diff = giveawayEndTime - now;

      if (diff <= 0) {
        setGiveawayTimeLeft({ minutes: 0, seconds: 0 });
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setGiveawayTimeLeft({ minutes, seconds });
    };

    updateGiveawayCountdown();
    const interval = setInterval(updateGiveawayCountdown, 1000);

    return () => clearInterval(interval);
  }, [isVisible, step, giveawayEndTime]);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Determine prize
  const determinePrize = async (): Promise<Prize> => {
    const now = new Date();
    const cstOffset = -6 * 60;
    const cstTime = new Date(now.getTime() + (cstOffset - now.getTimezoneOffset()) * 60000);
    const todayCST = cstTime.toISOString().split('T')[0];
    
    const cstDayStartUTC = new Date(`${todayCST}T00:00:00-06:00`).toISOString();
    const cstDayEndUTC = new Date(`${todayCST}T23:59:59-06:00`).toISOString();
    
    const { data: todayWinners } = await supabase
      .from('beta_signups')
      .select('id')
      .eq('source', 'holiday_popup')
      .eq('prize_won', 'FREE_SHOUTOUT')
      .gte('subscribed_at', cstDayStartUTC)
      .lte('subscribed_at', cstDayEndUTC)
      .limit(1);

    const canWinFreeShoutout = !todayWinners || todayWinners.length === 0;
    const rand = Math.random() * 100;
    
    if (canWinFreeShoutout && rand < 25) {
      return 'FREE_SHOUTOUT';
    } else if (rand < 50) {
      return '25_OFF';
    } else if (rand < 75) {
      return '15_OFF';
    } else {
      return '25_DOLLARS';
    }
  };

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Use edge function to check if user has phone on file
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
            checkEmailOnly: true
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.sentToExistingPhone) {
        // User has phone on file, OTP sent - skip to OTP step
        setPhoneNumber(data.phone || '');
        setPhoneHint(data.phoneHint);
        setStep('otp');
        setResendCooldown(60);
        toast.success('Code sent to your phone!');
        setTimeout(() => otpInputRef.current?.focus(), 100);
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
      
      // User needs phone - go to phone step
      setStep('phone');
      
    } catch (error: any) {
      console.log('Email check error:', error.message);
      setStep('phone');
    } finally {
      setLoading(false);
    }
  };

  // Handle phone submission
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const digits = phoneNumber.replace(/\D/g, '');
    let cleanDigits = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
      cleanDigits = digits.slice(1);
    }
    
    if (cleanDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    const formattedPhone = `+1${cleanDigits}`;
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: formattedPhone, email: normalizedEmail }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        if (data.rateLimited) {
          toast.error(data.error);
          setResendCooldown(60);
          setStep('otp');
          setPhoneHint(data.phoneHint || `***-***-${cleanDigits.slice(-4)}`);
          return;
        }
        throw new Error(data.error);
      }
      
      setPhoneHint(data.phoneHint || `***-***-${cleanDigits.slice(-4)}`);
      setStep('otp');
      setResendCooldown(60);
      toast.success('Code sent!');
      setTimeout(() => otpInputRef.current?.focus(), 100);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification and prize reveal
  const handleOtpSubmit = async (code?: string) => {
    const otpCode = code || otp;
    
    if (otpCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    setStep('spinning');
    
    try {
      // Verify OTP
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/verify-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ 
            phone: phoneNumber, 
            code: otpCode, 
            email: email.toLowerCase().trim(),
            promoSource: getUtmSource()
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        setStep('otp');
        throw new Error(data.error);
      }
      
      // OTP verified - user is now registered/logged in
      // Use magic link to log them in
      if (data.magicLink) {
        // Store the magic link to use after showing prize
        safeSetItem('pending_magic_link', data.magicLink);
      }
      
      // Determine and award prize
      const utmSource = getUtmSource();
      const prize = await determinePrize();
      const prizeInfo = PRIZES[prize];
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
      
      // Simulate spinning animation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Save to beta_signups for prize tracking
      const { error: insertError } = await supabase
        .from('beta_signups')
        .insert({
          phone_number: formattedPhone,
          email: email.toLowerCase().trim(),
          source: 'holiday_popup',
          utm_source: utmSource,
          subscribed_at: new Date().toISOString(),
          prize_won: prize
        });

      if (insertError && insertError.code === '23505') {
        // Already entered - check their existing prize
        const { data: existing } = await supabase
          .from('beta_signups')
          .select('prize_won')
          .or(`phone_number.eq.${formattedPhone},email.eq.${email.toLowerCase().trim()}`)
          .single();
        
        if (existing?.prize_won) {
          setWonPrize(existing.prize_won as Prize);
          const existingPrizeInfo = PRIZES[existing.prize_won as Prize];
          safeSetItem(WINNER_PRIZE_KEY, existing.prize_won);
          safeSetItem('auto_apply_coupon', existingPrizeInfo.code);
          toast.success('Welcome back! Your prize is still active! 🎉');
          setStep('winner');
          safeSetItem(POPUP_SUBMITTED_KEY, 'true');
          return;
        }
      }

      // Send winner SMS
      try {
        const winnerMessage = `You just won ${prizeInfo.textMessage} off a personalized ShoutOut from top conservatives! 🎉 Expires in 30 min: https://shoutout.us?utm=winning&coupon=${prizeInfo.code}`;
        
        await supabase.functions.invoke('send-sms', {
          body: {
            to: formattedPhone,
            message: winnerMessage,
            useUserNumber: true
          }
        });
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
      }

      // Set prize expiry (30 minutes)
      const prizeExpiry = Date.now() + (30 * 60 * 1000);
      safeSetItem(WINNER_EXPIRY_KEY, prizeExpiry.toString());
      safeSetItem(WINNER_PRIZE_KEY, prize);
      safeSetItem('auto_apply_coupon', prizeInfo.code);
      safeSetItem('holiday_popup_submitted', 'true');
      
      // Dispatch events
      window.dispatchEvent(new Event('couponApplied'));
      dispatchCountdownUpdate();

      // Fire tracking events
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Instant Giveaway',
          content_category: 'Phone Signup'
        });
        (window as any).fbq('track', 'CompleteRegistration', {
          content_name: 'Giveaway Registration',
          status: 'complete'
        });
      }
      
      if (typeof window !== 'undefined' && (window as any).ratag) {
        (window as any).ratag('conversion', { to: 3336 });
        (window as any).ratag('conversion', { to: 3337 });
      }

      setWonPrize(prize);
      setStep('winner');
      safeSetItem(POPUP_SUBMITTED_KEY, 'true');

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    const normalizedEmail = email.toLowerCase().trim();
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: formattedPhone, email: normalizedEmail }),
        }
      );
      
      const data = await response.json();
      
      if (data.rateLimited) {
        toast.error(data.error);
      } else if (data.success) {
        toast.success('New code sent!');
      }
      
      setResendCooldown(60);
    } catch (error) {
      toast.error('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    safeSetItem(POPUP_CLOSED_KEY, Date.now().toString());
  };

  const handleFindShoutOut = () => {
    // Check for pending magic link and use it
    const magicLink = safeGetItem('pending_magic_link');
    if (magicLink) {
      localStorage.removeItem('pending_magic_link');
      window.location.href = magicLink;
    } else {
      setIsVisible(false);
      window.location.href = '/';
    }
  };

  if (!isVisible) return null;

  // Get talent name from UTM
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = (urlParams.get('utm') || safeGetItem('promo_source_global') || '').toLowerCase();
  const talentNameMap: Record<string, string> = {
    'shawnlive': 'Shawn',
    'jeremylive': 'Jeremy',
    'hayleylive': 'Hayley'
  };
  const talentName = talentNameMap[utmSource];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Popup */}
      <div 
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-fade-in"
        style={{
          background: 'linear-gradient(135deg, #a70809 0%, #3c108b 100%)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Winner State */}
          {step === 'winner' && wonPrize ? (
            <div className="py-4">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Congratulations, you won {PRIZES[wonPrize]?.label}! 🎉
              </h2>
              
              {/* Prize Code */}
              <div className="mt-4 bg-white/20 backdrop-blur rounded-xl p-4 mb-4">
                <p className="text-white/70 text-sm mb-1">Your Code:</p>
                <p className="text-yellow-300 text-3xl font-mono font-bold">{PRIZES[wonPrize]?.code}</p>
              </div>

              {/* Countdown */}
              <div className="mb-6">
                <p className="text-white/70 text-sm mb-2">Expires in...</p>
                <div className="flex justify-center gap-3">
                  <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2">
                    <span className="text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <p className="text-xs text-white/70">Minutes</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2">
                    <span className="text-2xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <p className="text-xs text-white/70">Seconds</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleFindShoutOut}
                className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105"
                style={{
                  background: 'linear-gradient(to right, #facc15, #f59e0b)',
                  color: '#1f2937'
                }}
              >
                Find the Perfect ShoutOut 🎁
              </button>
            </div>
          ) : step === 'spinning' ? (
            /* Spinning State */
            <div className="py-12">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-yellow-400 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl animate-pulse">🎁</span>
                </div>
              </div>
              <p className="text-white text-xl font-medium animate-pulse">
                Revealing your prize...
              </p>
            </div>
          ) : (
            /* Entry Flow */
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Enter Our Instant Giveaway 🎁
              </h2>
              
              <p className="text-white/90 text-lg mb-4">
                {talentName 
                  ? `Win a free personalized video ShoutOut from ${talentName}!`
                  : 'Win a free personalized video ShoutOut or an exclusive discount.'
                }
              </p>

              {/* Prize Badges */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                  🏆 Free ShoutOut
                </span>
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  25% Off
                </span>
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  15% Off
                </span>
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  $25 Off
                </span>
              </div>

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 'email' ? 'bg-yellow-400' : 'bg-white/40'}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 'phone' ? 'bg-yellow-400' : 'bg-white/40'}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 'otp' ? 'bg-yellow-400' : 'bg-white/40'}`} />
              </div>

              {/* Giveaway Countdown */}
              <div className="mb-4 text-white/90 text-sm font-medium">
                Giveaway ends in{' '}
                <span className="font-mono font-bold text-yellow-300">
                  {String(giveawayTimeLeft.minutes).padStart(2, '0')}:{String(giveawayTimeLeft.seconds).padStart(2, '0')}
                </span>
              </div>

              {/* Step 1: Email */}
              {step === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#1f2937'
                    }}
                    required
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(to right, #facc15, #f59e0b)',
                      color: '#1f2937'
                    }}
                  >
                    {loading ? 'Checking...' : 'See what I won 🎁'}
                  </button>
                </form>
              )}

              {/* Step 2: Phone */}
              {step === 'phone' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <p className="text-white/80 text-sm mb-2">One last quick step</p>
                  
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                    placeholder="Enter your phone number"
                    autoComplete="tel"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#1f2937'
                    }}
                    maxLength={14}
                    required
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(to right, #facc15, #f59e0b)',
                      color: '#1f2937'
                    }}
                  >
                    {loading ? 'Sending...' : 'Verify 📱'}
                  </button>
                </form>
              )}

              {/* Step 3: OTP */}
              {step === 'otp' && (
                <div className="space-y-4">
                  <p className="text-white/80 text-sm mb-2">
                    Enter the code sent to {phoneHint || phoneNumber}
                  </p>
                  
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(value);
                      if (value.length === 6) {
                        handleOtpSubmit(value);
                      }
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 rounded-xl text-center text-3xl font-mono font-bold tracking-[0.3em] focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#1f2937'
                    }}
                  />

                  <button
                    onClick={() => handleOtpSubmit()}
                    disabled={loading || otp.length !== 6}
                    className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(to right, #facc15, #f59e0b)',
                      color: '#1f2937'
                    }}
                  >
                    {loading ? 'Verifying...' : 'Reveal My Prize 🎁'}
                  </button>

                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-sm text-white/70 hover:text-white disabled:text-white/40 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't receive a code? Resend"}
                  </button>
                </div>
              )}

              <p className="text-white/50 text-xs mt-4">
                No cc required
              </p>
            </>
          )}
        </div>

        {/* Decorative Bottom */}
        <div className="h-2" style={{ background: 'linear-gradient(to right, #facc15, #f59e0b)' }} />
      </div>
    </div>
  );
};

export default HolidayPromoPopup;

// Export function to check if user has active prize countdown
export const getActivePrizeCountdown = (): { prize: string; code: string; expiresAt: number } | null => {
  try {
    const prize = localStorage.getItem(WINNER_PRIZE_KEY);
    const expiry = localStorage.getItem(WINNER_EXPIRY_KEY);
    
    if (!prize || !expiry) return null;
    
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() > expiryTime) return null;
    
    const prizeInfo = PRIZES[prize as Prize];
    if (!prizeInfo) return null;
    
    return {
      prize: prizeInfo.label,
      code: prizeInfo.code,
      expiresAt: expiryTime
    };
  } catch (e) {
    return null;
  }
};
