import React, { useState, useEffect, useRef } from 'react';
import { HeartIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import ReelsVideoPlayer from '../components/ReelsVideoPlayer';
import TalentPanel from '../components/TalentPanel';
import OrdersPanel from '../components/OrdersPanel';
import ProfilePanel from '../components/ProfilePanel';
import toast from 'react-hot-toast';

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface VideoFeedItem {
  id: string;
  video_url: string;
  talent: TalentWithUser;
  likes: number;
  isLiked: boolean;
}

type PanelView = 'feed' | 'talent' | 'orders' | 'profile';

const DemoPage: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoFeedItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentPanel, setCurrentPanel] = useState<PanelView>('feed');
  const [loading, setLoading] = useState(true);
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideosAndTalent();
  }, []);

  const fetchVideosAndTalent = async () => {
    try {
      setLoading(true);

      // Fetch all talent profiles with their recent videos
      const { data: talentData, error: talentError } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true, nullsFirst: false });

      if (talentError) throw talentError;

      const talentWithUsers = (talentData || []).map(profile => {
        if (!profile.users) {
          return {
            ...profile,
            users: {
              id: profile.user_id || '',
              full_name: profile.temp_full_name || 'Unknown',
              avatar_url: profile.temp_avatar_url || null,
            },
          };
        }
        return profile;
      });

      setTalent(talentWithUsers);

      // Create video feed from talent's recent_videos and promo_video_url
      const videoItems: VideoFeedItem[] = [];
      
      talentWithUsers.forEach((talentProfile: any) => {
        // Add promo video if exists
        if (talentProfile.promo_video_url) {
          videoItems.push({
            id: `promo-${talentProfile.id}`,
            video_url: talentProfile.promo_video_url,
            talent: talentProfile,
            likes: Math.floor(Math.random() * 500) + 50,
            isLiked: false,
          });
        }

        // Add recent videos if they exist
        if (talentProfile.recent_videos && Array.isArray(talentProfile.recent_videos)) {
          talentProfile.recent_videos.forEach((videoUrl: string, index: number) => {
            if (videoUrl) {
              videoItems.push({
                id: `recent-${talentProfile.id}-${index}`,
                video_url: videoUrl,
                talent: talentProfile,
                likes: Math.floor(Math.random() * 500) + 50,
                isLiked: false,
              });
            }
          });
        }
      });

      // Shuffle videos for variety
      const shuffledVideos = videoItems.sort(() => Math.random() - 0.5);
      setVideos(shuffledVideos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = (videoId: string) => {
    setVideos(prev =>
      prev.map(video =>
        video.id === videoId
          ? {
              ...video,
              isLiked: !video.isLiked,
              likes: video.isLiked ? video.likes - 1 : video.likes + 1,
            }
          : video
      )
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Determine if swipe is more horizontal or vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > 50) {
        handleHorizontalSwipe(deltaX);
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > 50) {
        handleVerticalSwipe(deltaY);
      }
    }
  };

  const handleHorizontalSwipe = (deltaX: number) => {
    if (deltaX < 0) {
      // Swipe left - go to next panel
      switch (currentPanel) {
        case 'feed':
          setCurrentPanel('talent');
          break;
        case 'talent':
          setCurrentPanel('orders');
          break;
        case 'orders':
          setCurrentPanel('profile');
          break;
      }
    } else {
      // Swipe right - go to previous panel
      switch (currentPanel) {
        case 'profile':
          setCurrentPanel('orders');
          break;
        case 'orders':
          setCurrentPanel('talent');
          break;
        case 'talent':
          setCurrentPanel('feed');
          break;
      }
    }
  };

  const handleVerticalSwipe = (deltaY: number) => {
    // Only handle vertical swipes in feed view
    if (currentPanel !== 'feed') return;

    if (deltaY < 0) {
      // Swipe up - next video
      setCurrentVideoIndex(prev =>
        prev < videos.length - 1 ? prev + 1 : prev
      );
    } else {
      // Swipe down - previous video
      setCurrentVideoIndex(prev => (prev > 0 ? prev - 1 : 0));
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Handle mouse wheel for desktop - only in feed view
    if (currentPanel !== 'feed') return;
    
    e.preventDefault();
    if (e.deltaY > 0) {
      // Scroll down - next video
      setCurrentVideoIndex(prev =>
        prev < videos.length - 1 ? prev + 1 : prev
      );
    } else {
      // Scroll up - previous video
      setCurrentVideoIndex(prev => (prev > 0 ? prev - 1 : 0));
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-red-900">
        <div className="text-center p-8">
          <div className="text-white text-2xl font-bold mb-4">No videos available yet</div>
          <p className="text-white/60 mb-6">Check back soon for amazing content!</p>
          <a
            href="/home"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-700 transition-colors"
          >
            Browse Talent
          </a>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentVideoIndex];

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-black overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Main content area - slides horizontally */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${
            currentPanel === 'feed'
              ? 0
              : currentPanel === 'talent'
              ? 100
              : currentPanel === 'orders'
              ? 200
              : 300
          }vw)`,
          width: '400vw',
        }}
      >
        {/* Feed Panel */}
        <div className="w-screen h-full relative flex-shrink-0">
          {currentVideo && (
            <>
              <ReelsVideoPlayer
                videoUrl={currentVideo.video_url}
                isActive={currentPanel === 'feed'}
              />

              {/* Overlay UI */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Top Info */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                      </svg>
                      <span className="text-white text-xl font-bold">ShoutOut</span>
                    </div>
                    <div className="text-white text-sm">
                      {currentVideoIndex + 1} / {videos.length}
                    </div>
                  </div>
                </div>

                {/* Center - Swipe indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white/30 text-center animate-bounce">
                    <div className="text-4xl mb-2">↑</div>
                    <div className="text-sm">swipe up</div>
                  </div>
                </div>

                {/* Right side actions */}
                <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 pointer-events-auto">
                  {/* Like button */}
                  <button
                    onClick={() => handleLike(currentVideo.id)}
                    className="flex flex-col items-center"
                  >
                    {currentVideo.isLiked ? (
                      <HeartIcon className="w-10 h-10 text-red-500 drop-shadow-lg animate-pulse" />
                    ) : (
                      <HeartOutline className="w-10 h-10 text-white drop-shadow-lg" />
                    )}
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-lg">
                      {currentVideo.likes}
                    </span>
                  </button>

                  {/* Talent avatar */}
                  <button
                    onClick={() => setCurrentPanel('talent')}
                    className="relative"
                  >
                    <img
                      src={
                        currentVideo.talent.temp_avatar_url ||
                        currentVideo.talent.users.avatar_url ||
                        '/default-avatar.png'
                      }
                      alt={
                        currentVideo.talent.temp_full_name ||
                        currentVideo.talent.users.full_name
                      }
                      className="w-12 h-12 rounded-full border-2 border-white object-cover"
                    />
                  </button>
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                  <div className="text-white">
                    <div className="font-bold mb-1">
                      {currentVideo.talent.temp_full_name ||
                        currentVideo.talent.users.full_name}
                    </div>
                    <div className="text-sm text-white/80 mb-3">
                      {currentVideo.talent.position || currentVideo.talent.bio}
                    </div>
                    <div className="bg-blue-600/80 backdrop-blur-sm rounded-full px-6 py-3 text-center font-bold text-lg inline-block">
                      Order now: {currentVideo.talent.temp_full_name ||
                        currentVideo.talent.users.full_name} - $
                      {currentVideo.talent.pricing}
                    </div>
                  </div>
                </div>

                {/* Talent circles at bottom - Fixed positioning */}
                <div className="absolute bottom-32 left-0 right-0 px-4 pointer-events-auto">
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                    {talent.slice(0, 10).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setCurrentPanel('talent')}
                        className="flex-shrink-0"
                      >
                        <img
                          src={
                            t.temp_avatar_url ||
                            t.users.avatar_url ||
                            '/default-avatar.png'
                          }
                          alt={t.temp_full_name || t.users.full_name}
                          className="w-14 h-14 rounded-full border-2 border-white/50 object-cover hover:border-blue-500 transition-colors"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Talent Panel */}
        <div className="w-screen h-full flex-shrink-0">
          <TalentPanel
            talent={talent}
            onBack={() => setCurrentPanel('feed')}
            onNext={() => setCurrentPanel('orders')}
          />
        </div>

        {/* Orders Panel */}
        <div className="w-screen h-full flex-shrink-0">
          <OrdersPanel
            onBack={() => setCurrentPanel('talent')}
            onNext={() => setCurrentPanel('profile')}
          />
        </div>

        {/* Profile Panel */}
        <div className="w-screen h-full flex-shrink-0">
          <ProfilePanel onBack={() => setCurrentPanel('orders')} />
        </div>
      </div>
    </div>
  );
};

export default DemoPage;

