import React from 'react';
import { Link } from 'react-router-dom';
import { TalentProfile } from '../types';
import TalentCard from './TalentCard';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface TalentPanelProps {
  talent: TalentWithUser[];
  onBack: () => void;
  onNext: () => void;
}

const TalentPanel: React.FC<TalentPanelProps> = ({ talent, onBack, onNext }) => {
  return (
    <div className="h-full bg-gradient-to-br from-gray-900 via-blue-900 to-red-900 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onBack}
            className="text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold">Browse Talent</h1>
          <button
            onClick={onNext}
            className="text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Talent Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {talent.map(t => (
            <div key={t.id} onClick={(e) => {
              // Prevent navigation on mobile - just show the card
              e.preventDefault();
            }}>
              <TalentCard talent={t} />
            </div>
          ))}
        </div>
      </div>

      {/* Swipe hint at bottom */}
      <div className="sticky bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="text-center text-white/60 text-sm">
          <div className="flex items-center justify-center gap-2">
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Swipe to navigate</span>
            <ChevronRightIcon className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TalentPanel;

