import React, { useState } from 'react';
import { 
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  thumbnailUrl, 
  className = '' 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const handlePlayPause = () => {
    const video = document.getElementById('video-player') as HTMLVideoElement;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMute = () => {
    const video = document.getElementById('video-player') as HTMLVideoElement;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        id="video-player"
        className="w-full h-full object-contain"
        poster={thumbnailUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('Video error:', e);
          console.error('Video URL:', videoUrl);
          setVideoError(true);
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        controls
        preload="metadata"
      >
        <source src={videoUrl} type="video/mp4" />
        {/* Support for data URLs */}
        {videoUrl.startsWith('data:') && (
          <source src={videoUrl} type={videoUrl.split(';')[0].split(':')[1]} />
        )}
        <p className="text-white p-4">
          Your browser doesn't support video playback. 
          <a href={videoUrl} className="text-blue-300 underline ml-1">
            Download the video
          </a>
        </p>
      </video>

      {/* Custom Controls Overlay */}
      <div 
        className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          className="bg-black bg-opacity-50 text-white p-4 rounded-full hover:bg-opacity-70 transition-all"
        >
          {isPlaying ? (
            <PauseIcon className="h-8 w-8" />
          ) : (
            <PlayIcon className="h-8 w-8" />
          )}
        </button>

        {/* Volume Control */}
        <button
          onClick={handleMute}
          className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
        >
          {isMuted ? (
            <SpeakerXMarkIcon className="h-5 w-5" />
          ) : (
            <SpeakerWaveIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Error State */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center p-4">
            <PlayIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Video temporarily unavailable</p>
            {videoUrl.startsWith('data:') ? (
              <p className="text-xs text-gray-500 mt-1">
                Data URL video ({Math.round(videoUrl.length / 1024)}KB)
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1 break-all">
                URL: {videoUrl.length > 50 ? videoUrl.substring(0, 50) + '...' : videoUrl}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {!videoUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <PlayIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Video not available</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
