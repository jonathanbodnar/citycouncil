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
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Preload video for faster loading
    video.load();

    if (isActive) {
      // Auto-play when active - start muted to bypass browser restrictions
      const playTimeout = setTimeout(() => {
        video.muted = true; // Ensure muted for autoplay
        video.play()
          .then(() => {
            // Once playing, unmute after a brief moment
            setTimeout(() => {
              if (video && !video.paused) {
                video.muted = false;
                setIsMuted(false);
              }
            }, 100);
          })
          .catch(err => {
            console.error('Error playing video:', err);
          });
      }, 100);
      
      return () => clearTimeout(playTimeout);
    } else {
      // Pause when not active
      video.pause();
      setIsMuted(true); // Reset to muted when not active
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setIsMuted(true); // Reset to muted for new video
    // Reset video when URL changes
    video.currentTime = 0;
    video.muted = true;
    video.load(); // Preload new video
    
    if (isActive) {
      video.play()
        .then(() => {
          // Unmute after starting
          setTimeout(() => {
            if (video && !video.paused) {
              video.muted = false;
              setIsMuted(false);
            }
          }, 100);
        })
        .catch(err => {
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
        muted={isMuted}
        autoPlay
        controls={false}
        preload="auto"
        onLoadedData={() => {
          setIsLoading(false);
          // Auto-play when data is loaded (muted to bypass restrictions)
          if (isActive && videoRef.current) {
            const video = videoRef.current;
            video.muted = true;
            video.play()
              .then(() => {
                // Unmute after starting
                setTimeout(() => {
                  if (video && !video.paused) {
                    video.muted = false;
                    setIsMuted(false);
                  }
                }, 100);
              })
              .catch(err => {
                console.error('Error playing video:', err);
              });
          }
        }}
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

