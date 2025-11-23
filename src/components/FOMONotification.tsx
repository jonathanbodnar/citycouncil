import React, { useState, useEffect } from 'react';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

// 30 diverse American first names
const FIRST_NAMES = [
  'Michael', 'Jessica', 'Christopher', 'Ashley', 'Matthew',
  'Sarah', 'Joshua', 'Amanda', 'Daniel', 'Jennifer',
  'David', 'Emily', 'Andrew', 'Melissa', 'James',
  'Stephanie', 'Ryan', 'Nicole', 'John', 'Elizabeth',
  'Brandon', 'Lauren', 'Tyler', 'Brittany', 'Kevin',
  'Samantha', 'Justin', 'Rachel', 'Robert', 'Megan'
];

interface FOMONotificationProps {
  /** Interval in ms between notifications (default: 8000ms = 8 seconds) */
  interval?: number;
}

const FOMONotification: React.FC<FOMONotificationProps> = ({ interval = 8000 }) => {
  const [visible, setVisible] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [usedNames, setUsedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Get a random name that hasn't been used yet
    const getRandomUnusedName = (): string => {
      const availableNames = FIRST_NAMES.filter(name => !usedNames.has(name));
      
      // If all names have been used, reset
      if (availableNames.length === 0) {
        setUsedNames(new Set());
        return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      }
      
      return availableNames[Math.floor(Math.random() * availableNames.length)];
    };

    // Show first notification after a short delay (3-5 seconds after page load)
    const initialDelay = 3000 + Math.random() * 2000;
    
    const initialTimer = setTimeout(() => {
      const name = getRandomUnusedName();
      setCurrentName(name);
      setUsedNames(prev => new Set([...prev, name]));
      setVisible(true);

      // Hide after 4 seconds
      setTimeout(() => {
        setVisible(false);
      }, 4000);
    }, initialDelay);

    // Set up recurring notifications
    const recurringTimer = setInterval(() => {
      const name = getRandomUnusedName();
      setCurrentName(name);
      setUsedNames(prev => new Set([...prev, name]));
      setVisible(true);

      // Hide after 4 seconds
      setTimeout(() => {
        setVisible(false);
      }, 4000);
    }, interval);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(recurringTimer);
    };
  }, [interval, usedNames]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 transition-all duration-500 ease-in-out transform ${
        visible 
          ? 'translate-y-0 opacity-100' 
          : 'translate-y-4 opacity-0 pointer-events-none'
      }`}
    >
      <div className="glass-strong rounded-xl px-4 py-3 shadow-modern-lg border border-white/30 flex items-center gap-2 backdrop-blur-xl">
        <CheckBadgeIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <p className="text-sm font-medium text-white whitespace-nowrap">
          {currentName} just ordered a ShoutOut.
        </p>
      </div>
    </div>
  );
};

export default FOMONotification;

