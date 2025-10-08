import React, { useState } from 'react';
import { 
  CameraIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface ProfilePictureUploadProps {
  currentAvatarUrl?: string;
  onUploadComplete?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  currentAvatarUrl,
  onUploadComplete,
  size = 'md'
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const sizes = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Auto-upload immediately (simulate upload process)
    setUploading(true);
    try {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a mock URL (in production, this would be the actual S3 URL)
      const avatarUrl = `https://s3.us-central-1.wasabisys.com/shoutoutorders/avatars/${user?.id}-${Date.now()}.jpg`;
      
      // Call the parent component's upload completion handler
      if (onUploadComplete) {
        await onUploadComplete(avatarUrl);
      }

      toast.success('Profile picture updated successfully!');
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
  };

  return (
    <div className="relative">
      <div className={`${sizes[size]} bg-primary-100 rounded-full flex items-center justify-center relative overflow-hidden`}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        ) : currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <UserCircleIcon className={`${size === 'sm' ? 'h-12 w-12' : size === 'md' ? 'h-16 w-16' : 'h-20 w-20'} text-primary-600`} />
        )}
        
        {/* Upload Overlay */}
        <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
          <CameraIcon className="h-6 w-6 text-white" />
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
        </label>

        {/* Upload Status */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ProfilePictureUpload;
