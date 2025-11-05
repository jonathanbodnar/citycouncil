import React, { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // For above-the-fold images
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

/**
 * Optimized Image Component
 * Features:
 * - Lazy loading by default
 * - Blur placeholder while loading
 * - WebP support with fallback
 * - Responsive images
 * - Error handling
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  objectFit = 'cover',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Check if image is from Supabase storage
  const isSupabaseImage = src?.includes('supabase');
  
  // Generate WebP URL for Supabase images (if supported)
  const webpSrc = isSupabaseImage ? 
    `${src}?format=webp&quality=85` : 
    src;

  // Generate smaller thumbnail for blur placeholder
  const placeholderSrc = isSupabaseImage ? 
    `${src}?width=20&quality=10` : 
    src;

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-800 ${className}`}
        style={{ 
          width: width ? `${width}px` : '100%', 
          height: height ? `${height}px` : '100%' 
        }}
      >
        <div className="text-center text-gray-400">
          <svg
            className="h-12 w-12 mx-auto mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">Image not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ width, height }}>
      {/* Blur placeholder */}
      {!isLoaded && (
        <img
          src={placeholderSrc}
          alt=""
          className={`absolute inset-0 w-full h-full blur-lg scale-110 ${className}`}
          style={{ objectFit }}
          aria-hidden="true"
        />
      )}

      {/* Main image with WebP support */}
      <picture>
        {/* WebP for modern browsers */}
        {isSupabaseImage && (
          <source srcSet={webpSrc} type="image/webp" />
        )}
        
        {/* Fallback to original format */}
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          style={{ objectFit }}
          width={width}
          height={height}
        />
      </picture>

      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
    </div>
  );
};

export default OptimizedImage;

