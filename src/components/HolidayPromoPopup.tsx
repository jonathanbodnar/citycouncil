import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const POPUP_SUBMITTED_KEY = 'holiday_promo_submitted'; // Only set when phone submitted
const POPUP_CLOSED_KEY = 'holiday_promo_closed_at'; // Tracks when they last closed it
const POPUP_EXPIRY_KEY = 'holiday_promo_popup_expiry';
const COUNTDOWN_HOURS = 3;
const CLOSE_COOLDOWN_MINUTES = 5; // Show again 5 minutes after closing

// Popup delay based on traffic source (in milliseconds)
const getPopupDelay = (): number => {
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm') || urlParams.get('utm_source') || '';
  const storedSource = safeGetItem('promo_source_global') || '';
  const source = (utmSource || storedSource).trim().toLowerCase();
  
  console.log('🎁 Popup source detection:', { utmSource, storedSource, finalSource: source });
  
  // Only match exact "sms" source
  if (source === 'sms') {
    console.log('🎁 SMS source detected - 3 second delay');
    return 3000; // 3 seconds for SMS campaigns
  }
  
  console.log('🎁 Default source - 9 second delay');
  return 9000; // 9 seconds for all other sources
};

// Safe localStorage helpers for Safari private browsing (defined outside component)
const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage not available:', e);
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

const HolidayPromoPopup: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hasShownInitial, setHasShownInitial] = useState(false);

  // Check if popup can be shown (not submitted, not in cooldown, not talent/admin)
  const canShowPopup = useCallback(() => {
    console.log('🎁 canShowPopup check - user:', user?.user_type);
    
    // Never show to talent or admin users
    if (user?.user_type === 'talent' || user?.user_type === 'admin') {
      console.log('🎁 Blocked: talent/admin user');
      return false;
    }

    // Never show if already submitted
    const submitted = safeGetItem(POPUP_SUBMITTED_KEY);
    if (submitted === 'true') {
      console.log('🎁 Blocked: already submitted');
      return false;
    }

    // Check if countdown expired
    const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
    if (expiryTime) {
      const expiry = parseInt(expiryTime, 10);
      if (Date.now() > expiry) {
        console.log('🎁 Blocked: countdown expired');
        return false;
      }
    }

    // Check close cooldown (5 minutes)
    const closedAt = safeGetItem(POPUP_CLOSED_KEY);
    if (closedAt) {
      const closedTime = parseInt(closedAt, 10);
      const cooldownMs = CLOSE_COOLDOWN_MINUTES * 60 * 1000;
      if (Date.now() - closedTime < cooldownMs) {
        console.log('🎁 Blocked: in cooldown');
        return false;
      }
    }

    console.log('🎁 canShowPopup: TRUE');
    return true;
  }, [user]);

  // Initial popup show - delay based on traffic source
  useEffect(() => {
    const delay = getPopupDelay();
    console.log('🎁 Popup timer starting with delay:', delay, 'ms');
    
    const timer = setTimeout(() => {
      console.log('🎁 Popup timer fired, checking canShowPopup...');
      if (canShowPopup()) {
        console.log('🎁 Showing popup!');
        setIsVisible(true);
        setHasShownInitial(true);
        
        // Set expiry time if not already set
        const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
        if (!expiryTime) {
          const expiry = Date.now() + (COUNTDOWN_HOURS * 60 * 60 * 1000);
          safeSetItem(POPUP_EXPIRY_KEY, expiry.toString());
        }
      } else {
        console.log('🎁 canShowPopup returned false');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [canShowPopup]);

  // Exit intent detection - tracks mouse position and triggers when leaving top of viewport
  useEffect(() => {
    let mouseY = 0;
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseY = e.clientY;
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger if mouse leaves near the top (going to close tab, back button, etc.)
      if (e.clientY <= 0 || mouseY <= 100) {
        if (!isVisible && canShowPopup()) {
          console.log('🚪 Exit intent detected - mouseY:', mouseY, 'clientY:', e.clientY);
          setIsVisible(true);
          setHasShownInitial(true);
          
          // Set expiry time if not already set
          const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
          if (!expiryTime) {
            const expiry = Date.now() + (COUNTDOWN_HOURS * 60 * 60 * 1000);
            safeSetItem(POPUP_EXPIRY_KEY, expiry.toString());
          }
        }
      }
    };

    // Track mouse position
    document.addEventListener('mousemove', handleMouseMove);
    // Detect when mouse leaves the document
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible, canShowPopup]);

  // Back button / history detection for mobile
  useEffect(() => {
    const handlePopState = () => {
      if (!isVisible && canShowPopup()) {
        console.log('🚪 Back button detected - showing popup');
        setIsVisible(true);
        setHasShownInitial(true);
        
        const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
        if (!expiryTime) {
          const expiry = Date.now() + (COUNTDOWN_HOURS * 60 * 60 * 1000);
          safeSetItem(POPUP_EXPIRY_KEY, expiry.toString());
        }
      }
    };

    // Push a dummy state so we can detect back button
    window.history.pushState({ popup: true }, '');
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isVisible, canShowPopup]);

  // Countdown timer
  useEffect(() => {
    if (!isVisible) return;

    const updateCountdown = () => {
      const expiryTime = safeGetItem(POPUP_EXPIRY_KEY);
      if (!expiryTime) return;

      const expiry = parseInt(expiryTime, 10);
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setIsVisible(false);
        // Countdown expired - don't show again
        safeSetItem(POPUP_SUBMITTED_KEY, 'true');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number (should have 10 digits)
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle various formats - strip leading 1 if present
    let cleanDigits = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
      cleanDigits = digits.slice(1);
    }
    
    if (cleanDigits.length !== 10) {
      console.log('❌ Invalid phone number:', phoneNumber, '-> digits:', digits, '-> clean:', cleanDigits);
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSubmitting(true);
    console.log('📱 Holiday popup - submitting phone:', cleanDigits);

    try {
      // Format phone number for storage (+1XXXXXXXXXX)
      const formattedPhone = `+1${cleanDigits}`;
      console.log('📱 Formatted phone for storage:', formattedPhone);

      // Get UTM source for tracking
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm') || urlParams.get('utm_source') || safeGetItem('promo_source_global') || null;
      console.log('📱 UTM source:', utmSource);

      // Save to beta_signups with source "holiday_popup"
      const { data, error: insertError } = await supabase
        .from('beta_signups')
        .insert({
          phone_number: formattedPhone,
          source: 'holiday_popup',
          utm_source: utmSource,
          subscribed_at: new Date().toISOString()
        })
        .select();

      console.log('📱 Insert result:', { data, error: insertError });

      if (insertError) {
        // Check if it's a duplicate
        if (insertError.code === '23505') {
          console.log('📱 Duplicate phone number - already signed up');
          toast.success('You\'re already entered! Good luck! 🍀');
        } else {
          console.error('❌ Insert error:', insertError);
          throw insertError;
        }
      } else {
        console.log('✅ Phone number saved successfully:', data);
        
        // Send SMS via edge function
        try {
          console.log('📤 Sending welcome SMS...');
          const smsResult = await supabase.functions.invoke('send-sms', {
            body: {
              to: formattedPhone,
              message: `You're in! 🎉 You'll get a text if you win the free ShoutOut. Ready to order now? Here's a 25% off coupon (expires in 24hrs): SANTA25 https://shoutout.us?coupon=SANTA25`,
              useUserNumber: true // Send from user-facing number, not talent number
            }
          });
          console.log('📤 SMS result:', smsResult);
        } catch (smsError) {
          console.error('❌ Error sending SMS:', smsError);
          // Don't fail the whole submission if SMS fails
        }

        toast.success('You\'re entered! Good luck! 🍀');
        
        // Store coupon code in localStorage for auto-apply at checkout
        safeSetItem('auto_apply_coupon', 'SANTA25');
        
        // Dispatch custom event to update TalentCards immediately
        window.dispatchEvent(new Event('couponApplied'));
        
        // Fire Facebook Pixel Lead event
        console.log('📊 Attempting to fire Lead events...', { 
          hasFbq: typeof (window as any).fbq === 'function',
          hasRatag: typeof (window as any).ratag === 'function'
        });
        
        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', 'Lead', {
            content_name: 'Holiday Promo Popup',
            content_category: 'Phone Signup'
          });
          console.log('📊 Facebook Pixel Lead event fired');
        } else {
          console.warn('⚠️ Facebook Pixel (fbq) not found');
        }
        
        // Fire Rumble Ads Lead conversion
        if (typeof window !== 'undefined' && (window as any).ratag) {
          (window as any).ratag('conversion', { to: 3336 });
          console.log('📊 Rumble Ads Lead conversion fired (3336)');
        } else {
          console.warn('⚠️ Rumble Ads (ratag) not found');
        }
      }

      setHasSubmitted(true);
      
      // Mark as SUBMITTED - never show again
      safeSetItem(POPUP_SUBMITTED_KEY, 'true');
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Error submitting phone number:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    // Just set a cooldown - will show again on exit intent after 5 minutes
    safeSetItem(POPUP_CLOSED_KEY, Date.now().toString());
    console.log('🔕 Popup closed - will show again on exit intent after 5 minutes');
  };

  if (!isVisible) return null;

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
          {!hasSubmitted ? (
            <>
              {/* Headline */}
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                🎁 Daily Giveaway 🎁
              </h2>
              
              <p className="text-white/90 text-lg mb-2">
                Win a <span className="text-yellow-300 font-bold text-xl">FREE</span> personalized video ShoutOut!
              </p>
              
              <p className="text-white/70 text-base mb-4">
                $100 value • New winner every day
              </p>

              {/* Countdown Timer */}
              <div className="mb-6">
                <p className="text-white/70 text-sm mb-2">Next drawing in:</p>
                <div className="flex justify-center gap-3">
                  <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2">
                    <span className="text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <p className="text-xs text-white/70">Hours</p>
                  </div>
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

              {/* Phone Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">
                    Enter your phone number to enter:
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="(555) 555-5555"
                    className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#1f2937'
                    }}
                    maxLength={14}
                    required
                  />
                  <p className="text-white/60 text-xs mt-2">
                    If you win, you'll get a text here.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(to right, #facc15, #f59e0b)',
                    color: '#1f2937'
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-5 w-5 border-2 border-gray-800 border-t-transparent rounded-full"></div>
                      Entering...
                    </span>
                  ) : (
                    'Enter to Win 🎉'
                  )}
                </button>
              </form>

              <p className="text-white/50 text-xs mt-4">
                *Giveaway is a $100 credit. No purchase necessary.
              </p>
            </>
          ) : (
            /* Success State */
            <div className="py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                You're Entered!
              </h2>
              <p className="text-white/90 mb-4">
                Good luck! We'll text you if you win.
              </p>
              <div className="mt-4 bg-white/20 backdrop-blur rounded-xl p-4">
                <p className="text-white/70 text-sm mb-1">Can't wait? Get 25% off now:</p>
                <p className="text-yellow-300 text-2xl font-mono font-bold">SANTA25</p>
                <p className="text-white/60 text-xs mt-2">Code expires in 24 hours</p>
              </div>
            </div>
          )}
        </div>

        {/* Decorative Bottom */}
        <div className="h-2" style={{ background: 'linear-gradient(to right, #facc15, #f59e0b)' }} />
      </div>
    </div>
  );
};

export default HolidayPromoPopup;

