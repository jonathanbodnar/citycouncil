import React from 'react';
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
      className={`glass rounded-3xl shadow-modern transition-all duration-300 overflow-hidden group ${
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
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
              {(talent.temp_full_name || talent.users.full_name).charAt(0)}
            </span>
          </div>
        )}
        
        {/* Coming Soon Badge */}
        {isComingSoon ? (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold glass-strong bg-amber-500/30 text-amber-400 border border-amber-400/50 shadow-lg animate-pulse">
            COMING SOON
          </div>
        ) : (
          /* Demand Indicator */
          <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium glass-strong ${demandColors[demandLevel]} border border-white/30`}>
            {demandText[demandLevel]}
          </div>
        )}

        {/* Charity Indicator */}
        {(talent.charity_percentage && talent.charity_percentage > 0) ? (
          <div className="absolute top-3 right-3 p-2 glass-strong rounded-full glow-red animate-glow-pulse">
            <HeartIcon className="h-4 w-4 text-red-600" />
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Position Title - Reserve space even if empty */}
        <div className="h-5 mb-2">
          {talent.position && (
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">
              {talent.position}
            </p>
          )}
        </div>
        
        <h3 className="text-lg font-bold text-white mb-3 group-hover:text-blue-400 transition-colors duration-200 flex items-center gap-2">
          <span>{talent.temp_full_name || talent.users.full_name}</span>
          {talent.is_verified && (
            <CheckBadgeIcon className="h-5 w-5 text-blue-500 flex-shrink-0" title="Verified Talent" />
          )}
        </h3>
        
        {/* Categories - Max 1 line */}
        <div className="mb-3 flex items-center gap-2">
          {talent.categories && talent.categories.length > 0 ? (
            <>
              {talent.categories.slice(0, 2).map((category) => (
                <span
                  key={category}
                  className="px-3 py-1 glass-light border border-white/20 text-white text-xs rounded-full font-medium whitespace-nowrap"
                >
                  {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              ))}
              {talent.categories.length > 2 && (
                <span className="w-7 h-7 rounded-full glass-light border border-white/20 text-white/60 text-xs font-medium flex items-center justify-center">
                  +{talent.categories.length - 2}
                </span>
              )}
            </>
          ) : (
            <span className="px-3 py-1 glass-light border border-white/20 text-white text-xs rounded-full font-medium whitespace-nowrap">
              {talent.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          )}
        </div>
        
        {/* Rating */}
        <div className="flex items-center mb-2">
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
            {talent.average_rating ? talent.average_rating.toFixed(1) : '0.0'} ({talent.fulfilled_orders || 0} reviews)
          </span>
        </div>

        {/* Bio Preview */}
        <p className="text-sm text-gray-300 mb-3 line-clamp-2">
          {talent.bio}
        </p>

        {/* Price and Charity */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-white">
              ${talent.pricing}
            </div>
            {talent.allow_corporate_pricing && talent.corporate_pricing && talent.corporate_pricing !== talent.pricing && (
              <div className="text-sm text-gray-400 font-medium">
                Corporate: ${talent.corporate_pricing}
              </div>
            )}
          </div>
          {(talent.charity_percentage && talent.charity_percentage > 0 && talent.charity_name) ? (
            <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
              <HeartIcon className="h-3 w-3" />
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
