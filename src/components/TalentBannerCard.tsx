import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayIcon } from '@heroicons/react/24/solid';
import { TalentProfile } from '../types';

// Lazy loading video preview - only loads when in viewport (mobile performance)
const VideoPreview = memo(({ 
  videoUrl, 
  talentId 
}: { 
  videoUrl: string; 
  talentId: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Once in view, stay loaded (don't unload when scrolling away)
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.1 
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {isInView ? (
        <video 
          src={videoUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        // Placeholder while not in view
        <div className="w-full h-full bg-gray-800 animate-pulse" />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if video URL actually changes
  return prevProps.videoUrl === nextProps.videoUrl && prevProps.talentId === nextProps.talentId;
});

// Hardcoded coupon configurations (fallback if not in database)
const COUPON_DISCOUNTS: Record<string, { type: 'percentage' | 'fixed'; value: number }> = {
  'WINNER100': { type: 'fixed', value: 100 },
  'SANTA25': { type: 'percentage', value: 25 },
  'SAVE15': { type: 'percentage', value: 15 },
  'SAVE10': { type: 'percentage', value: 10 },
  'TAKE25': { type: 'fixed', value: 25 },
};

// Get coupon details from localStorage (supports database coupons)
const getCouponDetailsFromStorage = (): { code: string; type: 'percentage' | 'fixed'; value: number } | null => {
  const code = localStorage.getItem('auto_apply_coupon');
  if (!code) return null;
  
  // First check hardcoded coupons
  const hardcoded = COUPON_DISCOUNTS[code.toUpperCase()];
  if (hardcoded) return { code: code.toUpperCase(), ...hardcoded };
  
  // Then check localStorage for database-fetched coupon details
  try {
    const details = localStorage.getItem('coupon_details');
    if (details) {
      const parsed = JSON.parse(details);
      if (parsed.code === code.toUpperCase()) {
        return { code: parsed.code, type: parsed.type, value: parsed.value };
      }
    }
  } catch (e) {
    console.warn('Error parsing coupon details:', e);
  }
  
  return null;
};

interface TalentBannerCardProps {
  talent: TalentProfile & { 
    users?: { full_name: string; avatar_url?: string };
    recent_video_url?: string;
    recent_review?: { rating: number; comment: string };
  };
  videoOnRight: boolean;
  topCategories?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  'pep-talk': '💝 Surprise a Loved One',
  'birthday': '🎂 Birthday Wishes',
  'roast': '🔥 Friendly Roast',
  'advice': '💡 Get Advice',
  'corporate': '🏢 Corporate Event',
};

// Categories to hide
const HIDDEN_CATEGORIES = ['other', 'Other'];

function TalentBannerCard({ 
  talent, 
  videoOnRight, 
  topCategories = [],
}: TalentBannerCardProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Initialize discount state immediately from localStorage (no re-render)
  const getInitialDiscount = () => {
    const code = localStorage.getItem('auto_apply_coupon');
    const prizeExpiry = localStorage.getItem('giveaway_prize_expiry');
    
    // First try database/hardcoded coupon details (works for URL coupons without expiry)
    const couponDetails = getCouponDetailsFromStorage();
    if (couponDetails) {
      // If there's an expiry, check it; otherwise coupon is valid indefinitely for this session
      if (prizeExpiry) {
        const expiry = parseInt(prizeExpiry, 10);
        if (Date.now() < expiry) {
          return { code: couponDetails.code, amount: couponDetails.value, expiry, type: couponDetails.type };
        }
      } else {
        // No expiry means URL-based coupon, valid for session
        return { code: couponDetails.code, amount: couponDetails.value, expiry: null, type: couponDetails.type };
      }
    }
    
    // Fallback: try to infer amount from code name (for legacy coupons)
    if (code) {
      let amount = 0;
      if (code.includes('15')) amount = 15;
      else if (code.includes('10')) amount = 10;
      else if (code.includes('25')) amount = 25;
      else if (code.includes('20')) amount = 20;
      else if (code.includes('100')) amount = 100;
      
      if (amount > 0) {
        const expiry = prizeExpiry ? parseInt(prizeExpiry, 10) : null;
        if (!expiry || Date.now() < expiry) {
          return { code, amount, expiry, type: 'fixed' as const };
        }
      }
    }
    
    return { code: null, amount: 0, expiry: null, type: null };
  };
  
  const initial = getInitialDiscount();
  const [discountCode, setDiscountCode] = useState<string | null>(initial.code);
  const [discountAmount, setDiscountAmount] = useState<number>(initial.amount);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(initial.type);
  const [expiryTime, setExpiryTime] = useState<number | null>(initial.expiry);

  // Check for discount from localStorage
  const checkDiscount = useCallback(() => {
    const result = getInitialDiscount();
    setDiscountCode(result.code);
    setDiscountAmount(result.amount);
    setDiscountType(result.type);
    setExpiryTime(result.expiry);
  }, []);

  // Listen for discount events (only after giveaway popup)
  useEffect(() => {
    window.addEventListener('couponApplied', checkDiscount);
    window.addEventListener('giveawayCountdownUpdate', checkDiscount);
    
    return () => {
      window.removeEventListener('couponApplied', checkDiscount);
      window.removeEventListener('giveawayCountdownUpdate', checkDiscount);
    };
  }, [checkDiscount]);

  // Filter out "Other" category
  const filteredCategories = topCategories.filter(cat => !HIDDEN_CATEGORIES.includes(cat));

  // Countdown timer
  useEffect(() => {
    if (!expiryTime) return;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = expiryTime - now;

      if (diff <= 0) {
        setCountdown('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format as hh:mm:ss with leading zeros
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      const formattedSeconds = seconds.toString().padStart(2, '0');

      setCountdown(`${formattedHours}:${formattedMinutes}:${formattedSeconds}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiryTime]);

  const talentName = talent.temp_full_name || talent.users?.full_name || talent.username;
  const originalPrice = talent.pricing || 0;
  // Calculate discounted price based on discount type
  const discountedPrice = (() => {
    if (!discountAmount || !discountType) return originalPrice;
    if (discountType === 'percentage') {
      return Math.round(originalPrice * (1 - discountAmount / 100));
    } else {
      return Math.max(0, originalPrice - discountAmount);
    }
  })();
  // hasDiscount: true if we have a valid coupon (with or without expiry for URL-based coupons)
  const hasDiscount = discountCode && discountAmount && (!expiryTime || expiryTime > Date.now());

  // Adaptive font size based on name length - SMALLER overall
  const getAdaptiveFontSize = () => {
    const length = talentName?.length || 0;
    if (length <= 15) return 'text-xl sm:text-2xl lg:text-3xl'; // Default size
    if (length <= 25) return 'text-lg sm:text-xl lg:text-2xl'; // Medium text
    if (length <= 35) return 'text-base sm:text-lg lg:text-xl'; // Long text
    return 'text-sm sm:text-base lg:text-lg'; // Very long text
  };

  // Truncate review - more on desktop, less on mobile (CSS handles visual clamp)
  const getTruncatedReview = (comment: string) => {
    // Use window width to determine max length
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const maxLength = isMobile ? 90 : 160; // More characters on desktop
    if (comment.length <= maxLength) return comment;
    // Find last space before maxLength to avoid cutting mid-word
    const truncated = comment.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > (maxLength - 30) ? lastSpace : maxLength;
    return comment.substring(0, cutPoint).trim() + '...';
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const handleOrderClick = () => {
    navigate(`/order/${talent.id}`);
  };

  // Memoize the video URL so it doesn't change on re-renders
  const stableVideoUrl = useMemo(() => talent.recent_video_url, [talent.id]);
  
  // Video section - uses memoized VideoPreview component
  const videoSection = (
    <div className="w-1/3 h-full flex-shrink-0 relative">
      {stableVideoUrl && !isPlaying ? (
        <div 
          className="relative w-full h-full cursor-pointer group"
          onClick={handleVideoClick}
        >
          {/* Background preview video (autoplay, muted, loop) - MEMOIZED */}
          <VideoPreview videoUrl={stableVideoUrl} talentId={talent.id} />
          {/* Dark overlay with play button */}
          <div className="absolute inset-0 bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/90 rounded-full flex items-center justify-center scale-110 transition-transform shadow-lg">
              <PlayIcon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-900 ml-1" />
            </div>
          </div>
          {/* Recent ShoutOut Badge - smaller on mobile, more glass */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-600/60 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
            Recent ShoutOut
          </div>
          {/* Delivery Time Badge - bottom right */}
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap">
            ⚡ {talent.fulfillment_time_hours || 72}h
          </div>
        </div>
      ) : stableVideoUrl && isPlaying ? (
        <div className="relative w-full h-full">
          {/* Full video with sound and controls */}
          <video 
            src={stableVideoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <span className="text-white/30 text-sm">No video yet</span>
        </div>
      )}
    </div>
  );

  // Content section - TWO DIFFERENT LAYOUTS per wireframe
  const ContentSection = () => {
    if (!videoOnRight) {
      // VIDEO ON LEFT = Button on FAR RIGHT, Categories top right
      return (
        <div className="w-2/3 h-full flex flex-col justify-between p-3 pt-3 sm:p-4 sm:pt-3 pb-3 relative">
          {/* Desktop: Categories ABSOLUTE top right */}
          <div className="hidden md:flex flex-wrap gap-2 absolute top-3 right-4 z-10">
            {filteredCategories.slice(0, 2).map((category) => (
              <span
                key={category}
                className="px-3 py-1 rounded-full glass-strong text-white text-sm font-medium"
              >
                {CATEGORY_LABELS[category] || category}
              </span>
            ))}
          </div>
          
          {/* TOP SECTION */}
          <div className="flex flex-col gap-1 sm:gap-2">
            {/* Talent Name + Mobile Categories */}
            <div className="flex flex-wrap items-center gap-2 w-full">
              <div className="flex flex-col">
                {talent.display_title && (
                  <span className="text-[10px] sm:text-xs uppercase text-white/50 mb-0.5 tracking-wide">
                    {talent.display_title}
                  </span>
                )}
                <h2 className={`${getAdaptiveFontSize()} font-bold text-white`}>
                  {talentName}
                </h2>
              </div>
              {/* Mobile only categories */}
              <div className="flex md:hidden flex-wrap gap-1">
                {filteredCategories.slice(0, 2).map((category) => (
                  <span
                    key={category}
                    className="px-2 py-0.5 rounded-full glass-strong text-white text-[10px] font-medium"
                  >
                    {CATEGORY_LABELS[category] || category}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Text */}
            {talent.recent_review && talent.recent_review.comment && (
              <p className="text-white/70 text-sm sm:text-base italic mt-4 sm:mt-0">
                "{getTruncatedReview(talent.recent_review.comment)}"
              </p>
            )}

            {/* Stars */}
            {talent.recent_review && (
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg 
                    key={i} 
                    className="w-4 h-4 sm:w-6 sm:h-6" 
                    viewBox="0 0 20 20" 
                    fill={i < (talent.recent_review?.rating || 5) ? "#9333ea" : "#4B5563"}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
          </div>

          {/* BOTTOM SECTION - VIDEO ON LEFT = BUTTON FAR RIGHT */}
          <div className="flex items-end justify-end w-full">
            <div className="flex items-center gap-3">
              {/* Price + Delivery next to button */}
              <div className="flex items-center gap-2">
                {hasDiscount ? (
                  <>
                    <span className="text-white/50 text-base sm:text-lg line-through">${originalPrice.toFixed(0)}</span>
                    <span 
                      className="text-xl sm:text-2xl font-bold"
                      style={{
                        background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}
                    >
                      ${discountedPrice.toFixed(0)}
                    </span>
                  </>
                ) : (
                  <span className="text-white text-sm font-bold">${originalPrice.toFixed(0)}</span>
                )}
              </div>
              {/* Order button */}
              <button
                onClick={handleOrderClick}
                className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all duration-300 whitespace-nowrap backdrop-blur-xl border border-cyan-400/60"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                }}
              >
                Order Now {countdown && (
                  <span 
                    className="ml-1"
                    style={{
                      background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    {countdown}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      // VIDEO ON RIGHT = Button on FAR LEFT, Categories top right of content
      return (
        <div className="w-2/3 h-full flex flex-col justify-between p-3 pt-3 sm:p-4 sm:pt-3 pb-3 relative">
          {/* Desktop: Categories ABSOLUTE top right */}
          <div className="hidden md:flex flex-wrap gap-2 absolute top-3 right-4 z-10">
            {filteredCategories.slice(0, 2).map((category) => (
              <span
                key={category}
                className="px-3 py-1 rounded-full glass-strong text-white text-sm font-medium"
              >
                {CATEGORY_LABELS[category] || category}
              </span>
            ))}
          </div>
          
          {/* TOP SECTION */}
          <div className="flex flex-col gap-1 sm:gap-2">
            {/* Talent Name + Mobile Categories */}
            <div className="flex flex-wrap items-center gap-2 w-full">
              <div className="flex flex-col">
                {talent.display_title && (
                  <span className="text-[10px] sm:text-xs uppercase text-white/50 mb-0.5 tracking-wide">
                    {talent.display_title}
                  </span>
                )}
                <h2 className={`${getAdaptiveFontSize()} font-bold text-white`}>
                  {talentName}
                </h2>
              </div>
              {/* Mobile only categories */}
              <div className="flex md:hidden flex-wrap gap-1">
                {filteredCategories.slice(0, 2).map((category) => (
                  <span
                    key={category}
                    className="px-2 py-0.5 rounded-full glass-strong text-white text-[10px] font-medium"
                  >
                    {CATEGORY_LABELS[category] || category}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Text */}
            {talent.recent_review && talent.recent_review.comment && (
              <p className="text-white/70 text-sm sm:text-base italic mt-4 sm:mt-0">
                "{getTruncatedReview(talent.recent_review.comment)}"
              </p>
            )}

            {/* Stars */}
            {talent.recent_review && (
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg 
                    key={i} 
                    className="w-4 h-4 sm:w-6 sm:h-6" 
                    viewBox="0 0 20 20" 
                    fill={i < (talent.recent_review?.rating || 5) ? "#9333ea" : "#4B5563"}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
          </div>

          {/* BOTTOM SECTION - VIDEO ON RIGHT = BUTTON FAR LEFT */}
          <div className="flex items-end justify-start w-full">
            <div className="flex items-center gap-3">
              {/* Order button */}
              <button
                onClick={handleOrderClick}
                className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all duration-300 whitespace-nowrap backdrop-blur-xl border border-cyan-400/60"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                }}
              >
                Order Now {countdown && (
                  <span 
                    className="ml-1"
                    style={{
                      background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    {countdown}
                  </span>
                )}
              </button>
              {/* Price + Delivery next to button */}
              <div className="flex items-center gap-2">
                {hasDiscount ? (
                  <>
                    <span className="text-white/50 text-base sm:text-lg line-through">${originalPrice.toFixed(0)}</span>
                    <span 
                      className="text-xl sm:text-2xl font-bold"
                      style={{
                        background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}
                    >
                      ${discountedPrice.toFixed(0)}
                    </span>
                  </>
                ) : (
                  <span className="text-white text-sm font-bold">${originalPrice.toFixed(0)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  // Exciting purple to light blue gradient
  return (
    <div className="bg-gradient-to-r from-purple-600/30 to-cyan-400/30 rounded-3xl overflow-hidden border border-cyan-400/60 transition-all duration-300 shadow-modern-xl">
      <div className="flex rounded-3xl overflow-hidden relative h-[280px] sm:h-[300px] md:h-[320px]">
        {/* Main Content Container - ALWAYS flex row */}
        <div className={`w-full h-full flex ${videoOnRight ? 'flex-row-reverse' : 'flex-row'}`}>
          {videoSection}
          <ContentSection />
        </div>
      </div>
    </div>
  );
}

export default TalentBannerCard;
