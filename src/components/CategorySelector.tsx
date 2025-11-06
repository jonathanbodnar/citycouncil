import React, { useState } from 'react';
import { 
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { TalentCategory } from '../types';
import toast from 'react-hot-toast';

interface CategorySelectorProps {
  selectedCategories: TalentCategory[];
  onCategoryChange: (categories: TalentCategory[]) => void;
  readonly?: boolean;
  autoSave?: boolean; // If true, saves immediately on category change
  startEditing?: boolean; // If true, starts in editing mode
  stayInEditMode?: boolean; // If true, doesn't exit editing mode after save
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ 
  selectedCategories, 
  onCategoryChange,
  readonly = false,
  autoSave = false,
  startEditing = false,
  stayInEditMode = false
}) => {
  const [editing, setEditing] = useState(startEditing);
  const [tempCategories, setTempCategories] = useState<TalentCategory[]>(selectedCategories);

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

  const handleCategoryToggle = (category: TalentCategory) => {
    const newCategories = tempCategories.includes(category)
      ? tempCategories.filter(c => c !== category)
      : [...tempCategories, category];
    
    setTempCategories(newCategories);
    
    // Auto-save if enabled (for real-time preview)
    if (autoSave) {
      onCategoryChange(newCategories);
    }
  };

  const handleSave = () => {
    if (tempCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    onCategoryChange(tempCategories);
    
    // Only exit editing mode if not configured to stay in edit mode
    if (!stayInEditMode) {
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setTempCategories(selectedCategories);
    setEditing(false);
  };

  if (readonly || !editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Categories ({selectedCategories.length})
          </label>
          {!readonly && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              Edit
            </button>
          )}
        </div>
        <div className="space-y-2">
          {selectedCategories.map(category => {
            const categoryData = TALENT_CATEGORIES.find(cat => cat.value === category);
            return (
              <div key={category} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{categoryData?.label}</h4>
                    <p className="text-sm text-gray-600">{categoryData?.description}</p>
                  </div>
                  <CheckIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
            );
          })}
          {selectedCategories.length === 0 && (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-center">
              <p className="text-gray-500">No categories selected</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <label className="block text-xs sm:text-sm font-medium text-gray-700">
          {tempCategories.length} selected
        </label>
        {!autoSave && (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={tempCategories.length === 0}
              className="bg-primary-600 text-white px-2 sm:px-3 py-1 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-gray-600 hover:text-gray-700"
            >
              <XMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        )}
      </div>
      
      <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3">
        Tap to select multiple categories
      </p>
      
      <div className="grid grid-cols-1 gap-2 max-h-60 sm:max-h-80 overflow-y-auto pr-1">
        {TALENT_CATEGORIES.map((category) => {
          const isSelected = tempCategories.includes(category.value as TalentCategory);
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => handleCategoryToggle(category.value as TalentCategory)}
              className={`p-2 sm:p-3 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50/20 border-primary-400'
                  : 'border-white/20 hover:border-white/40 bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs sm:text-sm font-medium mb-0.5 ${
                    isSelected ? 'text-white' : 'text-gray-200'
                  }`}>
                    {category.label}
                  </h4>
                  <p className={`text-xs leading-tight ${
                    isSelected ? 'text-gray-300' : 'text-gray-400'
                  }`}>
                    {category.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-400 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySelector;
