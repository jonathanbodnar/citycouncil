import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = false, 
  className = '' 
}) => {
  const sizes = {
    sm: { height: 'h-8', width: 'w-auto' },
    md: { height: 'h-10', width: 'w-auto' },
    lg: { height: 'h-16', width: 'w-auto' },
  };

  const sizeClasses = sizes[size];

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="https://s3.us-central-1.wasabisys.com/shoutoutorders/1b9b81e0-4fe1-4eea-b617-af006370240a.png"
        alt="ShoutOut Logo"
        className={`${sizeClasses.height} ${sizeClasses.width} object-contain`}
        onError={(e) => {
          // Fallback to text logo if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'block';
        }}
      />
      {/* Fallback text logo (hidden by default) */}
      <div 
        className={`hidden items-center space-x-2`}
        style={{ display: showText ? 'flex' : 'none' }}
      >
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg">
          <svg 
            viewBox="0 0 24 24" 
            className="w-6 h-6 text-white"
            fill="currentColor"
          >
            <path d="M12 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2s2-.9 2-2V4c0-1.1-.9-2-2-2zm6.5 9c0 1.93-.63 3.71-1.68 5.15l1.42 1.42C19.45 15.84 20.5 13.52 20.5 11s-1.05-4.84-2.26-6.57l-1.42 1.42C18.37 7.29 18.5 9.07 18.5 11zm-2-5.15l-1.42 1.42C15.63 7.71 16 9.27 16 11s-.37 3.29-.92 3.73l1.42 1.42c.9-1.05 1.5-2.38 1.5-3.85s-.6-2.8-1.5-3.85zM3.5 9v6h3l3.5 2.5V6.5L6.5 9h-3z"/>
          </svg>
        </div>
        <div className="text-2xl font-bold text-primary-600">
          {process.env.REACT_APP_APP_NAME || 'ShoutOut'}
        </div>
      </div>
    </div>
  );
};

export default Logo;
