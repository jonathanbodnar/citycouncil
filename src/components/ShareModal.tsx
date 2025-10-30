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

  const getShareText = () => {
    const profileUrl = talentProfileUrl 
      ? `${window.location.origin}${talentProfileUrl}`
      : window.location.href;

    // If sharing from talent profile page, use simpler promotional text
    if (isTalentPage) {
      return `Get a personalized ShoutOut from ${talentName}! ${profileUrl}`;
    }
    
    // If sharing completed order, use received text
    return `I just got a personalized ShoutOut from ${talentName} - get yours! ${profileUrl}`;
  };


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

          {/* Share Text with URL */}
          <div className="mb-6 p-4 glass-light rounded-xl border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">Share Message</label>
            <div className="mb-3 p-4 bg-black/30 border border-white/10 rounded-lg">
              <p className="text-white text-sm break-all">
                {getShareText()}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(getShareText());
                  setCopied(true);
                  toast.success('Copied to clipboard!');
                  setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                  toast.error('Failed to copy');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-5 w-5" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-5 w-5" />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-6">
            <p className="text-blue-400 text-xs text-center">
              💡 Paste on social media - the link will show a preview with {talentName}'s profile image
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
