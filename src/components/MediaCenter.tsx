import React, { useState, useEffect } from 'react';
import { 
  VideoCameraIcon, 
  ClipboardDocumentIcon,
  CheckIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

interface MediaCenterProps {
  talentId: string;
  talentUsername?: string;
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
  talentUsername
}) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [shareableVideos, setShareableVideos] = useState<ShareableVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Social media platform icons (SVG paths)
  const socialIcons = {
    Instagram: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    Facebook: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    Twitter: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  };

  useEffect(() => {
    fetchShareableVideos();
  }, [talentId]);

  const fetchShareableVideos = async () => {
    try {
      setLoadingVideos(true);
      // Get orders that are completed/delivered with videos
      // The checkbox saves to `allow_promotional_use` column
      // Show all unless allow_promotional_use is explicitly FALSE
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          video_url,
          request_details,
          allow_promotional_use,
          recipient_name
        `)
        .eq('talent_id', talentId)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching orders:', error);
        throw error;
      }

      // Filter out only those explicitly marked as NOT shareable
      // allow_promotional_use defaults to true, so show unless explicitly false
      const shareable = data?.filter((order: any) => order.allow_promotional_use !== false) || [];

      const formatted = shareable.map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        video_url: order.video_url,
        request_details: order.request_details,
        user_name: order.recipient_name || 'Customer'
      }));

      logger.log('Shareable videos found:', formatted.length, 'out of', data?.length, 'total delivered');
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

  // Handle downloading video (simple direct download)
  const handleDownloadVideo = async (videoUrl: string, orderId: string) => {
    try {
      toast.loading('Starting download...', { id: 'download-video' });
      
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `shoutout-${orderId.slice(0, 8)}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.dismiss('download-video');
      toast.success('Download started! Save the video, then share to Instagram Stories.');
    } catch (error: any) {
      toast.dismiss('download-video');
      logger.error('Error downloading video:', error);
      // Fallback: open in new tab
      window.open(videoUrl, '_blank');
      toast.success('Opening video - hold to save, then share to Stories!');
    }
  };

  // Compact social handles for the tag section (just 3)
  const tagSocialHandles = [
    { platform: 'Instagram', handle: '@shoutoutvoice', icon: socialIcons.Instagram },
    { platform: 'X', handle: '@shoutoutvoices', icon: socialIcons.Twitter },
    { platform: 'Facebook', handle: '@shoutoutvoice', icon: socialIcons.Facebook },
  ];

  return (
    <div className="space-y-4">
      {/* Profile Link Section - Styled like Link in Bio tab */}
      {talentUsername && (
        <div className="glass rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <ClipboardDocumentIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Your Profile Link</h3>
              <p className="text-xs text-gray-400">Share this to earn +10% on every order</p>
            </div>
          </div>
          
          <button
            onClick={() => handleCopyToClipboard(`https://shoutout.us/${talentUsername}?utm=1`, 'Profile URL')}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 hover:border-blue-400/50 transition-all flex items-center justify-between group"
          >
            <span className="text-white font-mono text-sm">shoutout.us/{talentUsername}?utm=1</span>
            {copiedItem === 'Profile URL' ? (
              <span className="flex items-center gap-1 text-emerald-400 text-sm">
                <CheckIcon className="h-4 w-4" />
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1 text-blue-400 text-sm group-hover:text-blue-300">
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </span>
            )}
          </button>
        </div>
      )}

      {/* Most Effective Promotion Section */}
      <div className="glass rounded-2xl p-4 border border-white/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center">
            <ShareIcon className="h-5 w-5 text-pink-400" />
          </div>
          <h3 className="text-base font-bold text-white">Most Effective Promotion</h3>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-500/20 mb-4">
          <p className="text-gray-200 text-sm leading-relaxed">
            Post a funny story or previously delivered ShoutOut on Instagram (as a reel or just a story) and{' '}
            <strong className="text-white">add your profile link on the story.</strong>
          </p>
        </div>

        {/* Case Studies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-gray-300 leading-relaxed">
              <span className="text-emerald-400 font-semibold">Melonie Mac</span> got <span className="text-yellow-400 font-bold">12 orders</span> in just <span className="text-emerald-400 font-bold">24 hours</span> by posting a quick reel and adding it to her stories with her profile link.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-gray-300 leading-relaxed">
              <span className="text-emerald-400 font-semibold">Kaitlin Bennett</span> posted a single story on Instagram with her profile link and got <span className="text-yellow-400 font-bold">10 orders</span> in the first <span className="text-emerald-400 font-bold">24 hours</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Tag Us Section */}
      <div className="glass rounded-2xl p-4 border border-white/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Tag or Collab with us for extra reach!</h3>
            <p className="text-xs text-gray-400">We will always promote your reels and posts!</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tagSocialHandles.map((social) => (
            <button
              key={social.platform}
              onClick={() => handleCopyToClipboard(social.handle, social.platform)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 transition-all"
            >
              <span className="text-gray-400">{social.icon}</span>
              <span className="text-xs text-white font-medium">{social.handle}</span>
              {copiedItem === social.platform ? (
                <CheckIcon className="h-3 w-3 text-emerald-400" />
              ) : (
                <ClipboardDocumentIcon className="h-3 w-3 text-gray-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Shareable Videos Section */}
      <div className="glass rounded-2xl p-4 border border-white/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <VideoCameraIcon className="h-5 w-5 text-purple-400" />
          </div>
          <h3 className="text-base font-bold text-white">Shareable Videos</h3>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full whitespace-nowrap">
            ✓ Customer Approved
          </span>
        </div>
        
        <p className="text-xs text-gray-400 mb-4 ml-[52px]">
          Share out your previous ShoutOuts! (Don't forget to add your profile link to the story!)
        </p>
        
        {loadingVideos ? (
          <div className="text-center py-6">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mb-2"></div>
            <p className="text-gray-400 text-xs">Loading videos...</p>
          </div>
        ) : shareableVideos.length === 0 ? (
          <div className="text-center py-6">
            <VideoCameraIcon className="h-10 w-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No shareable videos yet</p>
            <p className="text-gray-500 text-xs mt-1">
              Completed orders with user approval will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {shareableVideos.map((video) => (
              <div
                key={video.id}
                className="rounded-xl overflow-hidden bg-black/30 border border-white/10"
              >
                {/* Video Preview */}
                <div className="relative aspect-[9/16] bg-black">
                  <video 
                    src={video.video_url}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                    playsInline
                  />
                </div>
                
                {/* Info & Share Button */}
                <div className="p-2">
                  <p className="text-white text-xs font-medium truncate mb-1">
                    For {video.user_name}
                  </p>
                  <p className="text-gray-500 text-[10px] mb-2">
                    {new Date(video.created_at).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleDownloadVideo(video.video_url, video.id)}
                    className="w-full py-1.5 px-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-all"
                  >
                    <ShareIcon className="h-3 w-3" />
                    Download & Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default MediaCenter;


