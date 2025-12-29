import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

// Cache logo URL in memory to avoid repeated DB fetches
let cachedLogoUrl: string | null = null;

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = false,
  theme = 'light', 
  className = '' 
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(cachedLogoUrl);

  const sizes = {
    sm: { height: 'h-8', width: 'w-auto', px: 32 },
    md: { height: 'h-10', width: 'w-auto', px: 40 },
    lg: { height: 'h-16', width: 'w-auto', px: 64 },
  };

  const sizeClasses = sizes[size];

  // Default/fallback logo URL
  const defaultLogoUrl = "https://i.ibb.co/hJdY3gwN/1b9b81e0-4fe1-4eea-b617-af006370240a.png";

  useEffect(() => {
    // If already cached, skip fetch
    if (cachedLogoUrl) {
      setLogoUrl(cachedLogoUrl);
      return;
    }

    const fetchLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'platform_logo_url')
          .single();

        if (error) throw error;

        const url = data?.setting_value || defaultLogoUrl;
        cachedLogoUrl = url; // Cache for future renders
        setLogoUrl(url);
      } catch (error) {
        console.error('Error fetching logo:', error);
        cachedLogoUrl = defaultLogoUrl;
        setLogoUrl(defaultLogoUrl);
      }
    };

    fetchLogo();
  }, []);

  const currentLogoUrl = logoUrl || defaultLogoUrl;

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
