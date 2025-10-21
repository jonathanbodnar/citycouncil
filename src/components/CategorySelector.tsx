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
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ 
  selectedCategories, 
  onCategoryChange,
  readonly = false,
  autoSave = false,
  startEditing = false
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
    setEditing(false);
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
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Select Your Categories ({tempCategories.length} selected)
        </label>
        <div className="flex space-x-2">
          <button
            onClick={handleSave}
            disabled={tempCategories.length === 0}
            className="bg-primary-600 text-white px-3 py-1 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-gray-600 hover:text-gray-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Select all categories that describe your expertise. You can choose multiple categories.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
        {TALENT_CATEGORIES.map((category) => {
          const isSelected = tempCategories.includes(category.value as TalentCategory);
          return (
            <button
              key={category.value}
              onClick={() => handleCategoryToggle(category.value as TalentCategory)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">{category.label}</h4>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
                {isSelected && (
                  <CheckIcon className="h-5 w-5 text-primary-600 flex-shrink-0" />
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
