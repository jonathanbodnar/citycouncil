import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  // Countdown timer
  useEffect(() => {
    if (!expiryTime) return;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = expiryTime - now;

      if (diff <= 0) {
        setCountdown('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiryTime]);

  const talentName = talent.temp_full_name || talent.users?.full_name || talent.username;
  const originalPrice = talent.pricing || 0;
  const discountedPrice = discountAmount ? originalPrice * (1 - discountAmount / 100) : originalPrice;
  const hasDiscount = discountCode && discountAmount && expiryTime && expiryTime > Date.now();

  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPlaying(!isPlaying);
  };

  const handleOrderClick = (category?: string) => {
    const orderUrl = category 
      ? `/order/${talent.id}?occasion=${category}`
      : `/order/${talent.id}`;
    navigate(orderUrl);
  };

  const videoSection = talent.recent_video_url && (
    <div className="relative flex-shrink-0 w-full lg:w-1/3">
      {!isPlaying ? (
        <div 
          className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group"
          onClick={handleVideoClick}
        >
          <video 
            src={talent.recent_video_url}
            className="w-full h-full object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlayIcon className="w-8 h-8 text-gray-900 ml-1" />
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white text-sm font-medium bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
              Recent order video (click to play)
            </p>
          </div>
        </div>
      ) : (
        <div className="aspect-square rounded-2xl overflow-hidden">
          <video 
            src={talent.recent_video_url}
            className="w-full h-full object-cover"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );

  const contentSection = (
    <div className="flex-1 flex flex-col justify-center p-6 lg:p-8">
      {/* Talent Name */}
      <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3">
        {talentName}
      </h2>

      {/* Order Categories */}
      {topCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {topCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleOrderClick(category)}
              className="px-4 py-2 rounded-full glass-strong text-white text-sm font-medium hover:scale-105 transition-transform"
            >
              {category === 'pep-talk' && '💝 Surprise a loved one'}
              {category === 'birthday' && '🎂 Birthday'}
              {category === 'roast' && '🔥 Roast'}
              {category === 'advice' && '💡 Advice'}
              {category === 'corporate' && '🏢 Corporate Event'}
              {!['pep-talk', 'birthday', 'roast', 'advice', 'corporate'].includes(category) && category}
            </button>
          ))}
        </div>
      )}

      {/* Recent Review */}
      {talent.recent_review && (
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-1">
            {[...Array(5)].map((_, i) => (
              <svg 
                key={i} 
                className="w-5 h-5" 
                viewBox="0 0 20 20" 
                fill={i < talent.recent_review!.rating ? "url(#starGradient)" : "#4B5563"}
              >
                <defs>
                  <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-white/70 text-sm italic line-clamp-2">
            "{talent.recent_review.comment}"
          </p>
        </div>
      )}

      {/* Pricing and Order Button */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          {hasDiscount ? (
            <>
              <span className="text-white/50 text-lg line-through">
                ${originalPrice.toFixed(2)}
              </span>
              <span className="text-yellow-300 text-2xl font-bold">
                ${discountedPrice.toFixed(2)}
              </span>
              <span className="text-green-400 text-sm font-medium">
                Save {discountAmount}% with {discountCode}
              </span>
            </>
          ) : (
            <span className="text-white text-2xl font-bold">
              ${originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        <button
          onClick={() => handleOrderClick()}
          className="flex-1 px-6 py-3 rounded-xl font-bold text-lg transition-all transform hover:scale-105"
          style={{
            background: 'linear-gradient(to right, #a855f7, #ec4899)',
            color: 'white'
          }}
        >
          {hasDiscount && countdown ? (
            <span>Order Now ⏱️ {countdown}</span>
          ) : (
            <span>Order Now</span>
          )}
        </button>
      </div>

      {/* Delivery Time */}
      <p className="text-white/50 text-sm mt-3">
        ⚡ Usually delivers in {talent.fulfillment_time_hours || 72} hours
      </p>
    </div>
  );

  return (
    <div className="glass rounded-3xl overflow-hidden shadow-modern">
      <div className={`flex flex-col ${videoOnRight ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-0`}>
        {videoSection}
        {contentSection}
      </div>
    </div>
  );
}
