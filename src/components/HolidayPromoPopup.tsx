import React, { useState, useEffect } from 'react';
import { XMarkIcon, GiftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

const POPUP_STORAGE_KEY = 'holiday_promo_popup_shown';
const POPUP_EXPIRY_KEY = 'holiday_promo_popup_expiry';
const COUNTDOWN_HOURS = 48;

const HolidayPromoPopup: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    // Check if popup should be shown
    const checkPopupVisibility = () => {
      const popupShown = localStorage.getItem(POPUP_STORAGE_KEY);
      const expiryTime = localStorage.getItem(POPUP_EXPIRY_KEY);

      if (popupShown === 'true' && expiryTime) {
        const expiry = parseInt(expiryTime, 10);
        if (Date.now() > expiry) {
          // Countdown expired, never show again
          return;
        }
      }

      // Show popup after a short delay
      setTimeout(() => {
        setIsVisible(true);
        
        // Set expiry time if not already set
        if (!expiryTime) {
          const expiry = Date.now() + (COUNTDOWN_HOURS * 60 * 60 * 1000);
          localStorage.setItem(POPUP_EXPIRY_KEY, expiry.toString());
        }
      }, 2000);
    };

    checkPopupVisibility();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!isVisible) return;

    const updateCountdown = () => {
      const expiryTime = localStorage.getItem(POPUP_EXPIRY_KEY);
      if (!expiryTime) return;

      const expiry = parseInt(expiryTime, 10);
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setIsVisible(false);
        localStorage.setItem(POPUP_STORAGE_KEY, 'true');
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
    if (digits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSubmitting(true);

    try {
      // Format phone number for storage (+1XXXXXXXXXX)
      const formattedPhone = `+1${digits}`;

      // Save to beta_signups with source "holiday_popup"
      const { error: insertError } = await supabase
        .from('beta_signups')
        .insert({
          phone_number: formattedPhone,
          source: 'holiday_popup',
          subscribed_at: new Date().toISOString()
        });

      if (insertError) {
        // Check if it's a duplicate
        if (insertError.code === '23505') {
          toast.success('You\'re already signed up! Use code SANTA25 for 25% off.');
        } else {
          throw insertError;
        }
      } else {
        // Send SMS via edge function
        try {
          await supabase.functions.invoke('send-sms', {
            body: {
              to: formattedPhone,
              message: `Welcome to ShoutOut! 🎄 To get 25% off your first order, use code SANTA25. Offer ends in 48 hours! https://shoutout.us`
            }
          });
        } catch (smsError) {
          console.error('Error sending SMS:', smsError);
          // Don't fail the whole submission if SMS fails
        }

        toast.success('Check your phone for your discount code! 🎁');
      }

      setHasSubmitted(true);
      
      // Mark popup as shown and close after delay
      localStorage.setItem(POPUP_STORAGE_KEY, 'true');
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);

    } catch (error) {
      console.error('Error submitting phone number:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(POPUP_STORAGE_KEY, 'true');
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
          {/* Decorative Icons */}
          <div className="flex justify-center gap-4 mb-4">
            <span className="text-4xl">🎄</span>
            <GiftIcon className="h-12 w-12 text-yellow-300" />
            <span className="text-4xl">🎅</span>
          </div>

          {!hasSubmitted ? (
            <>
              {/* Headline */}
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Holiday Special! 🎁
              </h2>
              
              <p className="text-white/90 text-lg mb-4">
                Get <span className="text-yellow-300 font-bold text-xl">25% OFF</span> all ShoutOuts
              </p>

              {/* Countdown Timer */}
              <div className="mb-6">
                <p className="text-white/70 text-sm mb-2">Offer expires in:</p>
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
                    Enter your phone number to get your code:
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
                      Sending...
                    </span>
                  ) : (
                    'Get My 25% OFF Code 🎁'
                  )}
                </button>
              </form>

              <p className="text-white/60 text-xs mt-4">
                By entering your phone number, you agree to receive promotional messages.
              </p>
            </>
          ) : (
            /* Success State */
            <div className="py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                You're All Set!
              </h2>
              <p className="text-white/90">
                Check your phone for your discount code!
              </p>
              <div className="mt-6 bg-white/20 backdrop-blur rounded-xl p-4">
                <p className="text-white/70 text-sm">Your code:</p>
                <p className="text-yellow-300 text-2xl font-mono font-bold">SANTA25</p>
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

