import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = false,
  theme = 'light', 
  className = '' 
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sizes = {
    sm: { height: 'h-8', width: 'w-auto' },
    md: { height: 'h-10', width: 'w-auto' },
    lg: { height: 'h-16', width: 'w-auto' },
  };

  const sizeClasses = sizes[size];

  // Default/fallback logo URL
  const defaultLogoUrl = "https://i.ibb.co/hJdY3gwN/1b9b81e0-4fe1-4eea-b617-af006370240a.png";

  useEffect(() => {
    fetchLogo();
  }, []);

  const fetchLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_logo_url')
        .single();

      if (error) throw error;

      if (data?.setting_value) {
        setLogoUrl(data.setting_value);
      } else {
        setLogoUrl(defaultLogoUrl);
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLogoUrl(defaultLogoUrl);
    } finally {
      setLoading(false);
    }
  };

  const currentLogoUrl = logoUrl || defaultLogoUrl;

  return (
    <div className={`flex items-center ${className}`}>
      {loading ? (
        <div className={`${sizeClasses.height} ${sizeClasses.width} bg-gray-200 animate-pulse rounded`} />
      ) : (
        <img
          src={currentLogoUrl}
          alt="ShoutOut Logo"
          className={`${sizeClasses.height} ${sizeClasses.width} object-contain ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
          onError={(e) => {
            // Fallback to default logo if custom logo fails to load
            const target = e.target as HTMLImageElement;
            if (target.src !== defaultLogoUrl) {
              target.src = defaultLogoUrl;
            } else {
              // If even default fails, show text logo
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'block';
            }
          }}
        />
      )}
      
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
        <div className="text-2xl font-bold text-white">
          {process.env.REACT_APP_APP_NAME || 'ShoutOut'}
        </div>
      </div>
    </div>
  );
};

export default Logo;
