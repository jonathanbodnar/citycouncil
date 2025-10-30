import React, { useState } from 'react';
import { 
  XMarkIcon,
  ShareIcon,
  ClipboardDocumentIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
  const [copied, setCopied] = useState(false);

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

  const handleCopyUrl = async () => {
    const profileUrl = talentProfileUrl 
      ? `${window.location.origin}${talentProfileUrl}`
      : window.location.href;
    
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Profile URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  const handleShare = async (platform: string) => {
    const shareText = getShareText(platform);
    const profileUrl = talentProfileUrl 
      ? `${window.location.origin}${talentProfileUrl}`
      : window.location.href;

    // Try using native Web Share API for mobile (supports video)
    if (navigator.share && videoUrl) {
      try {
        await navigator.share({
          title: shareText,
          text: shareText,
          url: profileUrl
        });
        return;
      } catch (err) {
        // Fallback to platform-specific sharing
        console.log('Native share not available, using platform links');
      }
    }

    // Platform-specific handling
    if (platform === 'instagram') {
      // Copy text and open Instagram
      const fullText = `${shareText}\n\n${profileUrl}`;
      navigator.clipboard.writeText(fullText);
      window.open('https://www.instagram.com/', '_blank');
      toast.success('Text copied! Paste it in Instagram to share.');
      return;
    }
    
    if (platform === 'tiktok') {
      // Copy text and open TikTok
      const fullText = `${shareText}\n\n${profileUrl}`;
      navigator.clipboard.writeText(fullText);
      window.open('https://www.tiktok.com/', '_blank');
      toast.success('Text copied! Paste it in TikTok to share.');
      return;
    }
    
    // For other platforms, open their share dialog
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
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="glass-strong rounded-2xl shadow-xl max-w-md w-full border border-white/20">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShareIcon className="h-5 w-5 text-white" />
              <h2 className="text-xl font-semibold text-white">
                {isTalentPage ? 'Share Profile' : 'Share Your ShoutOut'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-white/80 mb-6 text-center">
            {isTalentPage 
              ? `Share ${talentName}'s profile`
              : `Share your personalized ShoutOut from ${talentName}!`
            }
          </p>

          {/* Copy Profile URL Field */}
          <div className="mb-6 p-4 glass-light rounded-xl border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">Profile URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={talentProfileUrl ? `${window.location.origin}${talentProfileUrl}` : window.location.href}
                readOnly
                className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm"
              />
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-6">
            {platforms.map((platform) => (
              <button
                key={platform.key}
                onClick={() => handleShare(platform.key)}
                className={`flex flex-col items-center p-4 rounded-xl text-white transition-all hover:scale-110 ${platform.color}`}
                title={platform.label}
              >
                <span className="text-4xl">{platform.icon}</span>
                <span className="text-xs mt-2 font-medium">{platform.label.split('/')[0]}</span>
              </button>
            ))}
          </div>

          {isTalentPage && (
            <div className="mt-6 p-4 glass-light rounded-lg border border-white/20">
              <h4 className="font-medium text-white mb-2">Share Text:</h4>
              <p className="text-sm text-white/80">
                "{getShareText('twitter')}"
              </p>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg font-medium transition-colors border border-white/20"
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
