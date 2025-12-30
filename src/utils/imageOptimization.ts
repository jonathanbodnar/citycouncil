/**
 * Cloudflare Image Transformation Utility
 * 
 * Transforms image URLs to use Cloudflare's image resizing/optimization API.
 * 
 * Cloudflare Image Transformations URL format:
 * https://yourdomain.com/cdn-cgi/image/width=300,height=300,fit=cover,quality=80,format=auto/[original-image-url]
 * 
 * @see https://developers.cloudflare.com/images/transform-images/
 */

interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  quality?: number; // 1-100
  format?: 'auto' | 'avif' | 'webp' | 'json';
  dpr?: number; // Device pixel ratio (1, 2, 3)
  blur?: number; // 1-250
  sharpen?: number; // 0-10
  gravity?: 'auto' | 'center' | 'top' | 'bottom' | 'left' | 'right';
}

// Your domain that's proxied through Cloudflare
const CLOUDFLARE_DOMAIN = 'https://shoutout.us';

/**
 * Check if an image URL should be transformed via Cloudflare
 * Only transform external images (Supabase, Wasabi, etc.)
 */
function shouldTransform(url: string): boolean {
  if (!url) return false;
  
  // Don't transform data URLs or blobs
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  
  // Don't transform already-transformed URLs
  if (url.includes('/cdn-cgi/image/')) return false;
  
  // Transform these external image sources
  const transformableDomains = [
    'supabase.co',
    'wasabisys.com',
    's3.us-central-1',
    'shoutout-assets',
  ];
  
  return transformableDomains.some(domain => url.includes(domain));
}

/**
 * Build Cloudflare transformation options string
 */
function buildOptionsString(options: ImageTransformOptions): string {
  const parts: string[] = [];
  
  if (options.width) parts.push(`width=${options.width}`);
  if (options.height) parts.push(`height=${options.height}`);
  if (options.fit) parts.push(`fit=${options.fit}`);
  if (options.quality) parts.push(`quality=${options.quality}`);
  if (options.format) parts.push(`format=${options.format}`);
  if (options.dpr) parts.push(`dpr=${options.dpr}`);
  if (options.blur) parts.push(`blur=${options.blur}`);
  if (options.sharpen) parts.push(`sharpen=${options.sharpen}`);
  if (options.gravity) parts.push(`gravity=${options.gravity}`);
  
  return parts.join(',');
}

/**
 * Transform an image URL to use Cloudflare Image Transformations
 * 
 * @example
 * // Avatar thumbnail (300x300)
 * optimizeImage(avatarUrl, { width: 300, height: 300, fit: 'cover' })
 * 
 * // Profile image (600x600, high quality)
 * optimizeImage(avatarUrl, { width: 600, height: 600, fit: 'cover', quality: 85 })
 * 
 * // Responsive image with DPR
 * optimizeImage(avatarUrl, { width: 300, height: 300, fit: 'cover', dpr: 2 })
 */
export function optimizeImage(
  url: string | undefined | null,
  options: ImageTransformOptions = {}
): string {
  if (!url) return '';
  
  // Check if we should transform this URL
  if (!shouldTransform(url)) return url;
  
  // Default options for optimal performance
  const defaultOptions: ImageTransformOptions = {
    format: 'auto', // Serve WebP/AVIF when supported
    quality: 80,    // Good balance of quality vs size
    fit: 'cover',
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  const optionsString = buildOptionsString(mergedOptions);
  
  // Cloudflare Image Transformations URL format
  return `${CLOUDFLARE_DOMAIN}/cdn-cgi/image/${optionsString}/${url}`;
}

/**
 * Pre-configured image sizes for common use cases
 */
export const ImageSizes = {
  // Talent card thumbnails
  thumbnail: (url: string) => optimizeImage(url, {
    width: 300,
    height: 300,
    fit: 'cover',
    quality: 75,
  }),
  
  // Talent card thumbnails for retina displays
  thumbnailRetina: (url: string) => optimizeImage(url, {
    width: 300,
    height: 300,
    fit: 'cover',
    quality: 75,
    dpr: 2,
  }),
  
  // Profile page hero image
  profileHero: (url: string) => optimizeImage(url, {
    width: 600,
    height: 600,
    fit: 'cover',
    quality: 85,
  }),
  
  // Profile page hero for retina
  profileHeroRetina: (url: string) => optimizeImage(url, {
    width: 600,
    height: 600,
    fit: 'cover',
    quality: 85,
    dpr: 2,
  }),
  
  // Small avatar (header, lists)
  avatarSmall: (url: string) => optimizeImage(url, {
    width: 48,
    height: 48,
    fit: 'cover',
    quality: 80,
  }),
  
  // Medium avatar (dashboard, cards)
  avatarMedium: (url: string) => optimizeImage(url, {
    width: 96,
    height: 96,
    fit: 'cover',
    quality: 80,
  }),
  
  // Featured carousel (larger cards)
  featured: (url: string) => optimizeImage(url, {
    width: 400,
    height: 400,
    fit: 'cover',
    quality: 80,
  }),
  
  // Open Graph / social sharing
  ogImage: (url: string) => optimizeImage(url, {
    width: 1200,
    height: 630,
    fit: 'cover',
    quality: 85,
  }),
  
  // Blur placeholder (tiny, heavily compressed)
  placeholder: (url: string) => optimizeImage(url, {
    width: 20,
    height: 20,
    fit: 'cover',
    quality: 30,
    blur: 10,
  }),
};

export default optimizeImage;

