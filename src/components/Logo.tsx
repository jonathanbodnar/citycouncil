import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

// Hardcoded logo URL for performance - no database fetch needed
// This is the LCP element, must load immediately
const LOGO_URL = "https://i.ibb.co/hJdY3gwN/1b9b81e0-4fe1-4eea-b617-af006370240a.png";

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = false,
  theme = 'light', 
  className = '' 
}) => {
  const sizes = {
    sm: { height: 'h-8', width: 'w-auto', px: 32 },
    md: { height: 'h-10', width: 'w-auto', px: 40 },
    lg: { height: 'h-16', width: 'w-auto', px: 64 },
  };

  const sizeClasses = sizes[size];
  const currentLogoUrl = LOGO_URL;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={currentLogoUrl}
        alt="ShoutOut Logo"
        className={`${sizeClasses.height} ${sizeClasses.width} object-contain ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
        fetchPriority="high"
        loading="eager"
        decoding="sync"
        width={sizeClasses.px}
        height={sizeClasses.px}
      />
      <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>
        beta
      </span>
    </div>
  );
};

export default Logo;
