import React, { useState } from 'react';
import { 
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { TalentCategory } from '../types';

interface CategorySelectorProps {
  selectedCategory: TalentCategory;
  onCategoryChange: (category: TalentCategory) => void;
  readonly?: boolean;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ 
  selectedCategory, 
  onCategoryChange,
  readonly = false 
}) => {
  const [editing, setEditing] = useState(false);
  const [tempCategory, setTempCategory] = useState<TalentCategory>(selectedCategory);

  const TALENT_CATEGORIES = [
    { value: 'politician', label: 'Politician', description: 'Current or former elected officials' },
    { value: 'candidate', label: 'Candidate', description: 'Running for political office' },
    { value: 'party-leader', label: 'Party Leader/Strategist', description: 'Political party leadership and strategists' },
    { value: 'reporter', label: 'Reporter/Journalist', description: 'News reporters and journalists' },
    { value: 'tv-host', label: 'TV/Radio Host', description: 'Television and radio show hosts' },
    { value: 'commentator', label: 'Commentator/Pundit', description: 'Political commentators and pundits' },
    { value: 'author', label: 'Author/Speaker', description: 'Published authors and public speakers' },
    { value: 'comedian', label: 'Comedian', description: 'Stand-up comedians and comedy performers' },
    { value: 'musician', label: 'Musician/Artist', description: 'Musicians, singers, and performing artists' },
    { value: 'actor', label: 'Actor/Filmmaker', description: 'Actors, directors, and filmmakers' },
    { value: 'influencer', label: 'Influencer/Creator', description: 'Social media influencers and content creators' },
    { value: 'activist', label: 'Activist/Organizer', description: 'Political activists and community organizers' },
    { value: 'faith-leader', label: 'Faith Leader/Pastor', description: 'Religious leaders and pastors' },
    { value: 'academic', label: 'Academic/Expert', description: 'Professors, researchers, and subject matter experts' },
    { value: 'military', label: 'Military/Veteran', description: 'Current and former military personnel' },
    { value: 'youth-leader', label: 'Youth Leader/Gen Z Voice', description: 'Young conservative voices and youth leaders' },
    { value: 'patriotic-entertainer', label: 'Patriotic Entertainer', description: 'Entertainers focused on patriotic content' },
    { value: 'other', label: 'Other Public Figure', description: 'Other notable conservative personalities' },
  ];

  const selectedCategoryData = TALENT_CATEGORIES.find(cat => cat.value === selectedCategory);

  const handleCategorySelect = (category: TalentCategory) => {
    setTempCategory(category);
    onCategoryChange(category);
    setEditing(false);
  };

  const handleCancel = () => {
    setTempCategory(selectedCategory);
    setEditing(false);
  };

  if (readonly || !editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Category
          </label>
          {!readonly && (
            <button
              onClick={() => setEditing(true)}
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              Change
            </button>
          )}
        </div>
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">{selectedCategoryData?.label}</h4>
              <p className="text-sm text-gray-600">{selectedCategoryData?.description}</p>
            </div>
            <CheckIcon className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Select Your Category
        </label>
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-700"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
        {TALENT_CATEGORIES.map((category) => (
          <button
            key={category.value}
            onClick={() => handleCategorySelect(category.value as TalentCategory)}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              tempCategory === category.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">{category.label}</h4>
                <p className="text-sm text-gray-600">{category.description}</p>
              </div>
              {tempCategory === category.value && (
                <CheckIcon className="h-5 w-5 text-primary-600 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySelector;
