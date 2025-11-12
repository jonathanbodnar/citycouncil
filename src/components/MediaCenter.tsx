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

  const socialHandles = [
    { platform: 'Instagram', handle: '@shoutoutvoice', color: 'from-purple-600 to-pink-600' },
    { platform: 'TikTok', handle: '@shoutoutvoice', color: 'from-black to-gray-800' },
    { platform: 'Facebook', handle: '@shoutoutvoice', color: 'from-blue-600 to-blue-700' },
    { platform: 'X (Twitter)', handle: '@shoutoutvoices', color: 'from-gray-800 to-black' }
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
      // Call watermark-video Edge Function
      const { data, error } = await supabase.functions.invoke('watermark-video', {
        body: { videoUrl: promoVideoUrl }
      });

      if (error) throw error;

      if (!data?.watermarkedUrl) {
        throw new Error('No watermarked URL returned');
      }

      // Fetch the watermarked video
      const response = await fetch(data.watermarkedUrl);
      const blob = await response.blob();
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
      toast.error('Failed to download promo video');
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
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${social.color} flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">
                    {social.platform.charAt(0)}
                  </span>
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

