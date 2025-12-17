import React, { useState, useEffect, useCallback } from 'react';
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

// Popup delay based on traffic source
const getPopupDelay = (): number => {
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm') || urlParams.get('utm_source') || '';
  const storedSource = safeGetItem('promo_source_global') || '';
  const source = (utmSource || storedSource).trim().toLowerCase();
  
  if (source === 'sms' || source === 'giveaway' || source === 'rgiveaway') {
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

const HolidayPromoPopup: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [timeLeft, setTimeLeft] = useState({ minutes: 30, seconds: 0 });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [giveawayTimeLeft, setGiveawayTimeLeft] = useState({ minutes: 15, seconds: 0 });
  const [giveawayEndTime, setGiveawayEndTime] = useState<number | null>(null);

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
          const expiry = Date.now() + (3 * 60 * 60 * 1000); // 3 hours
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

  // Countdown timer for prize expiry
  useEffect(() => {
    if (!wonPrize) return;

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
  }, [wonPrize]);

  // Giveaway countdown timer (15 minutes from when popup opens)
  useEffect(() => {
    if (!isVisible || hasSubmitted) return;

    // Set end time when popup first becomes visible
    if (!giveawayEndTime) {
      setGiveawayEndTime(Date.now() + 15 * 60 * 1000); // 15 minutes
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
  }, [isVisible, hasSubmitted, giveawayEndTime]);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // Determine prize - weighted random selection
  const determinePrize = async (): Promise<Prize> => {
    // Check if someone already won the free shoutout today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayWinners } = await supabase
      .from('beta_signups')
      .select('id')
      .eq('source', 'holiday_popup')
      .eq('prize_won', 'FREE_SHOUTOUT')
      .gte('subscribed_at', `${today}T00:00:00Z`)
      .limit(1);

    const canWinFreeShoutout = !todayWinners || todayWinners.length === 0;

    // Weighted probabilities (out of 100)
    // FREE_SHOUTOUT: 1% (if available), 25_OFF: 20%, 15_OFF: 45%, 25_DOLLARS: 34%
    // Note: 10_OFF removed from giveaway
    const rand = Math.random() * 100;
    
    if (canWinFreeShoutout && rand < 1) {
      return 'FREE_SHOUTOUT';
    } else if (rand < 21) {
      return '25_OFF';
    } else if (rand < 66) {
      return '15_OFF';
    } else {
      return '25_DOLLARS';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSpinning(true);

    try {
      const formattedPhone = `+1${cleanDigits}`;

      // Get UTM source - check ALL possible storage locations
      const urlParams = new URLSearchParams(window.location.search);
      const urlUtm = urlParams.get('utm');
      const fbUtmSource = urlParams.get('utm_source');
      
      // Check localStorage
      const storedUtm = safeGetItem('promo_source_global');
      const storedPromoSource = safeGetItem('promo_source');
      
      // Check sessionStorage
      let sessionUtm: string | null = null;
      let sessionPromoSource: string | null = null;
      try {
        sessionUtm = sessionStorage.getItem('promo_source_global');
        sessionPromoSource = sessionStorage.getItem('promo_source');
      } catch (e) {}
      
      // Check utm_details for Facebook sources
      let utmDetailsSource: string | null = null;
      try {
        const utmDetails = localStorage.getItem('utm_details');
        if (utmDetails) {
          const parsed = JSON.parse(utmDetails);
          if (parsed.source) {
            const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
            const normalizedSource = parsed.source.toLowerCase();
            utmDetailsSource = fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : parsed.source;
          }
        }
      } catch (e) {}
      
      // Normalize Facebook utm_source if present in URL
      let normalizedFbSource: string | null = null;
      if (fbUtmSource) {
        const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
        const normalizedSource = fbUtmSource.toLowerCase();
        normalizedFbSource = fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : fbUtmSource;
      }
      
      // Priority: URL params > localStorage > sessionStorage > utm_details
      let utmSource = urlUtm || normalizedFbSource || storedUtm || storedPromoSource || sessionUtm || sessionPromoSource || utmDetailsSource || null;
      
      // Debug logging to help diagnose tracking issues
      console.log('🔍 UTM Debug:', {
        urlUtm,
        fbUtmSource,
        normalizedFbSource,
        storedUtm,
        storedPromoSource,
        sessionUtm,
        sessionPromoSource,
        utmDetailsSource,
        finalUtmSource: utmSource
      });

      // Determine prize
      const prize = await determinePrize();
      const prizeInfo = PRIZES[prize];

      // Simulate spinning animation (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Save to beta_signups with prize
      const { data, error: insertError } = await supabase
        .from('beta_signups')
        .insert({
          phone_number: formattedPhone,
          source: 'holiday_popup',
          utm_source: utmSource,
          subscribed_at: new Date().toISOString(),
          prize_won: prize
        })
        .select();

      if (insertError) {
        if (insertError.code === '23505') {
          // Already entered - check their existing prize
          const { data: existing } = await supabase
            .from('beta_signups')
            .select('prize_won')
            .eq('phone_number', formattedPhone)
            .single();
          
          if (existing?.prize_won) {
            setWonPrize(existing.prize_won as Prize);
            const existingPrizeInfo = PRIZES[existing.prize_won as Prize];
            safeSetItem(WINNER_PRIZE_KEY, existing.prize_won);
            safeSetItem('auto_apply_coupon', existingPrizeInfo.code);
            toast.success('Welcome back! Your prize is still active! 🎉');
          } else {
            toast.error('You\'ve already entered!');
          }
          setHasSubmitted(true);
          setIsSpinning(false);
          safeSetItem(POPUP_SUBMITTED_KEY, 'true');
          return;
        }
        throw insertError;
      }

      // Send winner SMS
      try {
        const winnerMessage = `You just won ${prizeInfo.textMessage} off a personalized ShoutOut from top conservatives! 🎉 Expires in 30 min, find the perfect ShoutOut here: https://shoutout.us?utm=winning&coupon=${prizeInfo.code}`;
        
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
      }
      
      if (typeof window !== 'undefined' && (window as any).ratag) {
        (window as any).ratag('conversion', { to: 3336 });
      }

      setWonPrize(prize);
      setHasSubmitted(true);
      safeSetItem(POPUP_SUBMITTED_KEY, 'true');

    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSpinning(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    safeSetItem(POPUP_CLOSED_KEY, Date.now().toString());
  };

  const handleFindShoutOut = () => {
    setIsVisible(false);
    window.location.href = '/';
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
              {/* Pre-spin State */}
              {!isSpinning ? (
                <>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    Instant Giveaway 🎁
                  </h2>
                  
                  <p className="text-white/90 text-lg mb-4">
                    Win a free personalized ShoutOut or a discount.
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
                  
                  <p className="text-white/70 text-sm mb-4">
                    No cc required
                  </p>

                  {/* Giveaway Countdown */}
                  <div className="mb-4 text-white/90 text-sm font-medium">
                    Giveaway ends in{' '}
                    <span className="font-mono font-bold text-yellow-300">
                      {String(giveawayTimeLeft.minutes).padStart(2, '0')}:{String(giveawayTimeLeft.seconds).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Phone Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        placeholder="Enter your phone number"
                        className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                        style={{
                          background: 'rgba(255, 255, 255, 0.95)',
                          color: '#1f2937'
                        }}
                        maxLength={14}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105"
                      style={{
                        background: 'linear-gradient(to right, #facc15, #f59e0b)',
                        color: '#1f2937'
                      }}
                    >
                      See If I Won 🎁
                    </button>
                  </form>
                </>
              ) : (
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
              )}
            </>
          ) : (
            /* Winner State */
            <div className="py-4">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Congratulations, you just won {PRIZES[wonPrize!]?.label}! 🎉
              </h2>
              
              {/* Prize Code */}
              <div className="mt-4 bg-white/20 backdrop-blur rounded-xl p-4 mb-4">
                <p className="text-white/70 text-sm mb-1">Your Code:</p>
                <p className="text-yellow-300 text-3xl font-mono font-bold">{PRIZES[wonPrize!]?.code}</p>
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
