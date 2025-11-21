import React, { useRef, useEffect, useState } from 'react';

interface ReelsVideoPlayerProps {
  videoUrl: string;
  isActive: boolean;
}

const ReelsVideoPlayer: React.FC<ReelsVideoPlayerProps> = ({
  videoUrl,
  isActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Preload video for faster loading
    video.load();

    if (isActive) {
      // Auto-play when active
      video.play().catch(err => {
        console.error('Error playing video:', err);
      });
    } else {
      // Pause when not active
      video.pause();
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    // Reset video when URL changes
    video.currentTime = 0;
    video.load(); // Preload new video
    
    if (isActive) {
      video.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [videoUrl, isActive]);

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={false}
        controls={false}
        preload="auto"
        onLoadedData={() => setIsLoading(false)}
        onCanPlay={() => setIsLoading(false)}
        onClick={() => {
          // Toggle play/pause on tap
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play();
            } else {
              videoRef.current.pause();
            }
          }
        }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
    </>
  );
};

export default ReelsVideoPlayer;

