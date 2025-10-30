import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { TalentProfile } from '../types';

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

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === talent.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? talent.length - 1 : prevIndex - 1
    );
  };

  if (talent.length === 0) return null;

  const currentTalent = talent[currentIndex];
  
  // Safety check - if current talent doesn't have proper data, skip to next
  if (!currentTalent || !currentTalent.users) {
    return null;
  }

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-modern-xl z-0">
      <div className="relative h-96 md:h-96">
        {/* Desktop Background - Modern Gradient */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-red-600"></div>
        
        {/* Desktop Photo - Right Half with Gradient Fade */}
        {(currentTalent.temp_avatar_url || currentTalent.users.avatar_url) ? (
          <div 
            className="hidden md:block absolute right-0 top-0 w-1/2 h-full"
            style={{
              backgroundImage: `url(${currentTalent.temp_avatar_url || currentTalent.users.avatar_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'top center',
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,1) 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,1) 100%)',
            }}
          />
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
        {(currentTalent.temp_avatar_url || currentTalent.users.avatar_url) ? (
          <div className="md:hidden absolute inset-0">
            <img
              src={currentTalent.temp_avatar_url || currentTalent.users.avatar_url}
              alt={currentTalent.temp_full_name || currentTalent.users.full_name}
              className="w-full h-full object-cover object-top"
            />
            {/* Modern gradient overlay for mobile */}
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 via-blue-600/60 to-red-600/40"></div>
          </div>
        ) : (
          /* Mobile Fallback - Pure gradient */
          <div className="md:hidden absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-red-600"></div>
        )}
        
        {/* Content */}
        <div className="relative h-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full">
            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col justify-center items-center h-full py-6 space-y-4 text-center">
              {/* Mobile Content */}
              <div className="text-white">
                <div className="inline-block px-4 py-2 bg-red-600/20 text-red-400 text-sm font-bold rounded-full mb-4 border border-red-500/30">
                  ⭐ Featured Talent
                </div>
                <h2 className="text-2xl font-bold mb-3">
                  {currentTalent.temp_full_name || currentTalent.users.full_name}
                </h2>
                <p className="text-sm opacity-90 mb-4 line-clamp-2 px-4">
                  {currentTalent.bio}
                </p>
                <div className="flex flex-col items-center space-y-1 mb-4">
                  <div className="text-xl font-bold">
                    ${currentTalent.pricing}
                  </div>
                  <div className="text-xs opacity-75">
                    Delivers in {currentTalent.fulfillment_time_hours}h
                  </div>
                  {(currentTalent.charity_percentage && Number(currentTalent.charity_percentage) > 0) ? (
                    <div className="text-xs opacity-75">
                      {currentTalent.charity_percentage}% to charity ❤️
                    </div>
                  ) : null}
                </div>
                <Link
                  to={currentTalent.username ? `/${currentTalent.username}` : `/talent/${currentTalent.id}`}
                  className="inline-block glass-strong text-white px-8 py-4 rounded-2xl font-bold hover:glass border border-white/30 transition-all duration-300 shadow-modern-lg hover:scale-105"
                >
                  Order ShoutOut
                </Link>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center h-full">
              <div className="grid grid-cols-2 gap-8 items-center w-full">
                {/* Desktop Text Content */}
                <div className="text-white z-10 ml-16 pr-16">
                  <div className="inline-block px-4 py-2 bg-red-600/20 text-red-400 text-sm font-bold rounded-full mb-4 border border-red-500/30">
                    ⭐ Featured Talent
                  </div>
                  <h2 className="text-4xl font-bold mb-4">
                    {currentTalent.temp_full_name || currentTalent.users.full_name}
                  </h2>
                  <p className="text-lg opacity-90 mb-6 line-clamp-3">
                    {currentTalent.bio}
                  </p>
                  <div className="flex items-center space-x-6 mb-6">
                    <div className="text-2xl font-bold">
                      ${currentTalent.pricing}
                    </div>
                    <div className="text-sm opacity-75">
                      Delivers in {currentTalent.fulfillment_time_hours}h
                    </div>
                    {(currentTalent.charity_percentage && Number(currentTalent.charity_percentage) > 0) ? (
                      <div className="text-sm opacity-75">
                        {currentTalent.charity_percentage}% to charity ❤️
                      </div>
                    ) : null}
                  </div>
                  <Link
                    to={currentTalent.username ? `/${currentTalent.username}` : `/talent/${currentTalent.id}`}
                    className="inline-block glass-strong text-white px-8 py-4 rounded-2xl font-bold hover:glass border border-white/30 transition-all duration-300 shadow-modern-lg hover:scale-105"
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
              onClick={() => setCurrentIndex(index)}
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
