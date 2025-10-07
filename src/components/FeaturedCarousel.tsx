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
    <div className="relative bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl overflow-hidden">
      <div className="relative h-64 md:h-80">
        {/* Background Image */}
        <div className="absolute inset-0 bg-black bg-opacity-40" />
        
        {/* Content */}
        <div className="relative h-full flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Text Content */}
              <div className="text-white">
                <div className="inline-block px-3 py-1 bg-yellow-400 text-yellow-900 text-sm font-semibold rounded-full mb-4">
                  ⭐ Featured Talent
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  {currentTalent.users.full_name}
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
                  {currentTalent.charity_percentage && (
                    <div className="text-sm opacity-75">
                      {currentTalent.charity_percentage}% to charity ❤️
                    </div>
                  )}
                </div>
                <Link
                  to={`/talent/${currentTalent.id}`}
                  className="inline-block bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Order ShoutOut
                </Link>
              </div>

              {/* Avatar */}
              <div className="flex justify-center md:justify-end">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  {currentTalent.users.avatar_url ? (
                    <img
                      src={currentTalent.users.avatar_url}
                      alt={currentTalent.users.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white flex items-center justify-center">
                      <span className="text-4xl font-bold text-primary-600">
                        {currentTalent.users.full_name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        {talent.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator */}
      {talent.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {talent.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
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
