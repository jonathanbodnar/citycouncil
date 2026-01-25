import React, { useState, useRef, useEffect, useCallback } from 'react';

// Demo video data - using vertical/portrait video samples for reel-style display
// Using Pexels videos with reliable CDN URLs
const DEMO_TALENT_VIDEOS = [
  {
    id: 'demo-1',
    url: 'https://videos.pexels.com/video-files/4536530/4536530-uhd_1440_2560_30fps.mp4',
    thumbnail: 'https://images.pexels.com/videos/4536530/free-video-4536530.jpg?auto=compress&cs=tinysrgb&w=400',
    title: 'Behind the Scenes',
    views: 12400,
    likes: 892,
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    url: 'https://videos.pexels.com/video-files/5529609/5529609-uhd_1440_2560_25fps.mp4',
    thumbnail: 'https://images.pexels.com/videos/5529609/pexels-photo-5529609.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Quick Update',
    views: 8700,
    likes: 654,
    postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-3',
    url: 'https://videos.pexels.com/video-files/4499289/4499289-uhd_1440_2560_30fps.mp4',
    thumbnail: 'https://images.pexels.com/videos/4499289/free-video-4499289.jpg?auto=compress&cs=tinysrgb&w=400',
    title: 'Weekend Vibes',
    views: 15200,
    likes: 1243,
    postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-4',
    url: 'https://videos.pexels.com/video-files/4057411/4057411-uhd_1440_2560_25fps.mp4',
    thumbnail: 'https://images.pexels.com/videos/4057411/free-video-4057411.jpg?auto=compress&cs=tinysrgb&w=400',
    title: 'New Announcement',
    views: 21000,
    likes: 1876,
    postedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-5',
    url: 'https://videos.pexels.com/video-files/5377252/5377252-uhd_1440_2560_25fps.mp4',
    thumbnail: 'https://images.pexels.com/videos/5377252/pexels-photo-5377252.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Story Time',
    views: 9300,
    likes: 721,
    postedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo reply videos - vertical format for reel-style display
// Using Pexels videos with reliable CDN URLs
const DEMO_REPLIES: Record<string, Reply[]> = {
  'demo-1': [
    { id: 'reply-1-1', userId: 'user-1', username: 'Sarah M.', avatarUrl: 'https://i.pravatar.cc/150?img=1', videoUrl: 'https://videos.pexels.com/video-files/6010489/6010489-uhd_1440_2560_25fps.mp4', thumbnail: 'https://images.pexels.com/videos/6010489/pexels-photo-6010489.jpeg?auto=compress&cs=tinysrgb&w=400', upvotes: 45, hasUpvoted: false },
    { id: 'reply-1-2', userId: 'user-2', username: 'Mike T.', avatarUrl: 'https://i.pravatar.cc/150?img=2', videoUrl: 'https://videos.pexels.com/video-files/4443002/4443002-uhd_1440_2560_24fps.mp4', thumbnail: 'https://images.pexels.com/videos/4443002/free-video-4443002.jpg?auto=compress&cs=tinysrgb&w=400', upvotes: 32, hasUpvoted: false },
    { id: 'reply-1-3', userId: 'user-3', username: 'Emma L.', avatarUrl: 'https://i.pravatar.cc/150?img=3', videoUrl: 'https://videos.pexels.com/video-files/5377684/5377684-uhd_1440_2560_25fps.mp4', thumbnail: 'https://images.pexels.com/videos/5377684/pexels-photo-5377684.jpeg?auto=compress&cs=tinysrgb&w=400', upvotes: 28, hasUpvoted: false },
  ],
  'demo-2': [
    { id: 'reply-2-1', userId: 'user-4', username: 'Alex K.', avatarUrl: 'https://i.pravatar.cc/150?img=4', videoUrl: 'https://videos.pexels.com/video-files/4536429/4536429-uhd_1440_2560_30fps.mp4', thumbnail: 'https://images.pexels.com/videos/4536429/free-video-4536429.jpg?auto=compress&cs=tinysrgb&w=400', upvotes: 67, hasUpvoted: false },
    { id: 'reply-2-2', userId: 'user-5', username: 'Jordan P.', avatarUrl: 'https://i.pravatar.cc/150?img=5', videoUrl: 'https://videos.pexels.com/video-files/5496838/5496838-uhd_1440_2560_30fps.mp4', thumbnail: 'https://images.pexels.com/videos/5496838/pexels-photo-5496838.jpeg?auto=compress&cs=tinysrgb&w=400', upvotes: 41, hasUpvoted: false },
  ],
  'demo-3': [
    { id: 'reply-3-1', userId: 'user-6', username: 'Chris B.', avatarUrl: 'https://i.pravatar.cc/150?img=6', videoUrl: 'https://videos.pexels.com/video-files/4057359/4057359-uhd_1440_2560_25fps.mp4', thumbnail: 'https://images.pexels.com/videos/4057359/free-video-4057359.jpg?auto=compress&cs=tinysrgb&w=400', upvotes: 89, hasUpvoted: false },
    { id: 'reply-3-2', userId: 'user-7', username: 'Taylor R.', avatarUrl: 'https://i.pravatar.cc/150?img=7', videoUrl: 'https://videos.pexels.com/video-files/4536418/4536418-uhd_1440_2560_30fps.mp4', thumbnail: 'https://images.pexels.com/videos/4536418/free-video-4536418.jpg?auto=compress&cs=tinysrgb&w=400', upvotes: 56, hasUpvoted: false },
    { id: 'reply-3-3', userId: 'user-8', username: 'Morgan F.', avatarUrl: 'https://i.pravatar.cc/150?img=8', videoUrl: 'https://videos.pexels.com/video-files/4499631/4499631-uhd_1440_2560_30fps.mp4', thumbnail: 'https://images.pexels.com/videos/4499631/free-video-4499631.jpg?auto=compress&cs=tinysrgb&w=400', upvotes: 34, hasUpvoted: false },
    { id: 'reply-3-4', userId: 'user-9', username: 'Riley S.', avatarUrl: 'https://i.pravatar.cc/150?img=9', videoUrl: 'https://videos.pexels.com/video-files/5377549/5377549-uhd_1440_2560_25fps.mp4', thumbnail: 'https://images.pexels.com/videos/5377549/pexels-photo-5377549.jpeg?auto=compress&cs=tinysrgb&w=400', upvotes: 23, hasUpvoted: false },
  ],
  'demo-4': [
    { id: 'reply-4-1', userId: 'user-10', username: 'Jamie W.', avatarUrl: 'https://i.pravatar.cc/150?img=10', videoUrl: 'https://videos.pexels.com/video-files/4536391/4536391-uhd_1440_2560_30fps.mp4', thumbnail: 'https://images.pexels.com/videos/4536391/free-video-4536391.jpg?auto=compress&cs=tinysrgb&w=400', upvotes: 112, hasUpvoted: false },
  ],
  'demo-5': [],
};

interface TalentVideo {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  views: number;
  likes: number;
  postedAt: string;
}

interface Reply {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  videoUrl: string;
  thumbnail: string;
  upvotes: number;
  hasUpvoted: boolean;
}

interface VideoReelsProps {
  talentName: string;
  buttonColor?: string;
}

const VideoReels: React.FC<VideoReelsProps> = ({ talentName, buttonColor = '#3b82f6' }) => {
  const [videos] = useState<TalentVideo[]>(DEMO_TALENT_VIDEOS);
  const [activeIndex, setActiveIndex] = useState(2); // Start in the middle for carousel
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenVideoIndex, setFullScreenVideoIndex] = useState(0);
  const [replies, setReplies] = useState<Record<string, Reply[]>>(DEMO_REPLIES);
  const [horizontalIndex, setHorizontalIndex] = useState(0); // 0 = main video, 1+ = replies, last = add reply
  const [showCameraUI, setShowCameraUI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const carouselRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const replyVideoRef = useRef<HTMLVideoElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Touch tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  // Lock body scroll when fullscreen is open
  useEffect(() => {
    if (isFullScreen || showCameraUI) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isFullScreen, showCameraUI]);

  // Handle carousel scroll
  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    
    const container = carouselRef.current;
    const containerWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const itemWidth = 140;
    const gap = 12;
    
    const centerOffset = scrollLeft + containerWidth / 2;
    const newIndex = Math.round((centerOffset - containerWidth / 2) / (itemWidth + gap));
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
      setActiveIndex(Math.max(0, Math.min(videos.length - 1, newIndex)));
    }
  }, [activeIndex, videos.length]);

  // Scroll to center an item
  const scrollToIndex = useCallback((index: number) => {
    if (!carouselRef.current) return;
    
    const container = carouselRef.current;
    const containerWidth = container.offsetWidth;
    const itemWidth = 140;
    const gap = 12;
    
    const targetScroll = index * (itemWidth + gap) - (containerWidth / 2) + (itemWidth / 2);
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, []);

  // Initialize carousel position
  useEffect(() => {
    scrollToIndex(activeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get current video and replies
  const currentVideo = videos[fullScreenVideoIndex];
  const currentReplies = replies[currentVideo?.id] || [];
  const totalHorizontalSlides = currentReplies.length + 2; // main video + replies + add reply button

  // Navigate vertically (between talent videos)
  const navigateVertical = useCallback((direction: 'up' | 'down') => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    if (direction === 'down' && fullScreenVideoIndex < videos.length - 1) {
      setFullScreenVideoIndex(prev => prev + 1);
      setHorizontalIndex(0); // Reset to main video
    } else if (direction === 'up' && fullScreenVideoIndex > 0) {
      setFullScreenVideoIndex(prev => prev - 1);
      setHorizontalIndex(0); // Reset to main video
    }
    
    setTimeout(() => setIsAnimating(false), 400);
  }, [fullScreenVideoIndex, videos.length, isAnimating]);

  // Navigate horizontally (between main video and replies)
  const navigateHorizontal = useCallback((direction: 'left' | 'right') => {
    if (isAnimating) return;
    
    const currentRepliesCount = (replies[videos[fullScreenVideoIndex]?.id] || []).length;
    const maxIndex = currentRepliesCount + 1; // replies + add reply button
    
    setIsAnimating(true);
    
    if (direction === 'right' && horizontalIndex < maxIndex) {
      const newIndex = horizontalIndex + 1;
      setHorizontalIndex(newIndex);
      // If navigating to add reply button (last position)
      if (newIndex === maxIndex) {
        setTimeout(() => setShowCameraUI(true), 300);
      }
    } else if (direction === 'left' && horizontalIndex > 0) {
      setHorizontalIndex(prev => prev - 1);
    }
    
    setTimeout(() => setIsAnimating(false), 400);
  }, [horizontalIndex, fullScreenVideoIndex, videos, replies, isAnimating]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;
    
    // Require minimum swipe distance and speed
    const minSwipeDistance = 50;
    const maxSwipeTime = 300;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Determine if swipe is primarily horizontal or vertical
    if (absX > absY && absX > minSwipeDistance && deltaTime < maxSwipeTime) {
      // Horizontal swipe
      if (deltaX > 0) {
        navigateHorizontal('left'); // Swipe right = go left
      } else {
        navigateHorizontal('right'); // Swipe left = go right
      }
    } else if (absY > absX && absY > minSwipeDistance && deltaTime < maxSwipeTime) {
      // Vertical swipe
      if (deltaY > 0) {
        navigateVertical('up'); // Swipe down = go up
      } else {
        navigateVertical('down'); // Swipe up = go down
      }
    }
  };

  // Wheel handler for desktop
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    
    if (absY > absX && absY > 30) {
      if (e.deltaY > 0) {
        navigateVertical('down');
      } else {
        navigateVertical('up');
      }
    } else if (absX > absY && absX > 30) {
      if (e.deltaX > 0) {
        navigateHorizontal('right');
      } else {
        navigateHorizontal('left');
      }
    }
  }, [navigateVertical, navigateHorizontal]);

  // Open video in full screen mode
  const openFullScreen = (index: number) => {
    setFullScreenVideoIndex(index);
    setIsFullScreen(true);
    setHorizontalIndex(0);
  };

  // Close full screen
  const closeFullScreen = () => {
    setIsFullScreen(false);
    setHorizontalIndex(0);
    if (mainVideoRef.current) {
      mainVideoRef.current.pause();
    }
    if (replyVideoRef.current) {
      replyVideoRef.current.pause();
    }
  };

  // Handle upvote
  const handleUpvote = (videoId: string, replyId: string) => {
    setReplies(prev => ({
      ...prev,
      [videoId]: prev[videoId]?.map(reply => 
        reply.id === replyId 
          ? { ...reply, upvotes: reply.hasUpvoted ? reply.upvotes - 1 : reply.upvotes + 1, hasUpvoted: !reply.hasUpvoted }
          : reply
      ).sort((a, b) => b.upvotes - a.upvotes) || []
    }));
  };

  // Start recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setShowCameraUI(false);
    setRecordingTime(0);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format views
  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  // Get opacity based on distance from center
  const getOpacity = (index: number) => {
    const distance = Math.abs(index - activeIndex);
    if (distance === 0) return 1;
    if (distance === 1) return 0.6;
    if (distance === 2) return 0.3;
    return 0.15;
  };

  // Get scale based on distance from center
  const getScale = (index: number) => {
    const distance = Math.abs(index - activeIndex);
    if (distance === 0) return 1.15;
    if (distance === 1) return 0.95;
    return 0.85;
  };

  // Get z-index based on distance from center
  const getZIndex = (index: number) => {
    return videos.length - Math.abs(index - activeIndex);
  };

  if (videos.length === 0) return null;

  return (
    <>
      {/* Carousel Section */}
      <div className="mt-8 w-full">
        <div className="flex items-center gap-2 mb-3 px-1">
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-white/60 text-sm font-medium">Videos from {talentName}</span>
        </div>
        
        {/* Carousel Container */}
        <div 
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide py-4 px-2"
          style={{ 
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          }}
          onScroll={handleCarouselScroll}
        >
          <div className="flex-shrink-0" style={{ width: 'calc(50% - 70px)' }} />
          
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="flex-shrink-0 cursor-pointer transition-all duration-300 ease-out"
              style={{
                width: '140px',
                height: '200px',
                scrollSnapAlign: 'center',
                opacity: getOpacity(index),
                transform: `scale(${getScale(index)})`,
                zIndex: getZIndex(index),
                marginLeft: index === 0 ? 0 : '-20px',
              }}
              onClick={() => {
                if (index === activeIndex) {
                  openFullScreen(index);
                } else {
                  scrollToIndex(index);
                  setActiveIndex(index);
                }
              }}
            >
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black/40 border border-white/10 shadow-xl">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
                    style={{ backgroundColor: `${buttonColor}80` }}
                  >
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {index === activeIndex && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-xs font-medium truncate">{video.title}</p>
                    <p className="text-white/60 text-[10px]">{formatViews(video.views)} views</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div className="flex-shrink-0" style={{ width: 'calc(50% - 70px)' }} />
        </div>
        
        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 mt-2">
          {videos.map((_, index) => (
            <button
              key={index}
              className="transition-all duration-300"
              style={{
                width: index === activeIndex ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: index === activeIndex ? buttonColor : 'rgba(255,255,255,0.3)',
              }}
              onClick={() => {
                scrollToIndex(index);
                setActiveIndex(index);
              }}
            />
          ))}
        </div>
      </div>

      {/* Full Screen Video View */}
      {isFullScreen && (
        <div 
          className="fixed inset-0 z-50 bg-black overflow-hidden touch-none"
          style={{ paddingTop: '60px' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* Close button */}
          <button
            onClick={closeFullScreen}
            className="absolute top-16 right-4 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Horizontal position indicator */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
            {Array.from({ length: totalHorizontalSlides }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-300"
                style={{
                  width: i === horizontalIndex ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: i === horizontalIndex ? buttonColor : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>

          {/* Video counter */}
          <div className="absolute top-20 left-4 z-50 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-sm">
              {fullScreenVideoIndex + 1} / {videos.length}
            </span>
          </div>

          {/* Horizontal slide container */}
          <div 
            className="relative w-full h-full transition-transform duration-400 ease-out"
            style={{
              transform: `translateX(-${horizontalIndex * 100}%)`,
            }}
          >
            {/* Main Talent Video (position 0) */}
            <div 
              className="absolute inset-0 flex items-center justify-center p-4"
              style={{ left: '0%' }}
            >
              <div className="relative w-full h-full max-w-md mx-auto">
                <video
                  ref={mainVideoRef}
                  src={currentVideo?.url}
                  className="w-full h-full object-cover rounded-3xl"
                  autoPlay={horizontalIndex === 0}
                  loop
                  playsInline
                  muted={horizontalIndex !== 0}
                  onClick={() => {
                    if (mainVideoRef.current) {
                      if (mainVideoRef.current.paused) {
                        mainVideoRef.current.play();
                      } else {
                        mainVideoRef.current.pause();
                      }
                    }
                  }}
                />
                
                {/* Video Info Overlay */}
                <div className="absolute bottom-8 left-4 right-16">
                  <h3 className="text-white text-xl font-bold mb-1">{currentVideo?.title}</h3>
                  <p className="text-white/60 text-sm">{formatViews(currentVideo?.views || 0)} views</p>
                </div>

                {/* Side actions */}
                <div className="absolute right-4 bottom-8 flex flex-col gap-4">
                  <button className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </div>
                    <span className="text-white text-xs">{formatViews(currentVideo?.likes || 0)}</span>
                  </button>
                  <button 
                    className="flex flex-col items-center gap-1"
                    onClick={() => navigateHorizontal('right')}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-white text-xs">{currentReplies.length}</span>
                  </button>
                  <button className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </div>
                    <span className="text-white text-xs">Share</span>
                  </button>
                </div>

                {/* Swipe hints */}
                {currentReplies.length > 0 && horizontalIndex === 0 && (
                  <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1 animate-pulse">
                    <span className="text-white/60 text-xs">Replies</span>
                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Reply Videos */}
            {currentReplies.map((reply, index) => (
              <div 
                key={reply.id}
                className="absolute inset-0 flex items-center justify-center p-4"
                style={{ left: `${(index + 1) * 100}%` }}
              >
                <div className="relative w-full h-full max-w-md mx-auto">
                  <video
                    ref={index === horizontalIndex - 1 ? replyVideoRef : undefined}
                    src={reply.videoUrl}
                    className="w-full h-full object-cover rounded-3xl"
                    autoPlay={horizontalIndex === index + 1}
                    loop
                    playsInline
                    muted={horizontalIndex !== index + 1}
                  />
                  
                  {/* Reply user info */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <img 
                      src={reply.avatarUrl} 
                      alt="" 
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-white text-sm font-medium">
                      {reply.username}
                    </span>
                    <span className="text-white/40 text-xs">replied</span>
                  </div>

                  {/* Upvote button */}
                  <div className="absolute right-4 bottom-8 flex flex-col gap-4">
                    <button 
                      className="flex flex-col items-center gap-1"
                      onClick={() => handleUpvote(currentVideo.id, reply.id)}
                    >
                      <div 
                        className="w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors"
                        style={{ 
                          backgroundColor: reply.hasUpvoted ? buttonColor : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </div>
                      <span className="text-white text-xs">{reply.upvotes}</span>
                    </button>
                  </div>

                  {/* Navigation hint */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
                    <span className="text-white/60 text-xs">
                      Reply {index + 1} of {currentReplies.length}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Reply Slide */}
            <div 
              className="absolute inset-0 flex items-center justify-center p-4"
              style={{ left: `${(currentReplies.length + 1) * 100}%` }}
            >
              <div className="relative w-full h-full max-w-md mx-auto flex items-center justify-center">
                <div 
                  className="w-64 h-80 rounded-3xl flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/30"
                  style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}
                  onClick={() => setShowCameraUI(true)}
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: buttonColor }}
                  >
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Record a Reply</p>
                    <p className="text-white/60 text-sm mt-1">Share your thoughts with {talentName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vertical scroll indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-50">
            {fullScreenVideoIndex < videos.length - 1 && (
              <div className="animate-bounce">
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera UI */}
      {showCameraUI && (
        <div className="fixed inset-0 z-[60] bg-black touch-none">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-12 h-12 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white/60 text-sm">Camera preview</p>
              <p className="text-white/40 text-xs mt-1">(Demo mode)</p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowCameraUI(false);
              setIsRecording(false);
              if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
              }
            }}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/80 backdrop-blur-sm rounded-full px-4 py-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white font-medium">{formatTime(recordingTime)}</span>
            </div>
          )}

          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
            <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300"
              style={{ 
                backgroundColor: isRecording ? 'white' : 'transparent',
                border: `4px solid ${isRecording ? 'white' : buttonColor}`,
              }}
            >
              <div 
                className="transition-all duration-300"
                style={{
                  width: isRecording ? '28px' : '60px',
                  height: isRecording ? '28px' : '60px',
                  borderRadius: isRecording ? '6px' : '50%',
                  backgroundColor: isRecording ? '#ef4444' : buttonColor,
                }}
              />
            </button>

            <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </button>
          </div>

          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-white/80 text-sm">Replying to {talentName}'s video</span>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default VideoReels;
