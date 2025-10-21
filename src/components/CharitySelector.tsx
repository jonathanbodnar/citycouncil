import React, { useState, useEffect } from 'react';
import { 
  PlusIcon,
  HeartIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { Charity } from '../types';
import toast from 'react-hot-toast';

interface CharitySelectorProps {
  selectedCharityName?: string;
  charityPercentage?: number;
  onCharityChange: (charityName: string, percentage: number) => void;
  readonly?: boolean;
}

const CharitySelector: React.FC<CharitySelectorProps> = ({ 
  selectedCharityName, 
  charityPercentage = 0,
  onCharityChange,
  readonly = false 
}) => {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customCharityName, setCustomCharityName] = useState('');
  const [percentage, setPercentage] = useState(charityPercentage);

  useEffect(() => {
    fetchCharities();
  }, []);

  useEffect(() => {
    if (selectedCharityName && !charities.find(c => c.name === selectedCharityName)) {
      setShowCustom(true);
      setCustomCharityName(selectedCharityName);
    }
  }, [selectedCharityName, charities]);

  useEffect(() => {
    // Sync internal percentage state with prop
    setPercentage(charityPercentage || 0);
  }, [charityPercentage]);

  const fetchCharities = async () => {
    try {
      const { data, error } = await supabase
        .from('charities')
        .select('*')
        .eq('is_verified', true)
        .order('name');

      if (error) throw error;
      setCharities(data || []);
    } catch (error) {
      console.error('Error fetching charities:', error);
    }
  };

  const handleCharitySelect = (charityName: string) => {
    if (charityName === 'custom') {
      setShowCustom(true);
      return;
    }
    
    setShowCustom(false);
    setCustomCharityName('');
    onCharityChange(charityName, percentage);
  };

  const handlePercentageChange = (newPercentage: number) => {
    setPercentage(newPercentage);
    const charityName = showCustom ? customCharityName : selectedCharityName;
    // Always call onCharityChange, even if no charity name is set yet
    onCharityChange(charityName || '', newPercentage);
  };

  const handleCustomCharitySubmit = () => {
    if (!customCharityName.trim()) {
      toast.error('Please enter a charity name');
      return;
    }
    onCharityChange(customCharityName.trim(), percentage);
    toast.success('Custom charity added!');
  };

  return (
    <div className="space-y-4">
      {/* Charity Percentage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Charity Donation (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={percentage}
            onChange={(e) => handlePercentageChange(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="0"
            readOnly={readonly}
          />
          <p className="text-xs text-gray-500 mt-1">
            Percentage of your earnings to donate
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Charity
          </label>
          <select
            value={showCustom ? 'custom' : selectedCharityName || ''}
            onChange={(e) => handleCharitySelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={readonly || percentage === 0}
          >
            <option value="">No charity selected</option>
            {charities.map((charity) => (
              <option key={charity.id} value={charity.name}>
                {charity.name}
              </option>
            ))}
            <option value="custom">+ Add Custom Charity</option>
          </select>
        </div>
      </div>

      {/* Custom Charity Input */}
      {showCustom && !readonly && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-3">Add Custom Charity</h5>
          <div className="flex space-x-3">
            <input
              type="text"
              value={customCharityName}
              onChange={(e) => setCustomCharityName(e.target.value)}
              placeholder="Enter charity name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleCustomCharitySubmit}
              disabled={!customCharityName.trim()}
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <CheckIcon className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Custom charities need admin approval before donations can be processed
          </p>
        </div>
      )}

      {/* Charity Preview */}
      {percentage > 0 && (selectedCharityName || customCharityName) && (
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center">
            <HeartIcon className="h-5 w-5 text-red-500 mr-2" />
            <span className="font-medium text-red-900">
              {percentage}% of your earnings will go to {selectedCharityName || customCharityName}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharitySelector;
