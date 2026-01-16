import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayIcon } from '@heroicons/react/24/solid';
import { TalentProfile } from '../types';

interface TalentBannerCardProps {
  talent: TalentProfile & { 
    users?: { full_name: string; avatar_url?: string };
    recent_video_url?: string;
    recent_review?: { rating: number; comment: string };
  };
  videoOnRight: boolean;
  topCategories?: string[];
  discountCode?: string;
  discountAmount?: number;
  expiryTime?: number;
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

export default function TalentBannerCard({ 
  talent, 
  videoOnRight, 
  topCategories = [],
  discountCode,
  discountAmount,
  expiryTime
}: TalentBannerCardProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);

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
  const discountedPrice = discountAmount ? originalPrice * (1 - discountAmount / 100) : originalPrice;
  const hasDiscount = discountCode && discountAmount && expiryTime && expiryTime > Date.now();

  // Adaptive font size based on name length
  const getAdaptiveFontSize = () => {
    const length = talentName?.length || 0;
    if (length <= 15) return 'text-2xl sm:text-3xl lg:text-4xl'; // Default size
    if (length <= 25) return 'text-xl sm:text-2xl lg:text-3xl'; // Medium text
    if (length <= 35) return 'text-lg sm:text-xl lg:text-2xl'; // Long text
    return 'text-base sm:text-lg lg:text-xl'; // Very long text
  };

  // Truncate review to 2 lines (VERY aggressive for mobile)
  const getTruncatedReview = (comment: string) => {
    const maxLength = 90; // Very short for mobile - fits 2 lines max
    if (comment.length <= maxLength) return comment;
    // Find last space before maxLength to avoid cutting mid-word
    const truncated = comment.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > 70 ? lastSpace : maxLength;
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

  // Video section component
  const VideoSection = () => (
    <div className="w-1/3 h-full flex-shrink-0 relative">
      {talent.recent_video_url && !isPlaying ? (
        <div 
          className="relative w-full h-full cursor-pointer group"
          onClick={handleVideoClick}
        >
          {/* Background preview video (autoplay, muted, loop) */}
          <video 
            key={`preview-${talent.id}-${talent.recent_video_url}`}
            src={talent.recent_video_url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
          {/* Dark overlay with play button */}
          <div className="absolute inset-0 bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/90 rounded-full flex items-center justify-center scale-110 transition-transform shadow-lg">
              <PlayIcon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-900 ml-1" />
            </div>
          </div>
          {/* Recent ShoutOut Badge */}
          <div className="absolute top-3 left-3 px-3 py-1 bg-purple-600/90 backdrop-blur-sm text-white text-xs font-bold rounded-full shadow-lg">
            Recent ShoutOut
          </div>
        </div>
      ) : talent.recent_video_url && isPlaying ? (
        <div className="relative w-full h-full">
          {/* Full video with sound and controls */}
          <video 
            src={talent.recent_video_url}
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
      // VIDEO ON LEFT = Button on FAR RIGHT
      return (
        <div className="flex-1 h-full flex flex-col justify-between p-4 sm:p-5 lg:p-6">
          {/* TOP SECTION */}
          <div className="flex flex-col items-start gap-3">
            {/* Talent Name + Categories on same line (name left, categories right) */}
            <div className="flex flex-wrap items-center gap-4 w-full">
              <div className="flex flex-col">
                {talent.display_title && (
                  <span className="text-xs uppercase text-white/50 mb-1 tracking-wide">
                    {talent.display_title}
                  </span>
                )}
                <h2 className={`${getAdaptiveFontSize()} font-bold text-white`}>
                  {talentName}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredCategories.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1 rounded-full glass-strong text-white text-xs sm:text-sm font-medium"
                  >
                    {CATEGORY_LABELS[category] || category}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Text */}
            {talent.recent_review && talent.recent_review.comment && (
              <p className="text-white/70 text-sm sm:text-base italic pt-2 pb-0">
                "{getTruncatedReview(talent.recent_review.comment)}"
              </p>
            )}

            {/* Stars */}
            {talent.recent_review && (
              <div className="flex items-center gap-0.5 pt-1">
                {[...Array(5)].map((_, i) => (
                  <svg 
                    key={i} 
                    className="w-5 h-5 sm:w-6 sm:h-6" 
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
                <span className="text-white/60 text-sm">⚡ {talent.fulfillment_time_hours || 72}h Delivery</span>
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
      // VIDEO ON RIGHT = Button on FAR LEFT
      return (
        <div className="flex-1 h-full flex flex-col justify-between p-4 sm:p-5 lg:p-6">
          {/* TOP SECTION */}
          <div className="flex flex-col items-start gap-3">
            {/* Talent Name + Categories on same line (name left, categories right) */}
            <div className="flex flex-wrap items-center gap-4 w-full">
              <div className="flex flex-col">
                {talent.display_title && (
                  <span className="text-xs uppercase text-white/50 mb-1 tracking-wide">
                    {talent.display_title}
                  </span>
                )}
                <h2 className={`${getAdaptiveFontSize()} font-bold text-white`}>
                  {talentName}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredCategories.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1 rounded-full glass-strong text-white text-xs sm:text-sm font-medium"
                  >
                    {CATEGORY_LABELS[category] || category}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Text */}
            {talent.recent_review && talent.recent_review.comment && (
              <p className="text-white/70 text-sm sm:text-base italic pt-2 pb-0">
                "{getTruncatedReview(talent.recent_review.comment)}"
              </p>
            )}

            {/* Stars */}
            {talent.recent_review && (
              <div className="flex items-center gap-0.5 pt-1">
                {[...Array(5)].map((_, i) => (
                  <svg 
                    key={i} 
                    className="w-5 h-5 sm:w-6 sm:h-6" 
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
                <span className="text-white/60 text-sm">⚡ {talent.fulfillment_time_hours || 72}h Delivery</span>
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
      <div className="md:flex rounded-3xl overflow-hidden relative min-h-[280px] md:h-[320px]">
        {/* Main Content Container */}
        <div className={`h-full flex relative z-10 ${videoOnRight ? 'flex-row-reverse' : 'flex-row'}`}>
          <VideoSection />
          <ContentSection />
        </div>
      </div>
    </div>
  );
}
