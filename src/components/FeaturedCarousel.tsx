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

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="relative h-64 md:h-80">
        {/* Desktop Background Image */}
        {currentTalent.users.avatar_url && (
          <div className="hidden md:block absolute inset-0">
            <img
              src={currentTalent.users.avatar_url}
              alt={currentTalent.users.full_name}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay from left (blue) to transparent */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-600/80 to-transparent"></div>
          </div>
        )}
        
        {/* Mobile Background */}
        <div className="md:hidden absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-800"></div>
        
        {/* Content */}
        <div className="relative h-full flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-0 items-center h-full py-6 md:py-0">
              {/* Text Content */}
              <div className="text-white text-center md:text-left md:pr-8 z-10">
                <div className="inline-block px-3 py-1 bg-yellow-400 text-yellow-900 text-sm font-semibold rounded-full mb-4">
                  ⭐ Featured Talent
                </div>
                <h2 className="text-2xl md:text-4xl font-bold mb-4">
                  {currentTalent.users.full_name}
                </h2>
                <p className="text-base md:text-lg opacity-90 mb-6 line-clamp-2 md:line-clamp-3">
                  {currentTalent.bio}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start space-y-2 sm:space-y-0 sm:space-x-6 mb-6">
                  <div className="text-xl md:text-2xl font-bold">
                    ${currentTalent.pricing}
                  </div>
                  <div className="text-sm opacity-75">
                    Delivers in {currentTalent.fulfillment_time_hours}h
                  </div>
                  {currentTalent.charity_percentage && (
                    <div className="text-sm opacity-75">
                      {currentTalent.charity_percentage}% to charity ❤️
                    </div>
                  )}
                </div>
                <Link
                  to={`/talent/${currentTalent.id}`}
                  className="inline-block bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
                >
                  Order ShoutOut
                </Link>
              </div>

              {/* Mobile Avatar Only */}
              <div className="md:hidden flex justify-center">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  {currentTalent.users.avatar_url ? (
                    <img
                      src={currentTalent.users.avatar_url}
                      alt={currentTalent.users.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary-600">
                        {currentTalent.users.full_name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop - Right side is handled by background image */}
              <div className="hidden md:block"></div>
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
