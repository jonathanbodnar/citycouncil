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

    // Platform-specific handling with deep links
    if (platform === 'instagram') {
      // Copy text to clipboard first
      const fullText = `${shareText}\n\n${profileUrl}`;
      try {
        await navigator.clipboard.writeText(fullText);
        
        // Try Instagram app deep link first (mobile)
        const instagramUrl = 'instagram://story-camera';
        const webFallback = 'https://www.instagram.com/';
        
        // Create a temporary link to test if Instagram app is available
        const link = document.createElement('a');
        link.href = instagramUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Try to open Instagram app
        link.click();
        
        // Fallback to web after a short delay if app doesn't open
        setTimeout(() => {
          document.body.removeChild(link);
        }, 500);
        
        // Set a longer timeout to open web version if app didn't open
        setTimeout(() => {
          window.open(webFallback, '_blank');
        }, 1500);
        
        toast.success('Text copied! Opening Instagram...');
      } catch (err) {
        window.open('https://www.instagram.com/', '_blank');
        toast.error('Please paste the copied text in Instagram');
      }
      return;
    }
    
    if (platform === 'tiktok') {
      // Copy text to clipboard
      const fullText = `${shareText}\n\n${profileUrl}`;
      try {
        await navigator.clipboard.writeText(fullText);
        
        // Try TikTok app deep link first (mobile)
        const tiktokUrl = 'tiktok://';
        const webFallback = 'https://www.tiktok.com/';
        
        const link = document.createElement('a');
        link.href = tiktokUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
        }, 500);
        
        setTimeout(() => {
          window.open(webFallback, '_blank');
        }, 1500);
        
        toast.success('Text copied! Opening TikTok...');
      } catch (err) {
        window.open('https://www.tiktok.com/', '_blank');
        toast.error('Please paste the copied text in TikTok');
      }
      return;
    }

    if (platform === 'facebook') {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}&quote=${encodeURIComponent(shareText)}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
      return;
    }

    if (platform === 'twitter') {
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
      return;
    }

    if (platform === 'linkedin') {
      const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
      return;
    }
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
              ? `Share ${talentName}'s profile on social media`
              : `Share your personalized ShoutOut from ${talentName}!`
            }
          </p>

          {/* Share Text Field */}
          <div className="mb-4 p-4 glass-light rounded-xl border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">Share Text</label>
            <div className="mb-3 p-3 bg-black/30 border border-white/10 rounded-lg">
              <p className="text-white text-sm">
                "{getShareText('twitter')}"
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(getShareText('twitter'));
                  toast.success('Share text copied!');
                } catch (err) {
                  toast.error('Failed to copy text');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy Text
            </button>
          </div>

          {/* Copy Profile URL Field */}
          <div className="mb-6 p-4 glass-light rounded-xl border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">Profile URL</label>
            <div className="mb-3 p-3 bg-black/30 border border-white/10 rounded-lg break-all">
              <p className="text-white text-sm">
                {talentProfileUrl ? `${window.location.origin}${talentProfileUrl}` : window.location.href}
              </p>
            </div>
            <button
              onClick={handleCopyUrl}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  URL Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-4 w-4" />
                  Copy URL
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-6">
            <p className="text-blue-400 text-xs text-center">
              💡 Paste the URL on social media - it will show a preview with {talentName}'s profile image
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg font-medium transition-colors border border-white/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
