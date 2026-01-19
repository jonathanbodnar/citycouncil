import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, HeartIcon, CheckBadgeIcon } from '@heroicons/react/24/solid';
import { TalentProfile } from '../types';
import { ImageSizes } from '../utils/imageOptimization';

// Hardcoded coupon configurations (fallback if not in database)
const COUPON_DISCOUNTS: Record<string, { type: 'percentage' | 'fixed'; value: number; label: string }> = {
  'WINNER100': { type: 'fixed', value: 100, label: 'FREE' },
  'SANTA25': { type: 'percentage', value: 25, label: '25% OFF' },
  'SAVE15': { type: 'percentage', value: 15, label: '15% OFF' },
  'SAVE10': { type: 'percentage', value: 10, label: '10% OFF' },
  'TAKE25': { type: 'fixed', value: 25, label: '$25 OFF' },
};

// Get coupon details from localStorage (set by HomePage when coupon is in URL)
const getCouponFromStorage = (): { type: 'percentage' | 'fixed'; value: number; label: string } | null => {
  const couponCode = localStorage.getItem('auto_apply_coupon') || localStorage.getItem('auto_coupon');
  if (!couponCode) return null;
  
  // First check hardcoded coupons
  const hardcoded = COUPON_DISCOUNTS[couponCode.toUpperCase()];
  if (hardcoded) return hardcoded;
  
  // Then check localStorage for database-fetched coupon details
  try {
    const details = localStorage.getItem('coupon_details');
    if (details) {
      const parsed = JSON.parse(details);
      if (parsed.code === couponCode.toUpperCase()) {
        return { type: parsed.type, value: parsed.value, label: parsed.label };
      }
    }
  } catch (e) {
    console.warn('Error parsing coupon details:', e);
  }
  
  return null;
};

interface TalentCardProps {
  talent: TalentProfile & {
    users: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  };
  compact?: boolean; // Netflix-style compact mode (2/3 size)
}

const TalentCard: React.FC<TalentCardProps> = ({ talent, compact = false }) => {
  const isComingSoon = talent.is_coming_soon === true;
  const demandLevel = talent.total_orders > 20 ? 'high' : talent.total_orders > 10 ? 'medium' : 'low';
  const [activeCoupon, setActiveCoupon] = useState<string | null>(null);
  const [couponDetails, setCouponDetails] = useState<{ type: 'percentage' | 'fixed'; value: number; label: string } | null>(null);

  // Check for coupon from localStorage (supports both hardcoded and database coupons)
  const checkCoupon = useCallback(() => {
    const coupon = localStorage.getItem('auto_apply_coupon') || localStorage.getItem('auto_coupon');
    const details = getCouponFromStorage();
    if (coupon && details) {
      setActiveCoupon(coupon.toUpperCase());
      setCouponDetails(details);
    } else {
      setActiveCoupon(null);
      setCouponDetails(null);
    }
  }, []);

  useEffect(() => {
    checkCoupon();
    
    // Listen for coupon changes
    window.addEventListener('storage', checkCoupon);
    window.addEventListener('couponApplied', checkCoupon);
    
    return () => {
      window.removeEventListener('storage', checkCoupon);
      window.removeEventListener('couponApplied', checkCoupon);
    };
  }, [checkCoupon]);

  // Calculate discounted price
  const originalPrice = talent.pricing || 0;
  const getDiscountedPrice = () => {
    if (!activeCoupon || !couponDetails) return originalPrice;
    if (couponDetails.type === 'percentage') {
      return Math.round(originalPrice * (1 - couponDetails.value / 100));
    } else {
      return Math.max(0, originalPrice - couponDetails.value);
    }
  };
  const discountedPrice = getDiscountedPrice();
  const hasCoupon = activeCoupon && couponDetails && discountedPrice !== originalPrice;
  
  const demandColors = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-green-500/30 text-white',
  };

  const demandText = {
    high: 'High Demand',
    medium: 'Popular',
    low: 'Available',
  };

  const cardContent = (
    <div 
      className={`${compact ? 'rounded-xl' : 'rounded-2xl sm:rounded-3xl'} transition-all duration-300 overflow-hidden group h-full flex flex-col shadow-modern-xl ${
        isComingSoon 
          ? 'opacity-90 cursor-default bg-white/5 border border-white/10' 
          : 'cursor-pointer'
      }`}
      style={{
        // Solid dark blue/purple background (not gradient)
        background: isComingSoon ? undefined : 'rgb(30, 27, 75)',
        border: isComingSoon ? undefined : '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Avatar */}
      <div className="aspect-square bg-gradient-to-br from-blue-50 to-red-50 relative overflow-hidden">
        {(talent.temp_avatar_url || talent.users.avatar_url) ? (
          <img
            src={ImageSizes.thumbnail((talent.temp_avatar_url || talent.users.avatar_url)!)}
            alt={talent.temp_full_name || talent.users.full_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="eager"
            decoding="async"
            width={300}
            height={300}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-red-100">
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
              {(talent.temp_full_name || talent.users.full_name).charAt(0)}
            </span>
          </div>
        )}
        
        {/* Coming Soon Badge */}
        {isComingSoon ? (
          <div className={`absolute ${compact ? 'top-1.5 left-1.5 px-2 py-0.5' : 'top-1.5 left-1.5 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-3 sm:py-1'} rounded-full text-[10px] ${compact ? '' : 'sm:text-xs'} font-bold glass-strong bg-amber-500/30 text-amber-400 border border-amber-400/50 shadow-lg animate-pulse`}>
            COMING SOON
          </div>
        ) : (
          /* Demand Indicator */
          <div className={`absolute ${compact ? 'top-1.5 left-1.5 px-2 py-0.5' : 'top-1.5 left-1.5 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-3 sm:py-1'} rounded-full text-[10px] ${compact ? '' : 'sm:text-xs'} font-medium glass-strong ${demandColors[demandLevel]} border border-white/30`}>
            {demandText[demandLevel]}
          </div>
        )}

        {/* Charity Indicator */}
        {(talent.charity_percentage && talent.charity_percentage > 0) ? (
          <div className={`absolute ${compact ? 'top-1.5 right-1.5 p-1.5' : 'top-1.5 right-1.5 sm:top-3 sm:right-3 p-1.5 sm:p-2'} glass-strong rounded-full glow-red animate-glow-pulse`}>
            <HeartIcon className={`${compact ? 'h-3 w-3' : 'h-3 w-3 sm:h-4 sm:w-4'} text-red-600`} />
          </div>
        ) : null}

        {/* Rating Badge - Over image, bottom left */}
        {talent.average_rating && talent.average_rating > 0 ? (
          <div className={`absolute ${compact ? 'bottom-1.5 left-1.5 px-1.5 py-0.5' : 'bottom-2 left-2 sm:bottom-3 sm:left-3 px-2 py-1'} glass-strong rounded-lg flex items-center gap-1 backdrop-blur-md bg-black/40`}>
            <StarIcon className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3 sm:h-3.5 sm:w-3.5'} text-purple-500`} />
            <span className={`${compact ? 'text-[10px]' : 'text-xs sm:text-sm'} font-bold text-white`}>
              {talent.average_rating.toFixed(1)}
            </span>
          </div>
        ) : (
          <div className={`absolute ${compact ? 'bottom-1.5 left-1.5 px-1.5 py-0.5' : 'bottom-2 left-2 sm:bottom-3 sm:left-3 px-1.5 py-0.5'} glass-strong rounded-lg backdrop-blur-md bg-purple-500/30`}>
            <span className={`${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'} font-medium text-purple-200`}>
              New
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${compact ? 'p-2.5' : 'p-3 sm:p-6'} flex flex-col flex-grow`}>
        <h3 className={`${compact ? 'text-xs' : 'text-sm sm:text-lg'} font-bold text-white ${compact ? 'mb-1' : 'mb-2 sm:mb-3'} group-hover:text-blue-400 transition-colors duration-200 flex items-center gap-1`}>
          <span className="truncate">{talent.temp_full_name || talent.users.full_name}</span>
          {talent.is_verified && (
            <CheckBadgeIcon className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} text-blue-500 flex-shrink-0`} title="Verified Talent" />
          )}
        </h3>
        
        {/* One-line Bio - Always show, even in compact mode */}
        {talent.bio && (
          <p 
            className={`${compact ? 'text-[9px] mb-1.5' : 'text-xs sm:text-sm mb-2'} text-gray-400 truncate`}
          >
            {talent.bio}
          </p>
        )}
        
        {/* Rating - Hidden on mobile and in compact mode (now shown over image) */}
        {!compact && (
          <div className="hidden sm:flex items-center mb-2">
            {talent.average_rating && talent.average_rating > 0 ? (
              <>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(talent.average_rating || 0)
                          ? 'text-purple-500'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="ml-2 text-sm text-gray-400">
                  {talent.average_rating.toFixed(1)}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </div>
        )}

        {/* Bio Preview - Only show on desktop, non-compact (2 lines) */}
        {!compact && (
          <p 
            className="hidden sm:block text-sm text-gray-300 mb-3 overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {talent.bio}
          </p>
        )}

        {/* Delivery time and Charity - Push to bottom */}
        <div className={`flex items-center justify-between mt-auto ${compact ? 'text-[9px]' : ''}`}>
          <span 
            className={compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'}
            style={{ color: 'rgba(147, 197, 253, 0.6)' }}
          >
            {talent.fulfillment_time_hours && talent.fulfillment_time_hours > 0 ? talent.fulfillment_time_hours : 48}h delivery
          </span>
          {(talent.charity_percentage && talent.charity_percentage > 0 && talent.charity_name) ? (
            <div className={`flex items-center gap-0.5 ${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'} text-red-400 font-medium`}>
              <HeartIcon className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5 sm:h-3 sm:w-3'} />
              {talent.charity_percentage}%
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // If coming soon, return non-clickable card
  if (isComingSoon) {
    return cardContent;
  }

  // Otherwise, wrap in Link
  return (
    <Link to={talent.username ? `/${talent.username}` : `/talent/${talent.id}`}>
      {cardContent}
    </Link>
  );
};

export default TalentCard;
