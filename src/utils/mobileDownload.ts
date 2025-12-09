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
 * Uses Web Share API on iOS, falls back to blob download on other platforms
 */
export const downloadVideo = async ({ url, filename, onSuccess, onError }: DownloadOptions): Promise<boolean> => {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  console.log('📥 Download attempt:', { url, filename, isIOS, isSafari, isMobile });

  try {
    // Fetch the video first
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });

    // iOS: Try Web Share API first (this allows saving to camera roll)
    if (isIOS && navigator.share && navigator.canShare) {
      try {
        const shareData = { files: [file] };
        
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast.success('Video saved!');
          onSuccess?.();
          return true;
        }
      } catch (shareError: any) {
        // User cancelled or share failed - try alternative
        console.log('Share API failed:', shareError.message);
        
        if (shareError.name === 'AbortError') {
          // User cancelled - don't show error
          return false;
        }
      }
    }

    // iOS Safari fallback: Open in new tab with instructions
    if (isIOS) {
      const blobUrl = URL.createObjectURL(blob);
      
      // Create a temporary page that shows the video with save instructions
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Save Video</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                background: #1a1a2e;
                color: white;
                padding: 20px;
                text-align: center;
                margin: 0;
              }
              video {
                max-width: 100%;
                border-radius: 12px;
                margin: 20px 0;
              }
              .instructions {
                background: rgba(255,255,255,0.1);
                padding: 20px;
                border-radius: 12px;
                margin-top: 20px;
              }
              h2 { color: #a855f7; margin-bottom: 10px; }
              p { color: #9ca3af; line-height: 1.6; }
              .step { 
                display: flex; 
                align-items: center; 
                gap: 10px; 
                margin: 10px 0;
                text-align: left;
              }
              .step-num {
                background: #a855f7;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                flex-shrink: 0;
              }
            </style>
          </head>
          <body>
            <h2>📱 Save Your Video</h2>
            <video src="${blobUrl}" controls playsinline autoplay muted></video>
            <div class="instructions">
              <div class="step">
                <span class="step-num">1</span>
                <span>Long-press on the video above</span>
              </div>
              <div class="step">
                <span class="step-num">2</span>
                <span>Tap "Save to Photos" or "Download"</span>
              </div>
            </div>
          </body>
          </html>
        `);
        newWindow.document.close();
        toast.success('Video opened! Long-press to save.', { duration: 5000 });
        onSuccess?.();
        return true;
      }
    }

    // Android/Desktop: Standard blob download
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

    toast.success('Video downloaded!');
    onSuccess?.();
    return true;

  } catch (error: any) {
    console.error('Download error:', error);
    
    // Final fallback: Just open the URL directly
    try {
      window.open(url, '_blank');
      toast.success('Video opened in new tab. Long-press or right-click to save.', { duration: 5000 });
      onSuccess?.();
      return true;
    } catch (openError) {
      toast.error('Unable to download. Please try again.');
      onError?.(error);
      return false;
    }
  }
};

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

