import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import ReelsVideoPlayer from '../components/ReelsVideoPlayer';
import TalentPanel from '../components/TalentPanel';
import OrdersPanel from '../components/OrdersPanel';
import ProfilePanel from '../components/ProfilePanel';
import Logo from '../components/Logo';
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
  order_id?: string; // For tracking real likes
}

type PanelView = 'feed' | 'talent' | 'orders' | 'profile';

const DemoPage: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoFeedItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentPanel, setCurrentPanel] = useState<PanelView>('feed');
  const [loading, setLoading] = useState(true);
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide swipe indicator after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeIndicator(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Handle initial user interaction for autoplay
  const handleInitialInteraction = () => {
    setUserInteracted(true);
  };

  // Shuffle videos ensuring no back-to-back repeats of same talent
  const shuffleWithoutBackToBack = (items: VideoFeedItem[]): VideoFeedItem[] => {
    if (items.length <= 1) return items;
    
    // First, do a random shuffle
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    
    // Then fix any back-to-back duplicates
    const result: VideoFeedItem[] = [shuffled[0]];
    const remaining = shuffled.slice(1);
    
    while (remaining.length > 0) {
      const lastTalentId = result[result.length - 1].talent.id;
      
      // Find the first video that's not from the same talent
      const nextIndex = remaining.findIndex(v => v.talent.id !== lastTalentId);
      
      if (nextIndex === -1) {
        // All remaining videos are from the same talent
        // Just add them (unavoidable if we only have one talent's videos left)
        result.push(...remaining);
        break;
      }
      
      // Add the different talent's video and remove it from remaining
      result.push(remaining[nextIndex]);
      remaining.splice(nextIndex, 1);
    }
    
    return result;
  };

  useEffect(() => {
    fetchVideosAndTalent();
  }, []);

  const fetchVideosAndTalent = async () => {
    try {
      setLoading(true);

      // Fetch all talent profiles
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

      // Fetch promotional videos with real like counts
      // 1. Get completed orders with promotional use allowed
      const { data: orderVideos, error: orderError, count } = await supabase
        .from('orders')
        .select(`
          id,
          video_url,
          talent_id,
          like_count,
          talent_profiles!orders_talent_id_fkey (
            *,
            users!talent_profiles_user_id_fkey (
              id,
              full_name,
              avatar_url
            )
          )
        `, { count: 'exact' })
        .eq('status', 'completed')
        .eq('allow_promotional_use', true)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000); // Set explicit high limit

      if (orderError) throw orderError;
      
      console.log(`Loaded ${orderVideos?.length || 0} order videos out of ${count} total promotional orders`);

      // 2. Get talent promo videos
      const videoItems: VideoFeedItem[] = [];
      
      // Add promo videos from talent profiles (use total_orders as proxy for popularity)
      talentWithUsers.forEach((talentProfile: any) => {
        if (talentProfile.promo_video_url) {
          videoItems.push({
            id: `promo-${talentProfile.id}`,
            video_url: talentProfile.promo_video_url,
            talent: talentProfile,
            likes: talentProfile.total_orders || 0,
            isLiked: false,
          });
        }
      });

      // Add order videos with real like counts
      (orderVideos || []).forEach((order: any) => {
        const talentProfile = order.talent_profiles;
        if (talentProfile) {
          videoItems.push({
            id: order.id,
            order_id: order.id,
            video_url: order.video_url,
            talent: {
              ...talentProfile,
              users: talentProfile.users || {
                id: talentProfile.user_id,
                full_name: talentProfile.temp_full_name || 'Unknown',
                avatar_url: talentProfile.temp_avatar_url,
              },
            },
            likes: order.like_count || 0,
            isLiked: false,
          });
        }
      });

      console.log(`Total video items before shuffle: ${videoItems.length}`);
      console.log(`Promo videos: ${talentWithUsers.filter(t => t.promo_video_url).length}`);
      console.log(`Order videos: ${orderVideos?.length || 0}`);
      
      // Shuffle videos while preventing same talent back-to-back
      const shuffledVideos = shuffleWithoutBackToBack(videoItems);
      setVideos(shuffledVideos);
      
      console.log(`Final shuffled videos: ${shuffledVideos.length}`);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const isCurrentlyLiked = video.isLiked;
    const newLikeCount = isCurrentlyLiked ? video.likes - 1 : video.likes + 1;

    // Optimistically update UI
    setVideos(prev =>
      prev.map(v =>
        v.id === videoId
          ? {
              ...v,
              isLiked: !isCurrentlyLiked,
              likes: newLikeCount,
            }
          : v
      )
    );

    // Save to database if it's an order video (not a promo video)
    if (video.order_id) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ like_count: newLikeCount })
          .eq('id', video.order_id);

        if (error) {
          console.error('Error updating like count:', error);
          // Revert optimistic update on error
          setVideos(prev =>
            prev.map(v =>
              v.id === videoId
                ? {
                    ...v,
                    isLiked: isCurrentlyLiked,
                    likes: video.likes,
                  }
                : v
            )
          );
          toast.error('Failed to save like');
        }
      } catch (error) {
        console.error('Error saving like:', error);
        // Revert on error
        setVideos(prev =>
          prev.map(v =>
            v.id === videoId
              ? {
                  ...v,
                  isLiked: isCurrentlyLiked,
                  likes: video.likes,
                }
              : v
          )
        );
      }
    }
    // For promo videos (no order_id), we could store in a separate table
    // For now, just update locally without persisting
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't start swipe tracking if touching the talent circles
    const target = e.target as HTMLElement;
    if (target.closest('.talent-circles-container')) {
      return;
    }
    
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Don't process swipe if touching the talent circles
    const target = e.target as HTMLElement;
    if (target.closest('.talent-circles-container')) {
      return;
    }
    
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
      className="fixed inset-0 overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom right, #a70809, #3c108b)',
        height: '100vh',
        width: '100vw',
        touchAction: 'none'
      }}
      onTouchStart={(e) => {
        handleInitialInteraction();
        handleTouchStart(e);
      }}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onClick={handleInitialInteraction}
    >
      {/* Initial tap prompt for autoplay with sound */}
      {!userInteracted && !loading && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleInitialInteraction}
        >
          <div className="text-center px-6 py-8 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20">
            <div className="text-white text-2xl font-bold mb-2">
              Tap to Start
            </div>
            <div className="text-white/80 text-sm">
              Enable sound and video playback
            </div>
          </div>
        </div>
      )}
      {/* Top Navigation Menu */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between p-4">
          <Logo size="sm" theme="dark" />
          
          {/* Tab indicators */}
          <div className="flex gap-4 text-sm">
            <button
              onClick={() => setCurrentPanel('feed')}
              className={`px-3 py-1 rounded-full transition-colors ${
                currentPanel === 'feed'
                  ? 'bg-white text-black font-bold'
                  : 'text-white/60'
              }`}
            >
              feed
            </button>
            <button
              onClick={() => setCurrentPanel('talent')}
              className={`px-3 py-1 rounded-full transition-colors ${
                currentPanel === 'talent'
                  ? 'bg-white text-black font-bold'
                  : 'text-white/60'
              }`}
            >
              voices
            </button>
            <button
              onClick={() => setCurrentPanel('orders')}
              className={`px-3 py-1 rounded-full transition-colors ${
                currentPanel === 'orders'
                  ? 'bg-white text-black font-bold'
                  : 'text-white/60'
              }`}
            >
              orders
            </button>
          </div>
        </div>
      </div>

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
        <div className="w-screen h-full relative flex-shrink-0 flex items-start justify-center pt-16">
          {currentVideo && (
            <div className="relative w-full h-full max-w-md mx-auto">
              {/* Video Container - Bordered and contained */}
              <div 
                className="relative rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl mx-auto"
                style={{
                  width: '90%',
                  maxWidth: '500px',
                  height: 'calc(100vh - 160px)',
                  maxHeight: '800px'
                }}
              >
                <ReelsVideoPlayer
                  videoUrl={currentVideo.video_url}
                  isActive={currentPanel === 'feed' && userInteracted}
                />

                {/* Overlay UI */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top right - Talent name */}
                  <div className="absolute top-4 right-4 text-right pointer-events-none">
                    <div className="text-white font-bold text-lg drop-shadow-lg">
                      {currentVideo.talent.temp_full_name ||
                        currentVideo.talent.users.full_name}
                    </div>
                    {currentVideo.talent.position && (
                      <div className="text-white/90 text-sm drop-shadow-lg">
                        {currentVideo.talent.position}
                      </div>
                    )}
                  </div>

                  {/* Center - Swipe indicator (fades out after 5 seconds) */}
                  {showSwipeIndicator && (
                    <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000">
                      <div className="text-white/30 text-center animate-bounce">
                        <div className="text-4xl mb-2">↑</div>
                        <div className="text-sm">swipe up</div>
                      </div>
                    </div>
                  )}

                  {/* Right side actions */}
                  <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 pointer-events-auto z-10">
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

                    {/* Talent avatar - links to profile */}
                    <Link
                      to={`/${currentVideo.talent.username || currentVideo.talent.id}`}
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
                    </Link>
                  </div>

                  {/* Bottom CTA */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none pb-6">
                    <div className="text-white flex justify-center">
                      <Link
                        to={`/${currentVideo.talent.username || currentVideo.talent.id}`}
                        className="relative bg-white/20 backdrop-blur-lg border border-white/30 rounded-full px-6 py-3 text-center font-bold text-base inline-flex items-center gap-3 pointer-events-auto hover:bg-white/30 transition-all shadow-2xl hover:scale-105"
                      >
                        <span className="text-white drop-shadow-lg">Order Personalized Video</span>
                        <span className="bg-white/90 text-black px-3 py-1 rounded-full text-sm font-black shadow-lg">
                          ${currentVideo.talent.pricing}
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Talent circles - positioned below video container */}
              <div className="absolute bottom-4 left-0 right-0 px-4 z-20 talent-circles-container pointer-events-auto">
                <div 
                  className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 scroll-smooth justify-center"
                  style={{ touchAction: 'pan-x' }}
                >
                  {talent.map(t => (
                    <Link
                      key={t.id}
                      to={`/${t.username || t.id}`}
                      className="flex-shrink-0"
                    >
                      <img
                        src={
                          t.temp_avatar_url ||
                          t.users.avatar_url ||
                          '/default-avatar.png'
                        }
                        alt={t.temp_full_name || t.users.full_name}
                        className="w-16 h-16 rounded-full border-3 border-white/90 object-cover hover:border-blue-400 hover:scale-110 transition-all shadow-xl"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
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

