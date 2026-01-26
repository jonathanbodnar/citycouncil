import React, { useState } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// These match the OCCASIONS on the homepage for filtering to work
const SHOUTOUT_TYPES = [
  { id: 'birthday', label: 'Happy Birthday', emoji: '🎂', description: 'Birthday wishes and celebrations' },
  { id: 'express', label: '24hr Delivery', emoji: '⚡', description: 'Rush delivery within 24 hours' },
  { id: 'roast', label: 'Friendly Roast', emoji: '🔥', description: 'Fun roasts for friends and family' },
  { id: 'encouragement', label: 'Encouragement', emoji: '💪', description: 'Motivational pep talks' },
  { id: 'debate', label: 'End a Debate', emoji: '⚔️', description: 'Settle arguments with authority' },
  { id: 'announcement', label: 'Make an Announcement', emoji: '📣', description: 'Special announcements and reveals' },
  { id: 'celebrate', label: 'Celebrate A Win', emoji: '🏆', description: 'Congratulations and celebrations' },
  { id: 'advice', label: 'Get Advice', emoji: '💡', description: 'Personal advice and guidance' },
  { id: 'corporate', label: 'Corporate Event', emoji: '🏢', description: 'Business events and team building' },
];

interface ShoutoutTypeSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelections?: number;
  theme?: 'light' | 'dark';
  readonly?: boolean;
  autoSave?: boolean;
  startEditing?: boolean;
  stayInEditMode?: boolean;
}

const ShoutoutTypeSelector: React.FC<ShoutoutTypeSelectorProps> = ({
  selected,
  onChange,
  maxSelections = 3,
  theme = 'dark',
  readonly = false,
  autoSave = false,
  startEditing = false,
  stayInEditMode = false,
}) => {
  const [editing, setEditing] = useState(startEditing);
  const [tempSelected, setTempSelected] = useState<string[]>(selected);
  const isLight = theme === 'light';

  const handleToggle = (typeId: string) => {
    let newSelected: string[];
    if (tempSelected.includes(typeId)) {
      newSelected = tempSelected.filter(id => id !== typeId);
    } else if (tempSelected.length < maxSelections) {
      newSelected = [...tempSelected, typeId];
    } else {
      return; // At max, can't add more
    }

    setTempSelected(newSelected);

    if (autoSave) {
      onChange(newSelected);
    }
  };

  const handleSave = () => {
    if (tempSelected.length === 0) {
      toast.error('Please select at least one shoutout type');
      return;
    }
    onChange(tempSelected);

    if (!stayInEditMode) {
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setTempSelected(selected);
    setEditing(false);
  };

  const isAtMax = tempSelected.length >= maxSelections;

  // Read-only view (like CategorySelector)
  if (readonly || !editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`block text-sm font-medium ${isLight ? 'text-gray-700' : 'text-white'}`}>
            Shoutout Types ({selected.length}/{maxSelections})
          </label>
          {!readonly && (
            <button
              type="button"
              onClick={() => {
                setTempSelected(selected);
                setEditing(true);
              }}
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              Edit
            </button>
          )}
        </div>
        <div className="space-y-2">
          {selected.map(typeId => {
            const typeData = SHOUTOUT_TYPES.find(t => t.id === typeId);
            if (!typeData) return null;
            return (
              <div key={typeId} className={`p-3 border rounded-lg ${isLight ? 'border-gray-200 bg-gray-50' : 'border-white/20 bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{typeData.emoji}</span>
                    <div>
                      <h4 className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>{typeData.label}</h4>
                      <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{typeData.description}</p>
                    </div>
                  </div>
                  <CheckIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
            );
          })}
          {selected.length === 0 && (
            <div className={`p-4 border rounded-lg text-center ${isLight ? 'border-gray-200 bg-gray-50' : 'border-white/20 bg-white/5'}`}>
              <p className={isLight ? 'text-gray-500' : 'text-gray-400'}>No shoutout types selected</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editing view
  return (
    <div>
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <label className={`block text-xs sm:text-sm font-medium ${isLight ? 'text-gray-700' : 'text-white'}`}>
          {tempSelected.length}/{maxSelections} selected
        </label>
        {!autoSave && (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={tempSelected.length === 0}
              className="bg-primary-600 text-white px-2 sm:px-3 py-1 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className={isLight ? 'text-gray-600 hover:text-gray-700' : 'text-gray-400 hover:text-gray-300'}
            >
              <XMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        )}
      </div>

      <p className={`text-xs sm:text-sm mb-2 sm:mb-3 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
        Select up to {maxSelections} types of shoutouts you offer
      </p>

      <div className="grid grid-cols-1 gap-2 max-h-60 sm:max-h-80 overflow-y-auto pr-1">
        {SHOUTOUT_TYPES.map((type) => {
          const isSelected = tempSelected.includes(type.id);
          const isDisabled = !isSelected && isAtMax;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => handleToggle(type.id)}
              disabled={isDisabled}
              className={`p-2 sm:p-3 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? isLight
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-primary-500 bg-primary-50/20 border-primary-400'
                  : isDisabled
                    ? isLight
                      ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                      : 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                    : isLight
                      ? 'border-gray-200 hover:border-gray-400 bg-white'
                      : 'border-white/20 hover:border-white/40 bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xl sm:text-2xl">{type.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-xs sm:text-sm font-medium ${
                      isSelected
                        ? isLight ? 'text-primary-700' : 'text-white'
                        : isLight ? 'text-gray-900' : 'text-gray-200'
                    }`}>
                      {type.label}
                    </h4>
                    <p className={`text-xs leading-tight ${
                      isSelected
                        ? isLight ? 'text-primary-600' : 'text-gray-300'
                        : isLight ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {type.description}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <CheckIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${isLight ? 'text-primary-600' : 'text-primary-400'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isAtMax && (
        <p className={`text-xs text-center mt-2 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
          Maximum {maxSelections} types selected. Deselect one to choose another.
        </p>
      )}
    </div>
  );
};

export default ShoutoutTypeSelector;
