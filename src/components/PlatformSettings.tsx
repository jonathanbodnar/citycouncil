import React, { useState, useEffect } from 'react';
import { 
  PhotoIcon, 
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { PlatformSetting } from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PlatformSettings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [welcomeVideoFile, setWelcomeVideoFile] = useState<File | null>(null);
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      setSettings(data || []);

      // Set current logo preview
      const logoSetting = data?.find(s => s.setting_key === 'platform_logo_url');
      if (logoSetting?.setting_value) {
        setLogoPreview(logoSetting.setting_value);
      }

      // Set current welcome video URL
      const videoSetting = data?.find(s => s.setting_key === 'welcome_video_url');
      if (videoSetting?.setting_value) {
        setWelcomeVideoUrl(videoSetting.setting_value);
      }

    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async () => {
    if (!logoFile || !user) return;

    try {
      setUploading(true);

      // Upload to Wasabi S3 (shoutout-assets bucket)
      const AWS = (await import('aws-sdk')).default;
      
      const wasabi = new AWS.S3({
        endpoint: 's3.us-central-1.wasabisys.com',
        accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID!,
        secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY!,
        region: 'us-central-1',
        s3ForcePathStyle: true,
        signatureVersion: 'v4'
      });

      const fileExt = logoFile.name.split('.').pop();
      const fileName = `platform/logo-${Date.now()}.${fileExt}`;
      
      const uploadParams = {
        Bucket: 'shoutout-assets',
        Key: fileName,
        Body: logoFile,
        ContentType: logoFile.type,
        ACL: 'public-read' as const,
      };

      await wasabi.upload(uploadParams).promise();
      
      // Use direct Wasabi URL
      const logoUrl = `https://shoutout-assets.s3.us-central-1.wasabisys.com/${fileName}`;

      // Update platform setting
      const { error: settingError } = await supabase
        .from('platform_settings')
        .update({
          setting_value: logoUrl,
          updated_by: user.id
        })
        .eq('setting_key', 'platform_logo_url');

      if (settingError) throw settingError;

      toast.success('Logo uploaded successfully!');
      fetchSettings();
      setLogoFile(null);

      // Trigger a page refresh to update all Logo components
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    // Validate file size (max 750MB)
    if (file.size > 750 * 1024 * 1024) {
      toast.error('Video must be less than 750MB');
      return;
    }

    setWelcomeVideoFile(file);
  };

  const uploadWelcomeVideo = async () => {
    if (!welcomeVideoFile || !user) return;

    try {
      setUploadingVideo(true);

      // Upload to Wasabi S3 (shoutout-assets bucket)
      const AWS = (await import('aws-sdk')).default;
      
      const wasabi = new AWS.S3({
        endpoint: 's3.us-central-1.wasabisys.com',
        accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID!,
        secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY!,
        region: 'us-central-1',
        s3ForcePathStyle: true,
        signatureVersion: 'v4'
      });

      const fileExt = welcomeVideoFile.name.split('.').pop();
      const fileName = `platform/welcome-video-${Date.now()}.${fileExt}`;
      
      const uploadParams = {
        Bucket: 'shoutout-assets',
        Key: fileName,
        Body: welcomeVideoFile,
        ContentType: welcomeVideoFile.type,
        ACL: 'public-read' as const,
      };

      await wasabi.upload(uploadParams).promise();
      
      // Use direct Wasabi URL
      const videoUrl = `https://shoutout-assets.s3.us-central-1.wasabisys.com/${fileName}`;

      // Update or create platform setting
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .eq('setting_key', 'welcome_video_url')
        .single();

      if (existing) {
        // Update existing
        const { error: settingError } = await supabase
          .from('platform_settings')
          .update({
            setting_value: videoUrl,
            updated_by: user.id
          })
          .eq('setting_key', 'welcome_video_url');

        if (settingError) throw settingError;
      } else {
        // Create new
        const { error: settingError } = await supabase
          .from('platform_settings')
          .insert({
            setting_key: 'welcome_video_url',
            setting_value: videoUrl,
            setting_type: 'string',
            description: 'Welcome page video URL',
            updated_by: user.id
          });

        if (settingError) throw settingError;
      }

      toast.success('Welcome video uploaded successfully!');
      setWelcomeVideoUrl(videoUrl);
      setWelcomeVideoFile(null);
      fetchSettings();

    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          setting_value: value,
          updated_by: user?.id
        })
        .eq('setting_key', key);

      if (error) throw error;
      
      toast.success('Setting updated successfully');
      fetchSettings();

    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-gray-200 h-40 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Platform Settings</h2>

      {/* Logo Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Logo</h3>
        
        <div className="flex items-start gap-6">
          {/* Current Logo */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Platform Logo"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <PhotoIcon className="w-12 h-12 text-gray-400" />
              )}
            </div>
          </div>
          
          {/* Upload Controls */}
          <div className="flex-1">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload New Logo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, or SVG. Max 5MB. Recommended: 200x200px or larger.
              </p>
            </div>
            
            {logoFile && (
              <div className="flex items-center gap-3">
                <button
                  onClick={uploadLogo}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-4 w-4" />
                      Upload Logo
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setLogoFile(null);
                    setLogoPreview(settings.find(s => s.setting_key === 'platform_logo_url')?.setting_value || null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Welcome Video Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Welcome Page Video</h3>
        
        <div className="space-y-4">
          {/* Current Video Preview */}
          {welcomeVideoUrl && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Video
              </label>
              <video
                src={welcomeVideoUrl}
                controls
                className="w-full max-w-md rounded-lg border border-gray-300"
              />
            </div>
          )}
          
          {/* Upload Controls */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload New Welcome Video
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              MP4, MOV, or WebM. Max 750MB. Uploads to Wasabi (shoutout-assets). This video will appear on the /welcome page.
            </p>
          </div>
          
          {welcomeVideoFile && (
            <div className="flex items-center gap-3">
              <button
                onClick={uploadWelcomeVideo}
                disabled={uploadingVideo}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploadingVideo ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-4 w-4" />
                    Upload Video
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setWelcomeVideoFile(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              <span className="text-sm text-gray-600">
                {welcomeVideoFile.name} ({(welcomeVideoFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Other Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
        
        <div className="space-y-4">
          {settings
            .filter(setting => 
              setting.setting_key !== 'platform_logo_url' && 
              setting.setting_key !== 'welcome_video_url'
            )
            .map((setting) => (
              <div key={setting.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {setting.description || setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
                
                {setting.setting_type === 'boolean' ? (
                  <select
                    value={setting.setting_value || 'false'}
                    onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : setting.setting_type === 'number' ? (
                  <input
                    type="number"
                    value={setting.setting_value || '0'}
                    onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={setting.setting_value || ''}
                    onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformSettings;
