import React, { useState, useRef, useEffect, useCallback } from 'react';

// Demo video data - using sample video URLs
const DEMO_TALENT_VIDEOS = [
  {
    id: 'demo-1',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
    title: 'Behind the Scenes',
    views: 12400,
    likes: 892,
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
    title: 'Quick Update',
    views: 8700,
    likes: 654,
    postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-3',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
    title: 'Weekend Vibes',
    views: 15200,
    likes: 1243,
    postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-4',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg',
    title: 'New Announcement',
    views: 21000,
    likes: 1876,
    postedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-5',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg',
    title: 'Story Time',
    views: 9300,
    likes: 721,
    postedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo reply videos
const DEMO_REPLIES: Record<string, Reply[]> = {
  'demo-1': [
    { id: 'reply-1-1', userId: 'user-1', username: 'Sarah M.', avatarUrl: 'https://i.pravatar.cc/150?img=1', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/WeAreGoingOnBullrun.jpg', upvotes: 45, hasUpvoted: false },
    { id: 'reply-1-2', userId: 'user-2', username: 'Mike T.', avatarUrl: 'https://i.pravatar.cc/150?img=2', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/VolkswagenGTIReview.jpg', upvotes: 32, hasUpvoted: false },
    { id: 'reply-1-3', userId: 'user-3', username: 'Emma L.', avatarUrl: 'https://i.pravatar.cc/150?img=3', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/WhatCarCanYouGetForAGrand.jpg', upvotes: 28, hasUpvoted: false },
  ],
  'demo-2': [
    { id: 'reply-2-1', userId: 'user-4', username: 'Alex K.', avatarUrl: 'https://i.pravatar.cc/150?img=4', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg', upvotes: 67, hasUpvoted: false },
    { id: 'reply-2-2', userId: 'user-5', username: 'Jordan P.', avatarUrl: 'https://i.pravatar.cc/150?img=5', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg', upvotes: 41, hasUpvoted: false },
  ],
  'demo-3': [
    { id: 'reply-3-1', userId: 'user-6', username: 'Chris B.', avatarUrl: 'https://i.pravatar.cc/150?img=6', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg', upvotes: 89, hasUpvoted: false },
    { id: 'reply-3-2', userId: 'user-7', username: 'Taylor R.', avatarUrl: 'https://i.pravatar.cc/150?img=7', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg', upvotes: 56, hasUpvoted: false },
    { id: 'reply-3-3', userId: 'user-8', username: 'Morgan F.', avatarUrl: 'https://i.pravatar.cc/150?img=8', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg', upvotes: 34, hasUpvoted: false },
    { id: 'reply-3-4', userId: 'user-9', username: 'Riley S.', avatarUrl: 'https://i.pravatar.cc/150?img=9', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg', upvotes: 23, hasUpvoted: false },
  ],
  'demo-4': [
    { id: 'reply-4-1', userId: 'user-10', username: 'Jamie W.', avatarUrl: 'https://i.pravatar.cc/150?img=10', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg', upvotes: 112, hasUpvoted: false },
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
  const [activeIndex, setActiveIndex] = useState(2); // Start in the middle
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenVideoIndex, setFullScreenVideoIndex] = useState(0);
  const [replies, setReplies] = useState<Record<string, Reply[]>>(DEMO_REPLIES);
  const [activeReplyIndex, setActiveReplyIndex] = useState(0);
  const [isPlayingReply, setIsPlayingReply] = useState(false);
  const [showCameraUI, setShowCameraUI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const carouselRef = useRef<HTMLDivElement>(null);
  const fullScreenRef = useRef<HTMLDivElement>(null);
  const replyCarouselRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const replyVideoRef = useRef<HTMLVideoElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle carousel scroll
  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    
    const container = carouselRef.current;
    const containerWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const itemWidth = 140; // Width of each video item
    const gap = 12;
    
    // Calculate which item is closest to center
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

  // Handle full-screen vertical scroll
  const handleFullScreenScroll = useCallback((e: React.WheelEvent | React.TouchEvent) => {
    if (isPlayingReply) return;
    
    let deltaY = 0;
    if ('deltaY' in e) {
      deltaY = e.deltaY;
    }
    
    if (deltaY > 50 && fullScreenVideoIndex < videos.length - 1) {
      setFullScreenVideoIndex(prev => prev + 1);
      setActiveReplyIndex(0);
    } else if (deltaY < -50 && fullScreenVideoIndex > 0) {
      setFullScreenVideoIndex(prev => prev - 1);
      setActiveReplyIndex(0);
    }
  }, [fullScreenVideoIndex, videos.length, isPlayingReply]);

  // Touch handling for mobile
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPlayingReply) return;
    
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (deltaY > 50 && fullScreenVideoIndex < videos.length - 1) {
      setFullScreenVideoIndex(prev => prev + 1);
      setActiveReplyIndex(0);
    } else if (deltaY < -50 && fullScreenVideoIndex > 0) {
      setFullScreenVideoIndex(prev => prev - 1);
      setActiveReplyIndex(0);
    }
  };

  // Handle reply carousel scroll
  const handleReplyScroll = useCallback(() => {
    if (!replyCarouselRef.current) return;
    
    const container = replyCarouselRef.current;
    const scrollLeft = container.scrollLeft;
    const itemWidth = 80;
    const gap = 8;
    
    const newIndex = Math.round(scrollLeft / (itemWidth + gap));
    const currentReplies = replies[videos[fullScreenVideoIndex]?.id] || [];
    
    if (newIndex !== activeReplyIndex && newIndex >= 0 && newIndex <= currentReplies.length) {
      setActiveReplyIndex(newIndex);
    }
  }, [activeReplyIndex, replies, videos, fullScreenVideoIndex]);

  // Open video in full screen mode
  const openFullScreen = (index: number) => {
    setFullScreenVideoIndex(index);
    setIsFullScreen(true);
    setActiveReplyIndex(0);
    setIsPlayingReply(false);
  };

  // Close full screen
  const closeFullScreen = () => {
    setIsFullScreen(false);
    setIsPlayingReply(false);
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

  // Play reply video
  const playReply = (replyIndex: number) => {
    setActiveReplyIndex(replyIndex);
    setIsPlayingReply(true);
    if (mainVideoRef.current) {
      mainVideoRef.current.pause();
    }
  };

  // Back to main video from reply
  const backToMainVideo = () => {
    setIsPlayingReply(false);
    if (replyVideoRef.current) {
      replyVideoRef.current.pause();
    }
    if (mainVideoRef.current) {
      mainVideoRef.current.play();
    }
  };

  // Open camera UI
  const openCamera = () => {
    setShowCameraUI(true);
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
    // In a real app, this would save the video
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

  const currentVideo = videos[fullScreenVideoIndex];
  const currentReplies = replies[currentVideo?.id] || [];

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
          {/* Spacer for centering */}
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
                marginLeft: index === 0 ? 0 : '-20px', // Overlap effect
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
                {/* Play button overlay */}
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
                {/* Video info */}
                {index === activeIndex && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-xs font-medium truncate">{video.title}</p>
                    <p className="text-white/60 text-[10px]">{formatViews(video.views)} views</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Spacer for centering */}
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
          className="fixed inset-0 z-50 bg-black"
          style={{ paddingTop: '60px' }} // Account for header
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

          {/* Video container */}
          <div
            ref={fullScreenRef}
            className="relative w-full h-full overflow-hidden"
            onWheel={handleFullScreenScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Main Video */}
            <div 
              className="absolute inset-0 transition-transform duration-500 ease-out"
              style={{
                transform: isPlayingReply ? 'scale(0.85) translateY(-10%)' : 'scale(1)',
                opacity: isPlayingReply ? 0.3 : 1,
              }}
            >
              <video
                ref={mainVideoRef}
                src={currentVideo?.url}
                className="w-full h-full object-cover rounded-3xl"
                autoPlay
                loop
                playsInline
                muted={isPlayingReply}
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
              <div className="absolute bottom-32 left-4 right-4">
                <h3 className="text-white text-xl font-bold mb-1">{currentVideo?.title}</h3>
                <p className="text-white/60 text-sm">{formatViews(currentVideo?.views || 0)} views</p>
              </div>

              {/* Side actions */}
              <div className="absolute right-4 bottom-40 flex flex-col gap-4">
                <button className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </div>
                  <span className="text-white text-xs">{formatViews(currentVideo?.likes || 0)}</span>
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

              {/* Scroll indicator */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-white/40 text-xs">Scroll for more</span>
              </div>
            </div>

            {/* Reply Video (when playing) */}
            {isPlayingReply && currentReplies[activeReplyIndex] && (
              <div 
                className="absolute inset-x-4 top-4 bottom-32 z-10"
                onClick={backToMainVideo}
              >
                <video
                  ref={replyVideoRef}
                  src={currentReplies[activeReplyIndex].videoUrl}
                  className="w-full h-full object-cover rounded-3xl"
                  autoPlay
                  loop
                  playsInline
                />
                {/* Reply user info */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <img 
                    src={currentReplies[activeReplyIndex].avatarUrl} 
                    alt="" 
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-white text-sm font-medium">
                    {currentReplies[activeReplyIndex].username}
                  </span>
                </div>
                {/* Back hint */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
                  <span className="text-white/80 text-sm">Tap to go back</span>
                </div>
              </div>
            )}

            {/* Reply Carousel Overlay */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-28 z-20"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}
            >
              <div className="px-4 pt-2 pb-1">
                <span className="text-white/60 text-xs font-medium">
                  {currentReplies.length} Replies
                </span>
              </div>
              <div
                ref={replyCarouselRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-4"
                style={{ scrollSnapType: 'x mandatory' }}
                onScroll={handleReplyScroll}
              >
                {currentReplies.map((reply, index) => (
                  <div
                    key={reply.id}
                    className="flex-shrink-0 cursor-pointer transition-all duration-300"
                    style={{
                      width: index === activeReplyIndex ? '90px' : '80px',
                      height: index === activeReplyIndex ? '90px' : '80px',
                      scrollSnapAlign: 'center',
                    }}
                    onClick={() => playReply(index)}
                  >
                    <div className="relative w-full h-full rounded-xl overflow-hidden border-2 transition-all duration-300"
                      style={{ 
                        borderColor: index === activeReplyIndex ? buttonColor : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      <img
                        src={reply.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {/* User avatar */}
                      <div className="absolute bottom-1 left-1">
                        <img 
                          src={reply.avatarUrl} 
                          alt="" 
                          className="w-5 h-5 rounded-full border border-white"
                        />
                      </div>
                      {/* Upvote count */}
                      <button 
                        className="absolute top-1 right-1 flex items-center gap-0.5 bg-black/40 backdrop-blur-sm rounded-full px-1.5 py-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpvote(currentVideo.id, reply.id);
                        }}
                      >
                        <svg 
                          className="w-3 h-3" 
                          fill={reply.hasUpvoted ? buttonColor : 'none'} 
                          stroke={reply.hasUpvoted ? buttonColor : 'white'} 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        <span className="text-white text-[10px]">{reply.upvotes}</span>
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Reply Button */}
                <div
                  className="flex-shrink-0 cursor-pointer"
                  style={{ width: '80px', height: '80px' }}
                  onClick={openCamera}
                >
                  <div 
                    className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-1 border border-white/20"
                    style={{ 
                      background: 'rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: buttonColor }}
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </div>
                    <span className="text-white/80 text-[10px] font-medium">Reply</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Video counter */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white text-sm">
                {fullScreenVideoIndex + 1} / {videos.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Camera UI */}
      {showCameraUI && (
        <div className="fixed inset-0 z-[60] bg-black">
          {/* Camera preview (simulated) */}
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

          {/* Close button */}
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

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/80 backdrop-blur-sm rounded-full px-4 py-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white font-medium">{formatTime(recordingTime)}</span>
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
            {/* Flip camera */}
            <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Record button */}
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

            {/* Effects */}
            <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </button>
          </div>

          {/* Reply to indicator */}
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-white/80 text-sm">Replying to {talentName}'s video</span>
          </div>
        </div>
      )}

      {/* Custom scrollbar hide style */}
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
