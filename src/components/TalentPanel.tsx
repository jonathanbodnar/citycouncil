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
    <div 
      className="h-full overflow-y-auto pt-16"
      style={{
        background: 'linear-gradient(to bottom right, #a70809, #3c108b)'
      }}
    >

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

    </div>
  );
};

export default TalentPanel;

