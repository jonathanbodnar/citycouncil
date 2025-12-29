import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { TalentProfile } from '../types';

// Enhanced image quality function for featured card images
const getEnhancedImageUrl = (imageUrl: string | undefined): string | undefined => {
  if (!imageUrl) return undefined;
  
  // For now, just return the original URL
  // Cloudinary upscaling can be added later if needed
  return imageUrl;
};

interface FeaturedCarouselProps {
  talent: (TalentProfile & {
    users: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  })[];
}

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ talent }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === talent.length - 1 ? 0 : prevIndex + 1
    );
    // Pause auto-scroll when user manually navigates
    setIsPaused(true);
    // Resume after 10 seconds
    setTimeout(() => setIsPaused(false), 10000);
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? talent.length - 1 : prevIndex - 1
    );
    // Pause auto-scroll when user manually navigates
    setIsPaused(true);
    // Resume after 10 seconds
    setTimeout(() => setIsPaused(false), 10000);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    // Pause auto-scroll when user manually navigates
    setIsPaused(true);
    // Resume after 10 seconds
    setTimeout(() => setIsPaused(false), 10000);
  };

  // Auto-scroll every 5 seconds
  useEffect(() => {
    // Only auto-scroll if there's more than one talent and not paused
    if (talent.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === talent.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // 5 seconds

    // Cleanup interval on component unmount or when talent/pause state changes
    return () => clearInterval(interval);
  }, [talent.length, isPaused]); // Re-create interval if talent count or pause state changes

  if (talent.length === 0) return null;

  const currentTalent = talent[currentIndex];
  
  // Safety check - if current talent doesn't have proper data, skip to next
  if (!currentTalent || !currentTalent.users) {
    return null;
  }

  // Get enhanced image URL for featured card
  const enhancedImageUrl = getEnhancedImageUrl(currentTalent.temp_avatar_url || currentTalent.users.avatar_url);

  return (
    <div 
      className="relative gradient-border rounded-3xl shadow-modern-xl z-0"
    >
      <div className="relative h-72 md:h-72 rounded-3xl overflow-hidden">
        {/* Desktop Background - Custom Gradient */}
        <div 
          className="hidden md:block absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #0b0123 0%, #905476 100%)'
          }}
        ></div>
        
        {/* Desktop Photo - Right Half with Gradient Fade */}
        {enhancedImageUrl ? (
          <div className="hidden md:block absolute right-0 top-0 w-1/2 h-full overflow-hidden">
            <img
              src={enhancedImageUrl}
              alt={currentTalent.temp_full_name || currentTalent.users.full_name}
              fetchPriority="high"
              loading="eager"
              decoding="sync"
              className="w-full h-full object-cover"
              style={{
                objectPosition: currentTalent.featured_image_position || 'center center',
                maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,1) 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,1) 100%)',
              }}
            />
          </div>
        ) : (
          /* Desktop Fallback - Show initials */
          <div className="hidden md:flex absolute right-0 top-0 w-1/2 h-full items-center justify-center">
            <span 
              className="text-9xl font-bold opacity-20"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              {(currentTalent.temp_full_name || currentTalent.users.full_name).charAt(0)}
            </span>
          </div>
        )}
        
        {/* Mobile Background with Photo or Gradient */}
        {enhancedImageUrl ? (
          <div className="md:hidden absolute inset-0 overflow-hidden">
            <img
              src={enhancedImageUrl}
              alt={currentTalent.temp_full_name || currentTalent.users.full_name}
              fetchPriority="high"
              loading="eager"
              decoding="sync"
              className="w-full h-full object-cover"
              style={{
                objectPosition: currentTalent.featured_image_position || 'center center',
              }}
            />
            {/* Custom gradient overlay for mobile */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(144, 84, 118, 0.8) 0%, rgba(11, 1, 35, 0.6) 100%)'
              }}
            ></div>
          </div>
        ) : (
          /* Mobile Fallback - Pure gradient */
          <div 
            className="md:hidden absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #0b0123 0%, #905476 100%)'
            }}
          ></div>
        )}
        
        {/* Content */}
        <div className="relative h-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full">
            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col justify-center items-center h-full py-4 space-y-2 text-center">
              {/* Mobile Content */}
              <div className="text-white">
                <div className="inline-block px-3 py-1 bg-red-600/20 text-red-400 text-xs font-bold rounded-full mb-2 border border-red-500/30">
                  ⭐ Featured
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {currentTalent.temp_full_name || currentTalent.users.full_name}
                </h2>
                <p className="text-xs opacity-90 mb-3 line-clamp-2 px-4">
                  {currentTalent.bio}
                </p>
                <div className="text-xs mb-3" style={{ color: 'rgba(147, 197, 253, 0.6)' }}>
                  {currentTalent.fulfillment_time_hours}h delivery
                </div>
                <Link
                  to={currentTalent.username ? `/${currentTalent.username}` : `/talent/${currentTalent.id}`}
                  className="inline-block px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 shadow-modern-lg hover:scale-105"
                  style={{
                    backgroundColor: '#3a86ff',
                    color: '#ffffff'
                  }}
                >
                  Order ShoutOut
                </Link>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center h-full">
              <div className="grid grid-cols-2 gap-6 items-center w-full">
                {/* Desktop Text Content */}
                <div className="text-white z-10 ml-12 pr-12">
                  <div className="inline-block px-3 py-1 bg-red-600/20 text-red-400 text-xs font-bold rounded-full mb-3 border border-red-500/30">
                    ⭐ Featured
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    {currentTalent.temp_full_name || currentTalent.users.full_name}
                  </h2>
                  <p className="text-sm opacity-90 mb-4 line-clamp-2">
                    {currentTalent.bio}
                  </p>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="text-xs" style={{ color: 'rgba(147, 197, 253, 0.6)' }}>
                      {currentTalent.fulfillment_time_hours}h delivery
                    </div>
                    {(currentTalent.charity_percentage && Number(currentTalent.charity_percentage) > 0 && currentTalent.charity_name) ? (
                      <div className="text-xs" style={{ color: 'rgba(147, 197, 253, 0.6)' }}>
                        {currentTalent.charity_percentage}% to charity ❤️
                      </div>
                    ) : null}
                  </div>
                  <Link
                    to={currentTalent.username ? `/${currentTalent.username}` : `/talent/${currentTalent.id}`}
                    className="inline-block px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 shadow-modern-lg hover:scale-105"
                    style={{
                      backgroundColor: '#3a86ff',
                      color: '#ffffff'
                    }}
                  >
                    Order ShoutOut
                  </Link>
                </div>

                {/* Desktop - Right side is the background photo */}
                <div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        {talent.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-1.5 md:p-2 rounded-full transition-all"
            >
              <ChevronLeftIcon className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-1.5 md:p-2 rounded-full transition-all"
            >
              <ChevronRightIcon className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator */}
      {talent.length > 1 && (
        <div className="absolute bottom-3 md:bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {talent.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white'
                  : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeaturedCarousel;
