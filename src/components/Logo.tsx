import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  const sizes = {
    sm: { icon: 'w-6 h-6', container: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-6 h-6', container: 'w-10 h-10', text: 'text-2xl' },
    lg: { icon: 'w-8 h-8', container: 'w-12 h-12', text: 'text-3xl' },
  };

  const sizeClasses = sizes[size];

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses.container} bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg`}>
        {/* Megaphone/Speaker Icon */}
        <svg 
          viewBox="0 0 24 24" 
          className={`${sizeClasses.icon} text-white`}
          fill="currentColor"
        >
          <path d="M12 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2s2-.9 2-2V4c0-1.1-.9-2-2-2zm6.5 9c0 1.93-.63 3.71-1.68 5.15l1.42 1.42C19.45 15.84 20.5 13.52 20.5 11s-1.05-4.84-2.26-6.57l-1.42 1.42C18.37 7.29 18.5 9.07 18.5 11zm-2-5.15l-1.42 1.42C15.63 7.71 16 9.27 16 11s-.37 3.29-.92 3.73l1.42 1.42c.9-1.05 1.5-2.38 1.5-3.85s-.6-2.8-1.5-3.85zM3.5 9v6h3l3.5 2.5V6.5L6.5 9h-3z"/>
        </svg>
      </div>
      {showText && (
        <div className={`${sizeClasses.text} font-bold text-primary-600`}>
          {process.env.REACT_APP_APP_NAME || 'ShoutOut'}
        </div>
      )}
    </div>
  );
};

export default Logo;
