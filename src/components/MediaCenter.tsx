import React, { useState, useEffect } from 'react';
import { 
  PhotoIcon, 
  VideoCameraIcon, 
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { generatePromoGraphic, downloadPromoGraphic } from '../services/promoGraphicGenerator';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

interface MediaCenterProps {
  talentId: string;
  talentUsername?: string;
  talentFullName?: string;
  avatarUrl?: string;
  promoVideoUrl?: string;
}

interface ShareableVideo {
  id: string;
  created_at: string;
  video_url: string;
  request_details: string;
  user_name: string;
}

const MediaCenter: React.FC<MediaCenterProps> = ({
  talentId,
  talentUsername,
  talentFullName,
  avatarUrl,
  promoVideoUrl
}) => {
  const [generatingGraphic, setGeneratingGraphic] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [shareableVideos, setShareableVideos] = useState<ShareableVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Social media platform icons (SVG paths)
  const socialIcons = {
    Instagram: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    TikTok: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    Facebook: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    Twitter: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  };

  const socialHandles = [
    { platform: 'Instagram', handle: '@shoutoutvoice', color: 'from-purple-600 to-pink-600', icon: socialIcons.Instagram },
    { platform: 'TikTok', handle: '@shoutoutvoice', color: 'from-black to-gray-800', icon: socialIcons.TikTok },
    { platform: 'Facebook', handle: '@shoutoutvoice', color: 'from-blue-600 to-blue-700', icon: socialIcons.Facebook },
    { platform: 'X (Twitter)', handle: '@shoutoutvoices', color: 'from-gray-800 to-black', icon: socialIcons.Twitter }
  ];

  useEffect(() => {
    fetchShareableVideos();
  }, [talentId]);

  const fetchShareableVideos = async () => {
    try {
      setLoadingVideos(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          video_url,
          request_details,
          users!orders_user_id_fkey (
            full_name
          )
        `)
        .eq('talent_id', talentId)
        .eq('status', 'completed')
        .eq('share_approved', true)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data?.map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        video_url: order.video_url,
        request_details: order.request_details,
        user_name: order.users?.full_name || 'Customer'
      })) || [];

      setShareableVideos(formatted);
    } catch (error) {
      logger.error('Error fetching shareable videos:', error);
      // Don't show error toast - just show empty state
      setShareableVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(label);
      toast.success(`Copied ${label}!`);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      logger.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleGenerateGraphic = async () => {
    if (!avatarUrl) {
      toast.error('Avatar not found. Please upload a profile photo first.');
      return;
    }

    if (!talentUsername) {
      toast.error('Username not found.');
      return;
    }

    if (!talentFullName) {
      toast.error('Talent name not found.');
      return;
    }

    setGeneratingGraphic(true);
    try {
      const profileUrl = `ShoutOut.us/${talentUsername}`;
      const blob = await generatePromoGraphic({
        avatarUrl,
        talentName: talentFullName,
        profileUrl
      });
      const filename = `${talentUsername}-promo.png`;
      
      // Try to use native share API on mobile (saves to camera roll)
      if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
          const file = new File([blob], filename, { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: 'ShoutOut Promo Graphic',
            text: 'My ShoutOut promo graphic'
          });
          toast.success('Graphic saved!');
          return;
        } catch (shareError) {
          // Fall through to download if share fails
          logger.log('Share failed, falling back to download:', shareError);
        }
      }
      
      // Fallback: Traditional download for desktop
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Promo graphic downloaded!');
    } catch (error) {
      logger.error('Error generating promo graphic:', error);
      toast.error('Failed to generate promo graphic');
    } finally {
      setGeneratingGraphic(false);
    }
  };

  const handleDownloadPromoVideo = async () => {
    if (!promoVideoUrl) {
      toast.error('No promo video available');
      return;
    }

    if (!talentUsername) {
      toast.error('Username not found.');
      return;
    }

    setDownloadingVideo(true);
    try {
      logger.log('Starting promo video download with watermark:', promoVideoUrl);

      // Call watermark-video Edge Function
      const { data, error } = await supabase.functions.invoke('watermark-video', {
        body: { videoUrl: promoVideoUrl }
      });

      if (error) {
        logger.error('Watermark function error:', error);
        throw new Error(`Watermark error: ${error.message || 'Unknown error'}`);
      }

      if (!data?.watermarkedUrl) {
        logger.error('No watermarked URL in response:', data);
        throw new Error('No watermarked URL returned');
      }

      logger.log('Watermarked URL received:', data.watermarkedUrl);

      // Fetch the watermarked video
      const response = await fetch(data.watermarkedUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch watermarked video: ${response.status}`);
      }

      const blob = await response.blob();
      logger.log('Video blob size:', blob.size);

      const filename = `${talentUsername}-promo-video.mp4`;

      // Try to use native share API on mobile (saves to camera roll)
      if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
          const file = new File([blob], filename, { type: 'video/mp4' });
          await navigator.share({
            files: [file],
            title: 'ShoutOut Promo Video',
            text: 'My ShoutOut promo video'
          });
          toast.success('Video saved!');
          return;
        } catch (shareError) {
          logger.log('Share failed, falling back to download:', shareError);
        }
      }

      // Fallback: Traditional download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Promo video downloaded!');
    } catch (error) {
      logger.error('Error downloading promo video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download promo video';
      toast.error(errorMessage);
    } finally {
      setDownloadingVideo(false);
    }
  };

  const handleDownloadShareableVideo = async (videoUrl: string, orderId: string) => {
    try {
      // Call watermark-video Edge Function
      const { data, error } = await supabase.functions.invoke('watermark-video', {
        body: { videoUrl }
      });

      if (error) throw error;

      if (!data?.watermarkedUrl) {
        throw new Error('No watermarked URL returned');
      }

      // Fetch the video
      const response = await fetch(data.watermarkedUrl);
      const blob = await response.blob();
      const filename = `shoutout-${orderId.slice(0, 8)}.mp4`;

      // Try to use native share API on mobile (saves to camera roll)
      if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
          const file = new File([blob], filename, { type: 'video/mp4' });
          await navigator.share({
            files: [file],
            title: 'ShoutOut Video',
            text: 'My ShoutOut video'
          });
          toast.success('Video saved!');
          return;
        } catch (shareError) {
          logger.log('Share failed, falling back to download:', shareError);
        }
      }

      // Fallback: Traditional download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Video downloaded!');
    } catch (error) {
      logger.error('Error downloading video:', error);
      toast.error('Failed to download video');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Media Center</h2>
        <p className="text-gray-400">Download your promo materials and shareable content</p>
      </div>

      {/* Profile URL - Click to Copy */}
      {talentUsername && (
        <div className="glass p-4 rounded-xl">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Your Profile URL
          </label>
          <button
            onClick={() => handleCopyToClipboard(`https://shoutout.us/${talentUsername}`, 'Profile URL')}
            className="w-full glass-hover p-3 rounded-lg flex items-center justify-between transition-all duration-300"
          >
            <span className="text-white font-mono text-sm">
              shoutout.us/{talentUsername}
            </span>
            {copiedItem === 'Profile URL' ? (
              <CheckIcon className="h-5 w-5 text-green-400" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
      )}

      {/* Promo Materials */}
      <div className="glass p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <PhotoIcon className="h-5 w-5 text-blue-400" />
          Promotional Materials
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Promo Graphic */}
          <button
            onClick={handleGenerateGraphic}
            disabled={generatingGraphic || !avatarUrl}
            className="glass-hover p-4 rounded-lg text-left transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <PhotoIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Promo Graphic</h4>
                <p className="text-sm text-gray-400">1080x1350px Instagram post</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                {generatingGraphic ? 'Generating...' : 'Download PNG'}
              </span>
              <ArrowDownTrayIcon className="h-5 w-5 text-gray-400" />
            </div>
          </button>

          {/* Promo Video */}
          {promoVideoUrl && (
            <button
              onClick={handleDownloadPromoVideo}
              disabled={downloadingVideo}
              className="glass-hover p-4 rounded-lg text-left transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                  <VideoCameraIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Promo Video</h4>
                  <p className="text-sm text-gray-400">With watermark</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">
                  {downloadingVideo ? 'Processing...' : 'Download MP4'}
                </span>
                <ArrowDownTrayIcon className="h-5 w-5 text-gray-400" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Social Media Guidelines */}
      <div className="glass p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ShareIcon className="h-5 w-5 text-green-400" />
          Social Media Guidelines
        </h3>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <p className="text-blue-200 text-sm leading-relaxed">
            <strong className="text-blue-100">Instagram:</strong> Please collaborate with @shoutoutvoice so we can share the post!
            <br />
            <strong className="text-blue-100 mt-2 block">Stories & Other Platforms:</strong> Please tag us @shoutoutvoice!
          </p>
        </div>

        <div className="space-y-2">
          {socialHandles.map((social) => (
            <button
              key={social.platform}
              onClick={() => handleCopyToClipboard(social.handle, social.platform)}
              className="w-full glass-hover p-3 rounded-lg flex items-center justify-between transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${social.color} flex items-center justify-center text-white`}>
                  {social.icon}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-400">{social.platform}</p>
                  <p className="text-white font-semibold">{social.handle}</p>
                </div>
              </div>
              {copiedItem === social.platform ? (
                <CheckIcon className="h-5 w-5 text-green-400" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Shareable Videos */}
      <div className="glass p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <VideoCameraIcon className="h-5 w-5 text-purple-400" />
          Shareable Videos
        </h3>
        
        {loadingVideos ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <p className="text-gray-400 text-sm">Loading videos...</p>
          </div>
        ) : shareableVideos.length === 0 ? (
          <div className="text-center py-8">
            <VideoCameraIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No shareable videos yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Completed orders with user approval will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shareableVideos.map((video) => (
              <div
                key={video.id}
                className="glass-hover p-4 rounded-lg flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="text-white font-medium mb-1">
                    For {video.user_name}
                  </p>
                  <p className="text-gray-400 text-sm line-clamp-1">
                    {video.request_details}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(video.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDownloadShareableVideo(video.video_url, video.id)}
                  className="ml-4 p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
                  title="Download video with watermark"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaCenter;

