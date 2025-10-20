import React, { useState, useRef } from 'react';
import { 
  PhotoIcon, 
  CloudArrowUpIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { uploadImageToWasabi } from '../services/wasabiUpload';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  uploadPath: string; // e.g., 'talent-avatars', 'logos'
  maxSizeMB?: number;
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImageUrl,
  onImageUploaded,
  uploadPath,
  maxSizeMB = 5,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image must be less than ${maxSizeMB}MB`);
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      const result = await uploadImageToWasabi(selectedFile, uploadPath);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      onImageUploaded(result.imageUrl!);
      toast.success('Image uploaded successfully!');
      setSelectedFile(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(currentImageUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Profile Image
      </label>
      
      <div className="flex items-start gap-4">
        {/* Image Preview */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <PhotoIcon className="w-8 h-8 text-gray-400" />
            )}
          </div>
        </div>
        
        {/* Upload Controls */}
        <div className="flex-1">
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, or GIF. Max {maxSizeMB}MB. Recommended: 400x400px.
            </p>
          </div>
          
          {selectedFile && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-4 w-4" />
                    Upload
                  </>
                )}
              </button>
              
              <button
                onClick={clearSelection}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cancel"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;
