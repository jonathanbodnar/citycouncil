import React, { useRef, useEffect } from 'react';

interface ReelsVideoPlayerProps {
  videoUrl: string;
  isActive: boolean;
}

const ReelsVideoPlayer: React.FC<ReelsVideoPlayerProps> = ({
  videoUrl,
  isActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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

    // Reset video when URL changes
    video.currentTime = 0;
    if (isActive) {
      video.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [videoUrl, isActive]);

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="w-full h-full object-cover"
      loop
      playsInline
      muted={false}
      controls={false}
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
  );
};

export default ReelsVideoPlayer;

