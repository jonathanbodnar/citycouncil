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
type Prize = 'FREE_SHOUTOUT' | '15_OFF' | '10_OFF' | '25_DOLLARS';

// Occasions for the CTA section
const POPUP_OCCASIONS = [
  { key: 'birthday', label: 'Happy Birthday', emoji: '🎂' },
  { key: 'express', label: '24hr Delivery', emoji: '⚡' },
  { key: 'roast', label: 'Friendly Roast', emoji: '🔥' },
  { key: 'encouragement', label: 'Encouragement', emoji: '💪' },
  { key: 'announcement', label: 'Make an Announcement', emoji: '📣' },
  { key: 'celebrate', label: 'Celebrate A Win', emoji: '🏆' },
  { key: 'advice', label: 'Get Advice', emoji: '💡' },
];

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
    textMessage: 'a FREE $100 personalized video ShoutOut from your favorite free-speech influencer'
  },
  '15_OFF': {
    label: '15% Off',
    code: 'SAVE15',
    shortLabel: '15% Off',
    textMessage: '15% off a personalized video ShoutOut from your favorite free-speech influencer'
  },
  '10_OFF': {
    label: '10% Off',
    code: 'SAVE10',
    shortLabel: '10% Off',
    textMessage: '10% off a personalized video ShoutOut from your favorite free-speech influencer'
  },
  '25_DOLLARS': {
    label: '$25 Off',
    code: 'TAKE25',
    shortLabel: '$25 Off',
    textMessage: '$25 off a personalized video ShoutOut from your favorite free-speech influencer'
  }
};

// Step type for the multi-step flow
type Step = 'email' | 'phone' | 'spinning' | 'winner';

// Popup delay based on traffic source
const getPopupDelay = (): number => {
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm') || urlParams.get('umt') || urlParams.get('utm_source') || '';
  const storedSource = safeGetItem('promo_source_global') || '';
  // Also check cookie as fallback
  let cookieSource = '';
  try {
    const match = document.cookie.match(/(?:^|; )promo_source=([^;]*)/);
    cookieSource = match ? decodeURIComponent(match[1]) : '';
  } catch {}
  const source = (utmSource || storedSource || cookieSource).trim().toLowerCase();
  
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

// Get UTM from cookie (backup for localStorage)
const getUtmCookie = (): string | null => {
  try {
    const match = document.cookie.match(/(?:^|; )promo_source=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

// Get UTM source from various locations
const getUtmSource = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  // Check for common typo 'umt' as well
  const urlUtm = urlParams.get('utm') || urlParams.get('umt');
  const fbUtmSource = urlParams.get('utm_source');
  const storedUtm = safeGetItem('promo_source_global');
  const storedPromoSource = safeGetItem('promo_source');
  const cookieUtm = getUtmCookie();
  
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
  
  // If URL has "winning", try to find a better stored source
  if (urlUtm === 'winning') {
    const betterSource = storedUtm || storedPromoSource || sessionUtm || sessionPromoSource || cookieUtm;
    if (betterSource && betterSource !== 'winning') return betterSource;
  }
  
  return urlUtm || normalizedFbSource || storedUtm || storedPromoSource || sessionUtm || sessionPromoSource || cookieUtm || null;
};

const HolidayPromoPopup: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 30, seconds: 0 });
  const [giveawayTimeLeft, setGiveawayTimeLeft] = useState({ minutes: 15, seconds: 0 });
  const [giveawayEndTime, setGiveawayEndTime] = useState<number | null>(null);

  // Check if popup can be shown
  const canShowPopup = useCallback(() => {
    const pathname = window.location.pathname;
    
    // Don't show on onboarding pages
    if (pathname.startsWith('/onboard') || pathname === '/start') {
      return false;
    }

    // Don't show on admin pages
    if (pathname.startsWith('/admin')) {
      return false;
    }

    // Don't show on login/signup/change-phone pages
    if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/change-phone')) {
      return false;
    }

    // Don't show on order pages (user is already converting)
    if (pathname.startsWith('/order')) {
      return false;
    }
    
    // Don't show on occasion landing pages (they have their own capture form)
    const occasionPages = ['/birthday', '/roast', '/encourage', '/advice', '/celebrate', '/announcement', '/debate', '/corporate'];
    if (occasionPages.includes(pathname)) {
      return false;
    }
    
    // Don't show popup for users who visited an occasion page (persists across navigation)
    try {
      if (localStorage.getItem('occasion_page_visited') === 'true') {
        return false;
      }
    } catch (e) {}

    // Don't show for SMS followup traffic (they already have a coupon)
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm') || urlParams.get('utm_source') || '';
    if (utmSource === 'followup' || utmSource === 'thread') {
      return false;
    }

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
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
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
      return '15_OFF';
    } else if (rand < 75) {
      return '10_OFF';
    } else {
      return '25_DOLLARS';
    }
  };

  // Handle email submission - check if user has phone on file
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    const normalizedEmail = email.toLowerCase().trim();
    
    // Store email immediately for login passthrough (even if they don't complete phone step)
    console.log('[HolidayPromoPopup] Storing giveaway_email:', normalizedEmail);
    safeSetItem('giveaway_email', normalizedEmail);
    
    try {
      // Check if user exists with phone on file
      const { data: existingUser } = await supabase
        .from('users')
        .select('phone')
        .eq('email', normalizedEmail)
        .single();
      
      if (existingUser?.phone) {
        // User has phone on file - skip to prize reveal!
        setPhoneNumber(existingUser.phone);
        await revealPrize(normalizedEmail, existingUser.phone);
      } else {
        // Capture email + utm as lead - phone will be added later
        // This ensures utm is tracked even if they don't complete giveaway
        fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: normalizedEmail,
            source: 'holiday_popup',
            utm_source: getUtmSource(),
          }),
        }).catch(err => console.log('Email capture note:', err.message));
        
        // Need phone - go to phone step
        setStep('phone');
      }
    } catch (error: any) {
      // No user found or error - go to phone step
      // Capture email + utm as lead first
      fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          source: 'holiday_popup',
          utm_source: getUtmSource(),
        }),
      }).catch(err => console.log('Email capture note:', err.message));
      
      setStep('phone');
    } finally {
      setLoading(false);
    }
  };

  // Handle phone submission and reveal prize
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
    
    await revealPrize(normalizedEmail, formattedPhone);
  };

  // Reveal prize - called after we have both email and phone
  const revealPrize = async (normalizedEmail: string, formattedPhone: string) => {
    setStep('spinning');
    
    try {
      const utmSource = getUtmSource();
      
      // Capture as a user (with both email and phone) - AWAIT this to ensure user is updated
      try {
        await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: normalizedEmail,
            phone: formattedPhone,
            source: 'holiday_popup',
            utm_source: utmSource,
          }),
        });
      } catch (err: any) {
        console.log('User capture note:', err.message);
      }

      // Determine prize
      const prize = await determinePrize();
      const prizeInfo = PRIZES[prize];

      // Simulate spinning animation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Save to beta_signups for prize tracking
      // Note: beta_signups only has phone_number column, not email
      // First check if they already have a prize from a previous giveaway entry
      const { data: existingEntries } = await supabase
        .from('beta_signups')
        .select('id, prize_won, source, phone_number, subscribed_at, created_at')
        .eq('phone_number', formattedPhone);

      const existingEntry = existingEntries?.[0];

      if (existingEntry?.prize_won) {
        // Check if existing prize is recent (within 24 hours)
        const existingDate = new Date(existingEntry.subscribed_at || existingEntry.created_at);
        const hoursSinceEntry = (Date.now() - existingDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceEntry < 24) {
          // Prize is recent - show them their existing prize
          setWonPrize(existingEntry.prize_won as Prize);
          const existingPrizeInfo = PRIZES[existingEntry.prize_won as Prize];
          safeSetItem(WINNER_PRIZE_KEY, existingEntry.prize_won);
          safeSetItem('auto_apply_coupon', existingPrizeInfo.code);
          toast.success('Welcome back! Your prize is still active! 🎉');
          setStep('winner');
          safeSetItem(POPUP_SUBMITTED_KEY, 'true');
          return;
        }
        // If prize is old (>24h), fall through to give new prize
      }

      // Use upsert to handle both insert and update cases
      const { error: upsertError } = await supabase
        .from('beta_signups')
        .upsert({
          id: existingEntry?.id, // Use existing ID if found, otherwise let DB generate
          phone_number: formattedPhone,
          source: 'holiday_popup',
          utm_source: utmSource,
          subscribed_at: existingEntry?.id ? undefined : new Date().toISOString(), // Keep original date if updating
          prize_won: prize
        }, {
          onConflict: 'phone_number', // Use phone as the conflict key
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Error saving to beta_signups:', upsertError);
        // Try insert as fallback (in case upsert fails due to no phone conflict)
        if (!existingEntry) {
          const { error: insertError } = await supabase
            .from('beta_signups')
            .insert({
              phone_number: formattedPhone,
              source: 'holiday_popup',
              utm_source: utmSource,
              subscribed_at: new Date().toISOString(),
              prize_won: prize
            });
          
          if (insertError && insertError.code !== '23505') {
            console.error('Fallback insert error:', insertError);
          }
        }
      }

      // Send winner SMS
      try {
        const winnerMessage = `🎉 You just won ${prizeInfo.textMessage}! Exp in 24hrs: https://shoutout.us?utm=winning&coupon=${prizeInfo.code}`;
        
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

      // Enroll user in SMS flows
      try {
        const now = new Date();
        const fiveSecondsLater = new Date(now.getTime() + (5 * 1000)); // 5 seconds delay
        const seventyTwoHoursLater = new Date(now.getTime() + (72 * 60 * 60 * 1000));
        
        // Enroll in giveaway_welcome flow (immediate second message)
        await supabase.from('user_sms_flow_status').upsert({
          phone: formattedPhone,
          flow_id: '11111111-1111-1111-1111-111111111111', // giveaway_welcome flow ID
          current_message_order: 0,
          next_message_scheduled_at: fiveSecondsLater.toISOString(),
          flow_started_at: now.toISOString(),
          coupon_code: prizeInfo.code,
          coupon_used: false,
          is_paused: false,
        }, { onConflict: 'phone,flow_id' });

        // Enroll in 72-hour follow-up flow (giveaway_followup)
        await supabase.from('user_sms_flow_status').upsert({
          phone: formattedPhone,
          flow_id: '22222222-2222-2222-2222-222222222222', // giveaway_followup flow ID
          current_message_order: 0,
          next_message_scheduled_at: seventyTwoHoursLater.toISOString(),
          flow_started_at: now.toISOString(),
          coupon_code: prizeInfo.code,
          coupon_used: false,
          is_paused: false,
        }, { onConflict: 'phone,flow_id' });

        console.log('User enrolled in SMS flows');
        
        // Trigger SMS flow processing immediately to send the welcome message
        try {
          await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/process-sms-flows`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            },
          });
          console.log('SMS flow processing triggered');
        } catch (triggerError) {
          console.error('Error triggering SMS flow:', triggerError);
        }
      } catch (flowError) {
        console.error('Error enrolling in SMS flows:', flowError);
        // Don't fail the main flow if this fails
      }

      // Set prize expiry (24 hours)
      const prizeExpiry = Date.now() + (24 * 60 * 60 * 1000);
      safeSetItem(WINNER_EXPIRY_KEY, prizeExpiry.toString());
      safeSetItem(WINNER_PRIZE_KEY, prize);
      safeSetItem('auto_apply_coupon', prizeInfo.code);
      safeSetItem('holiday_popup_submitted', 'true');
      
      // Store email for auto-login passthrough (when they click to order)
      console.log('[HolidayPromoPopup revealPrize] Storing giveaway_email:', normalizedEmail);
      safeSetItem('giveaway_email', normalizedEmail);
      
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
      setStep('winner');
      safeSetItem(POPUP_SUBMITTED_KEY, 'true');

    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Something went wrong. Please try again.');
      setStep('phone');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    safeSetItem(POPUP_CLOSED_KEY, Date.now().toString());
    // Dispatch events to update discount displays with a small delay to ensure localStorage is written
    setTimeout(() => {
      window.dispatchEvent(new Event('couponApplied'));
      window.dispatchEvent(new Event('giveawayCountdownUpdate'));
      window.dispatchEvent(new Event('storage'));
    }, 100);
  };

  const handleFindShoutOut = (occasionKey?: string) => {
    setIsVisible(false);
    // Don't reload page - just close popup. User is already on homepage.
    // Dispatch events to update discount displays with a small delay to ensure localStorage is written
    setTimeout(() => {
      window.dispatchEvent(new Event('couponApplied'));
      window.dispatchEvent(new Event('giveawayCountdownUpdate'));
      window.dispatchEvent(new Event('storage'));
      
      // If an occasion was selected, dispatch event to homepage
      if (occasionKey) {
        window.dispatchEvent(new CustomEvent('occasionSelectedFromPopup', { detail: occasionKey }));
      }
    }, 100);
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
                Congratulations,<br />
                you won {PRIZES[wonPrize]?.label}!
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

              {/* CTA Section with Occasion Buttons */}
              <div className="space-y-3">
                <p className="text-white font-semibold text-lg">Find the perfect ShoutOut</p>
                <div className="grid grid-cols-2 gap-2">
                  {POPUP_OCCASIONS.map((occasion) => (
                    <button
                      key={occasion.key}
                      onClick={() => handleFindShoutOut(occasion.key)}
                      className="py-3 px-3 rounded-xl font-medium text-sm transition-all transform hover:scale-105 bg-white/20 hover:bg-white/30 text-white border border-white/20"
                    >
                      <span className="mr-1">{occasion.emoji}</span>
                      {occasion.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleFindShoutOut()}
                  className="w-full py-3 rounded-xl font-medium text-sm transition-all text-white/70 hover:text-white underline"
                >
                  Browse all talent
                </button>
              </div>
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
              {/* Logo Icon */}
              <img 
                src="/whiteicon.png" 
                alt="ShoutOut" 
                className="mx-auto mb-4"
                style={{ height: '90px' }}
              />
              
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                {talentName 
                  ? `Win a free personalized video ShoutOut from ${talentName}!`
                  : 'Win a free personalized video ShoutOut from your favorite free-speech personality.'
                }
              </h2>

              {/* Prize Badges */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                  🏆 Free ShoutOut
                </span>
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  15% Off
                </span>
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  10% Off
                </span>
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  $25 Off
                </span>
              </div>

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 'email' ? 'bg-yellow-400' : 'bg-white/40'}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 'phone' ? 'bg-yellow-400' : 'bg-white/40'}`} />
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
                  
                  <p className="text-white/40 text-xs text-center mt-3">
                    No cc required. No purchase necessary.
                  </p>
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
                    {loading ? 'Revealing...' : 'Reveal My Prize 🎁'}
                  </button>
                  
                  <p className="text-white/40 text-xs text-center mt-3">
                    No cc required. No purchase necessary.
                  </p>
                </form>
              )}
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
