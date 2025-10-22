import React from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, HeartIcon } from '@heroicons/react/24/solid';
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
  const demandLevel = talent.total_orders > 20 ? 'high' : talent.total_orders > 10 ? 'medium' : 'low';
  
  const demandColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };

  const demandText = {
    high: 'High Demand',
    medium: 'Popular',
    low: 'Available',
  };

  return (
    <Link
      to={`/talent/${talent.id}`}
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Avatar */}
      <div className="aspect-square bg-gray-100 relative">
        {(talent.temp_avatar_url || talent.users.avatar_url) ? (
          <img
            src={talent.temp_avatar_url || talent.users.avatar_url}
            alt={talent.temp_full_name || talent.users.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary-100">
            <span className="text-2xl font-bold text-primary-600">
              {(talent.temp_full_name || talent.users.full_name).charAt(0)}
            </span>
          </div>
        )}
        
        {/* Demand Indicator */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${demandColors[demandLevel]}`}>
          {demandText[demandLevel]}
        </div>

        {/* Charity Indicator */}
        {talent.charity_percentage && talent.charity_percentage > 0 && (
          <div className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm">
            <HeartIcon className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Position Title */}
        {talent.position && (
          <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
            {talent.position}
          </p>
        )}
        <h3 className="font-semibold text-gray-900 mb-1">{talent.temp_full_name || talent.users.full_name}</h3>
        
        {/* Categories */}
        <div className="mb-2">
          {talent.categories && talent.categories.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {talent.categories.slice(0, 2).map((category) => (
                <span
                  key={category}
                  className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                >
                  {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              ))}
              {talent.categories.length > 2 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{talent.categories.length - 2} more
                </span>
              )}
            </div>
          ) : (
            <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full">
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
          <span className="ml-2 text-sm text-gray-600">
            {talent.average_rating ? talent.average_rating.toFixed(1) : '0.0'} ({talent.fulfilled_orders || 0})
          </span>
        </div>

        {/* Bio Preview */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {talent.bio}
        </p>

        {/* Price and Charity */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900">
              ${talent.pricing}
            </div>
            {talent.corporate_pricing && talent.corporate_pricing !== talent.pricing && (
              <div className="text-sm text-gray-600">
                Corporate: ${talent.corporate_pricing}
              </div>
            )}
          </div>
          {talent.charity_percentage && talent.charity_percentage > 0 && (
            <div className="text-xs text-gray-500">
              {talent.charity_percentage}% to charity
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default TalentCard;
