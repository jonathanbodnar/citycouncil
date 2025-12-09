// Mobile-friendly download utility for videos
// Safari on iOS doesn't support programmatic downloads via <a download>

import toast from 'react-hot-toast';

interface DownloadOptions {
  url: string;
  filename: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Downloads a video file with mobile Safari support
 * For iOS: Opens video directly in new tab (fetching large files on mobile is unreliable)
 * For Desktop/Android: Uses blob download
 */
export const downloadVideo = async ({ url, filename, onSuccess, onError }: DownloadOptions): Promise<boolean> => {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  console.log('📥 Download attempt:', { url, filename, isIOS, isMobile });

  // iOS/iPad: Don't try to fetch - just open the video directly
  // Fetching large videos on mobile Safari is unreliable and slow
  if (isIOS) {
    console.log('📱 iOS detected - opening video directly');
    openVideoInNewTab(url);
    toast.success('Video opened! Long-press to save to Photos.', { duration: 6000 });
    onSuccess?.();
    return true;
  }

  // Android/Desktop: Try blob download with timeout
  try {
    toast.loading('Preparing download...', { id: 'download-progress' });
    
    // Add a 30 second timeout for the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, { 
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('📦 Blob created:', { size: blob.size, type: blob.type });
    
    // Standard blob download
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);

    toast.success('Video downloaded!', { id: 'download-progress' });
    onSuccess?.();
    return true;

  } catch (error: any) {
    console.error('Download error:', error);
    toast.dismiss('download-progress');
    
    // If fetch failed or timed out, fall back to opening in new tab
    if (error.name === 'AbortError') {
      toast.error('Download timed out. Opening video instead...', { duration: 3000 });
    }
    
    openVideoInNewTab(url);
    toast.success('Video opened! Right-click or long-press to save.', { duration: 5000 });
    onSuccess?.();
    return true;
  }
};

/**
 * Opens video in a new tab with save instructions
 */
function openVideoInNewTab(url: string) {
  // Just open the direct URL - Safari can handle video files natively
  const newWindow = window.open(url, '_blank');
  
  // If popup was blocked, try direct navigation
  if (!newWindow) {
    window.location.href = url;
  }
}

/**
 * Downloads a video with watermark (for admin/talent promo downloads)
 */
export const downloadVideoWithWatermark = async (
  supabase: any,
  videoUrl: string, 
  talentName: string, 
  orderId: string
): Promise<boolean> => {
  try {
    toast.loading('Adding watermark...', { id: 'watermark' });

    const { data, error } = await supabase.functions.invoke('watermark-video', {
      body: { videoUrl, orderId, talentName }
    });

    if (error) throw error;
    if (!data?.watermarkedUrl) throw new Error('No watermarked URL returned');

    toast.success('Watermark applied!', { id: 'watermark' });

    const filename = `shoutout-${talentName.replace(/\s+/g, '-')}-${orderId.slice(0, 8)}.mp4`;
    
    return await downloadVideo({
      url: data.watermarkedUrl,
      filename,
      onError: () => {
        // Fallback to original video without watermark
        toast.error('Watermark download failed. Downloading original...', { duration: 3000 });
        downloadVideo({ url: videoUrl, filename });
      }
    });

  } catch (error: any) {
    console.error('Watermark download error:', error);
    toast.dismiss('watermark');
    toast.error('Watermark failed. Downloading original video...', { duration: 3000 });
    
    // Fallback to original
    const filename = `shoutout-${talentName.replace(/\s+/g, '-')}-${orderId.slice(0, 8)}.mp4`;
    return await downloadVideo({ url: videoUrl, filename });
  }
};

