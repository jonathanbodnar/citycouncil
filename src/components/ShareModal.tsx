import React from 'react';
import { 
  XMarkIcon,
  ShareIcon 
} from '@heroicons/react/24/outline';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  talentName: string;
  talentProfileUrl?: string; // The talent's profile URL (e.g., /joshfirestine)
  talentSocialHandles?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
  };
  videoUrl?: string;
  isTalentPage?: boolean; // True if sharing from talent profile page (not user's completed order)
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  talentName, 
  talentProfileUrl,
  talentSocialHandles = {},
  videoUrl,
  isTalentPage = false
}) => {
  if (!isOpen) return null;

  const getShareText = (platform: string) => {
    // If sharing from talent profile page, use simpler promotional text
    if (isTalentPage) {
      return `Get a personalized ShoutOut from ${talentName}!`;
    }
    
    // If sharing completed order, use received text
    const talentTag = talentSocialHandles[platform as keyof typeof talentSocialHandles];
    const baseText = `I just got a personalized ShoutOut from ${talentName} get yours! @ShoutOut`;
    
    if (talentTag) {
      return `${baseText} ${talentTag}`;
    }
    return baseText;
  };

  const getShareUrl = (platform: string) => {
    const text = encodeURIComponent(getShareText(platform));
    // Use talent profile URL if provided, otherwise current page
    const profileUrl = talentProfileUrl 
      ? `${window.location.origin}${talentProfileUrl}`
      : window.location.href;
    const url = encodeURIComponent(profileUrl);
    
    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      instagram: `https://www.instagram.com/`, // Instagram doesn't support direct sharing
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`,
      tiktok: `https://www.tiktok.com/`, // TikTok doesn't support direct sharing
    };

    return shareUrls[platform as keyof typeof shareUrls] || '#';
  };

  const handleShare = (platform: string) => {
    if (platform === 'instagram' || platform === 'tiktok') {
      // Copy text and URL to clipboard for manual sharing
      const shareText = getShareText(platform);
      const profileUrl = talentProfileUrl 
        ? `${window.location.origin}${talentProfileUrl}`
        : window.location.href;
      const fullText = `${shareText} ${profileUrl}`;
      
      navigator.clipboard.writeText(fullText);
      alert(`Text copied to clipboard! Open ${platform} and paste to share.`);
      return;
    }

    const shareUrl = getShareUrl(platform);
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const platforms = [
    { 
      key: 'facebook', 
      label: 'Facebook', 
      icon: '📘', 
      color: 'bg-blue-600 hover:bg-blue-700' 
    },
    { 
      key: 'twitter', 
      label: 'Twitter/X', 
      icon: '🐦', 
      color: 'bg-black hover:bg-gray-800' 
    },
    { 
      key: 'instagram', 
      label: 'Instagram', 
      icon: '📸', 
      color: 'bg-pink-600 hover:bg-pink-700' 
    },
    { 
      key: 'linkedin', 
      label: 'LinkedIn', 
      icon: '💼', 
      color: 'bg-blue-700 hover:bg-blue-800' 
    },
    { 
      key: 'tiktok', 
      label: 'TikTok', 
      icon: '🎵', 
      color: 'bg-black hover:bg-gray-800' 
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShareIcon className="h-5 w-5 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Share Your ShoutOut</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            {isTalentPage 
              ? `Share ${talentName}'s profile`
              : `Share your personalized ShoutOut from ${talentName} with friends and family!`
            }
          </p>

          <div className="space-y-3">
            {platforms.map((platform) => (
              <button
                key={platform.key}
                onClick={() => handleShare(platform.key)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg text-white transition-colors ${platform.color}`}
              >
                <span className="text-2xl">{platform.icon}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium">{platform.label}</div>
                  <div className="text-sm opacity-90">
                    {platform.key === 'instagram' || platform.key === 'tiktok' 
                      ? 'Copy text to share manually'
                      : 'Share directly'
                    }
                  </div>
                </div>
              </button>
            ))}
          </div>

          {isTalentPage && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Share Text:</h4>
              <p className="text-sm text-gray-700">
                "{getShareText('twitter')}"
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Link: {talentProfileUrl ? `${window.location.origin}${talentProfileUrl}` : window.location.href}
              </p>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg hover:bg-gray-900 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
