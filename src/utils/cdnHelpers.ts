/**
 * CDN Helper Utilities
 * Handles CDN URL generation for Wasabi storage with Cloudflare CDN fallback
 */

// CDN URLs from environment variables
const CDN_VIDEOS_URL = process.env.REACT_APP_WASABI_CDN_VIDEOS_URL || '';
const CDN_IMAGES_URL = process.env.REACT_APP_WASABI_CDN_IMAGES_URL || '';

// Fallback to direct Wasabi URLs
const WASABI_BUCKET_URL = process.env.REACT_APP_WASABI_BUCKET_URL || 
  'https://shoutoutorders.s3.us-central-1.wasabisys.com';

/**
 * Get CDN URL for a video file
 * Falls back to direct Wasabi URL if CDN not configured
 * 
 * @param videoPath - Path to video file (e.g., "videos/abc123.mp4")
 * @returns Full URL to video (CDN or direct)
 */
export function getCDNVideoUrl(videoPath: string): string {
  // Remove leading slash if present
  const cleanPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
  
  // Use CDN if configured, otherwise use direct Wasabi
  if (CDN_VIDEOS_URL) {
    return `${CDN_VIDEOS_URL}/${cleanPath}`;
  }
  
  return `${WASABI_BUCKET_URL}/${cleanPath}`;
}

/**
 * Get CDN URL for an image file
 * Falls back to direct URL if CDN not configured
 * 
 * @param imagePath - Path to image file (e.g., "avatars/user123.jpg")
 * @returns Full URL to image (CDN or direct)
 */
export function getCDNImageUrl(imagePath: string): string {
  // If it's already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  // Use CDN if configured
  if (CDN_IMAGES_URL) {
    return `${CDN_IMAGES_URL}/${cleanPath}`;
  }
  
  // Fall back to direct URL (check if it's a Supabase or Wasabi URL)
  if (cleanPath.includes('supabase')) {
    return imagePath; // Supabase images stay on Supabase
  }
  
  return `${WASABI_BUCKET_URL}/${cleanPath}`;
}

/**
 * Check if CDN is enabled
 * @returns true if CDN URLs are configured
 */
export function isCDNEnabled(): boolean {
  return !!(CDN_VIDEOS_URL || CDN_IMAGES_URL);
}

/**
 * Get CDN status for monitoring/debugging
 */
export function getCDNStatus() {
  return {
    enabled: isCDNEnabled(),
    videoCDN: CDN_VIDEOS_URL || 'Not configured',
    imageCDN: CDN_IMAGES_URL || 'Not configured',
    fallbackURL: WASABI_BUCKET_URL,
  };
}

/**
 * Preload a video for faster playback
 * Warms the CDN cache by making a HEAD request
 * 
 * @param videoUrl - Full URL to video
 */
export async function preloadVideo(videoUrl: string): Promise<void> {
  try {
    const response = await fetch(videoUrl, {
      method: 'HEAD',
      cache: 'force-cache',
    });
    
    if (!response.ok) {
      console.warn(`Failed to preload video: ${videoUrl}`);
    }
  } catch (error) {
    console.error('Error preloading video:', error);
  }
}

/**
 * Batch preload multiple videos
 * Useful for homepage/profile pages with many videos
 * 
 * @param videoUrls - Array of video URLs to preload
 */
export async function preloadVideos(videoUrls: string[]): Promise<void> {
  const preloadPromises = videoUrls.map(url => preloadVideo(url));
  await Promise.all(preloadPromises);
}

/**
 * Get optimized image URL with query parameters
 * Can be used with Cloudflare Image Resizing (paid plan)
 * 
 * @param imagePath - Path to image
 * @param options - Image optimization options
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(
  imagePath: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  }
): string {
  const baseUrl = getCDNImageUrl(imagePath);
  
  // If no options or CDN not enabled, return base URL
  if (!options || !CDN_IMAGES_URL) {
    return baseUrl;
  }
  
  // Build query string for Cloudflare Image Resizing
  // Note: Requires paid Cloudflare plan
  const params = new URLSearchParams();
  
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.quality) params.append('quality', options.quality.toString());
  if (options.format) params.append('format', options.format);
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

