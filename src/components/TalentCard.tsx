import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, HeartIcon, CheckBadgeIcon } from '@heroicons/react/24/solid';
import { TalentProfile } from '../types';

interface TalentCardProps {
  talent: TalentProfile & {
    users: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  };
}

const TalentCard: React.FC<TalentCardProps> = ({ talent }) => {
  const isComingSoon = talent.is_coming_soon === true;
  const demandLevel = talent.total_orders > 20 ? 'high' : talent.total_orders > 10 ? 'medium' : 'low';
  
  // Check if user has a coupon from the giveaway popup
  const [hasCoupon, setHasCoupon] = useState(false);
  
  useEffect(() => {
    const checkCoupon = () => {
      const coupon = localStorage.getItem('auto_apply_coupon');
      setHasCoupon(coupon === 'SANTA25');
    };
    
    // Check on mount
    checkCoupon();
    
    // Listen for storage changes (from popup)
    window.addEventListener('storage', checkCoupon);
    
    // Also listen for custom event (for same-tab updates)
    window.addEventListener('couponApplied', checkCoupon);
    
    return () => {
      window.removeEventListener('storage', checkCoupon);
      window.removeEventListener('couponApplied', checkCoupon);
    };
  }, []);
  
  // Calculate discounted price (25% off)
  const originalPrice = talent.pricing || 0;
  const discountedPrice = Math.round(originalPrice * 0.75);
  
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
      className={`glass rounded-2xl sm:rounded-3xl shadow-modern transition-all duration-300 overflow-hidden group h-full flex flex-col ${
        isComingSoon 
          ? 'opacity-90 cursor-default' 
          : 'hover:glass-strong hover:shadow-modern-lg hover:scale-[1.02] cursor-pointer'
      }`}
      style={{
        boxShadow: '0 0 40px rgba(59, 130, 246, 0.2), 0 0 80px rgba(239, 68, 68, 0.1)'
      }}
    >
      {/* Avatar */}
      <div className="aspect-square bg-gradient-to-br from-blue-50 to-red-50 relative overflow-hidden">
        {(talent.temp_avatar_url || talent.users.avatar_url) ? (
          <img
            src={talent.temp_avatar_url || talent.users.avatar_url}
            alt={talent.temp_full_name || talent.users.full_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold glass-strong bg-amber-500/30 text-amber-400 border border-amber-400/50 shadow-lg animate-pulse">
            COMING SOON
          </div>
        ) : (
          /* Demand Indicator */
          <div className={`absolute top-1.5 left-1.5 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium glass-strong ${demandColors[demandLevel]} border border-white/30`}>
            {demandText[demandLevel]}
          </div>
        )}

        {/* Charity Indicator */}
        {(talent.charity_percentage && talent.charity_percentage > 0) ? (
          <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 p-1.5 sm:p-2 glass-strong rounded-full glow-red animate-glow-pulse">
            <HeartIcon className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-6 flex flex-col flex-grow">
        <h3 className="text-sm sm:text-lg font-bold text-white mb-2 sm:mb-3 group-hover:text-blue-400 transition-colors duration-200 flex items-center gap-1 sm:gap-2">
          <span className="truncate">{talent.temp_full_name || talent.users.full_name}</span>
          {talent.is_verified && (
            <CheckBadgeIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" title="Verified Talent" />
          )}
        </h3>
        
        {/* Category - Single category, prefer non-"other" */}
        <div className="mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
          {(() => {
            // Get the best category to display (prefer non-"other")
            let displayCategory = talent.category;
            if (talent.categories && talent.categories.length > 0) {
              // Find first non-"other" category, or fall back to first category
              const nonOther = talent.categories.find(c => c.toLowerCase() !== 'other');
              displayCategory = nonOther || talent.categories[0];
            }
            // If still "other", try the single category field
            if (displayCategory?.toLowerCase() === 'other' && talent.category && talent.category.toLowerCase() !== 'other') {
              displayCategory = talent.category;
            }
            // Don't show category if it's still "other"
            if (!displayCategory || displayCategory.toLowerCase() === 'other') {
              return null;
            }
            return (
              <span className="px-2 py-0.5 sm:px-3 sm:py-1 glass-light border border-white/20 text-white text-[10px] sm:text-xs rounded-full font-medium whitespace-nowrap">
                {displayCategory.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            );
          })()}
        </div>
        
        {/* Rating - Hidden on mobile, shown on sm+ */}
        <div className="hidden sm:flex items-center mb-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <StarIcon
                key={i}
                className={`h-4 w-4 ${
                  i < Math.floor(talent.average_rating || 0)
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="ml-2 text-sm text-gray-400">
            {talent.average_rating ? talent.average_rating.toFixed(1) : '0.0'}
          </span>
        </div>

        {/* Bio Preview - Hidden on mobile, shown on sm+ - Fixed height to prevent stretching */}
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

        {/* Price and Charity - Push to bottom */}
        <div className="flex items-center justify-between mt-auto">
          <div>
            {hasCoupon ? (
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base text-gray-400 line-through">
                  ${originalPrice}
                </span>
                <span 
                  className="text-lg sm:text-xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(to right, #8B5CF6, #3B82F6)' }}
                >
                  ${discountedPrice}
                </span>
              </div>
            ) : (
              <div className="text-lg sm:text-xl font-semibold text-white">
                ${talent.pricing}
              </div>
            )}
            {talent.allow_corporate_pricing && talent.corporate_pricing && talent.corporate_pricing !== talent.pricing && (
              <div className="hidden sm:block text-xs text-gray-400 font-medium">
                Corporate: ${talent.corporate_pricing}
              </div>
            )}
          </div>
          {(talent.charity_percentage && talent.charity_percentage > 0 && talent.charity_name) ? (
            <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-red-400 font-medium">
              <HeartIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
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
