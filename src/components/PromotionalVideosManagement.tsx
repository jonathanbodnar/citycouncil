import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { ArrowDownTrayIcon, VideoCameraIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface PromotionalVideo {
  id: string;
  created_at: string;
  video_url: string;
  request_details?: string;
  allow_promotional_use?: boolean;
  talent_profiles?: {
    id: string;
    temp_full_name: string;
    users: {
      full_name: string;
    } | null;
  };
  users?: {
    full_name: string;
  };
  // Fields for onboarding promo videos
  talent_name?: string;
  video_type?: 'order' | 'onboarding';
  username?: string;
}

const PromotionalVideosManagement: React.FC = () => {
  const [videos, setVideos] = useState<PromotionalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingVideo, setDownloadingVideo] = useState<string | null>(null);

  useEffect(() => {
    fetchPromotionalVideos();
  }, []);

  const fetchPromotionalVideos = async () => {
    try {
      setLoading(true);
      
      // Fetch order videos with promotional use allowed
      const { data: orderVideos, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          video_url,
          request_details,
          allow_promotional_use,
          talent_profiles!orders_talent_id_fkey (
            id,
            temp_full_name,
            users!talent_profiles_user_id_fkey (
              full_name
            )
          ),
          users!orders_user_id_fkey (
            full_name
          )
        `)
        .eq('status', 'completed')
        .eq('allow_promotional_use', true)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      // Fetch onboarding promo videos
      const { data: promoVideos, error: promoError } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          created_at,
          promo_video_url,
          username,
          temp_full_name,
          users!talent_profiles_user_id_fkey (
            full_name
          )
        `)
        .not('promo_video_url', 'is', null)
        .order('created_at', { ascending: false });

      if (promoError) throw promoError;

      // Combine and format both types of videos
      const formattedOrderVideos: PromotionalVideo[] = (orderVideos || []).map((video: any) => ({
        ...video,
        video_type: 'order' as const
      }));

      const formattedPromoVideos: PromotionalVideo[] = (promoVideos || []).map((video: any) => ({
        id: video.id,
        created_at: video.created_at,
        video_url: video.promo_video_url,
        request_details: 'Onboarding Promo Video',
        video_type: 'onboarding' as const,
        talent_name: video.users?.full_name || video.temp_full_name || 'Unknown',
        username: video.username
      }));

      // Combine and sort by date
      const allVideos = [...formattedOrderVideos, ...formattedPromoVideos]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setVideos(allVideos);
    } catch (error) {
      console.error('Error fetching promotional videos:', error);
      toast.error('Failed to load promotional videos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadWithWatermark = async (videoUrl: string, talentName: string, orderId: string) => {
    setDownloadingVideo(orderId);
    
    console.log('📥 Starting download:', {
      videoUrl,
      talentName,
      orderId,
      timestamp: new Date().toISOString()
    });
    
    try {
      toast.loading('Adding watermark...', { id: 'watermark' });

      // Call watermark edge function
      console.log('🎨 Invoking watermark function...');
      const { data, error } = await supabase.functions.invoke('watermark-video', {
        body: { 
          videoUrl,
          orderId,
          talentName
        }
      });

      console.log('🎨 Watermark function response:', { data, error });

      if (error) {
        console.error('❌ Watermark error:', error);
        throw error;
      }

      if (!data || !data.watermarkedUrl) {
        console.error('❌ No watermarked URL in response:', data);
        throw new Error('No watermarked URL returned');
      }

      if (data.warning) {
        console.warn('⚠️ Watermark warning:', data.warning);
        toast.error(data.warning, { id: 'watermark' });
      } else {
        toast.success('Watermark applied!', { id: 'watermark' });
      }

      // Download the watermarked video using mobile-friendly utility
      toast.loading('Downloading video...', { id: 'download' });
      console.log('⬇️ Downloading watermarked video:', data.watermarkedUrl);
      
      const { downloadVideo } = await import('../utils/mobileDownload');
      const filename = `shoutout-${talentName.replace(/\s+/g, '-')}-${orderId.slice(0, 8)}.mp4`;
      
      await downloadVideo({
        url: data.watermarkedUrl,
        filename,
        onSuccess: () => {
          console.log('✅ Video download successful');
          toast.dismiss('download');
        },
        onError: (err) => {
          console.error('Download error:', err);
          toast.dismiss('download');
        }
      });
    } catch (error: any) {
      console.error('❌ Error in download flow:', {
        error,
        message: error?.message,
        details: error?.details,
        stack: error?.stack
      });
      
      toast.dismiss('watermark');
      toast.dismiss('download');
      toast.error('Failed to download with watermark. Trying direct download...', { duration: 3000 });
      
      // Fallback: direct download without watermark using mobile-friendly utility
      try {
        console.log('🔄 Attempting direct download fallback...');
        const { downloadVideo } = await import('../utils/mobileDownload');
        const filename = `shoutout-${talentName.replace(/\s+/g, '-')}-${orderId.slice(0, 8)}-no-watermark.mp4`;
        
        await downloadVideo({
          url: videoUrl,
          filename,
          onSuccess: () => console.log('✅ Direct download successful')
        });
      } catch (fallbackError: any) {
        console.error('❌ Fallback download also failed:', fallbackError);
        toast.error('Failed to download video. Please try again later.');
      }
    } finally {
      setDownloadingVideo(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Promotional Videos</h2>
          <p className="text-gray-300 mt-1">
            Videos that users have allowed to be used in promotional materials
          </p>
        </div>
        <div className="glass-strong px-4 py-2 rounded-xl border border-white/30">
          <p className="text-sm text-gray-300">
            Total Videos: <span className="font-bold text-white">{videos.length}</span>
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl shadow-modern overflow-hidden border border-white/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="glass-strong">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Talent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Request Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {videos.map((video) => {
                const isOnboardingVideo = video.video_type === 'onboarding';
                const talentName = isOnboardingVideo 
                  ? video.talent_name
                  : (video.talent_profiles?.users?.full_name || 
                     video.talent_profiles?.temp_full_name || 
                     'Unknown');
                const customerName = isOnboardingVideo 
                  ? 'N/A (Onboarding)' 
                  : (video.users?.full_name || 'Unknown');

                return (
                  <tr key={`${video.video_type}-${video.id}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <VideoCameraIcon className="h-5 w-5 text-blue-400" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{talentName}</span>
                          {isOnboardingVideo && video.username && (
                            <span className="text-xs text-gray-400">@{video.username}</span>
                          )}
                        </div>
                        {isOnboardingVideo && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Promo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{customerName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300 max-w-xs truncate">
                        {video.request_details}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">
                        {new Date(video.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadWithWatermark(
                            video.video_url,
                            talentName || 'talent',
                            video.id
                          )}
                          disabled={downloadingVideo === video.id}
                          className="flex items-center gap-1 glass-strong px-3 py-1.5 rounded-lg hover:glass transition-all duration-200 text-blue-400 border border-blue-500/30 disabled:opacity-50"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          {downloadingVideo === video.id ? 'Downloading...' : 'Download'}
                        </button>
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 glass-strong px-3 py-1.5 rounded-lg hover:glass transition-all duration-200 text-green-400 border border-green-500/30"
                        >
                          <VideoCameraIcon className="h-4 w-4" />
                          Preview
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {videos.length === 0 && (
            <div className="text-center py-12">
              <VideoCameraIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No promotional videos available yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Videos will appear here when users allow promotional use
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromotionalVideosManagement;

