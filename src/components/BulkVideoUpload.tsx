import React, { useState, useEffect } from 'react';
import { 
  CloudArrowUpIcon, 
  CheckCircleIcon,
  XCircleIcon,
  VideoCameraIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { uploadVideoToWasabi } from '../services/videoUpload';
import { TalentProfile } from '../types';
import toast from 'react-hot-toast';

interface VideoUploadItem {
  id: string;
  file: File;
  talentId: string;
  recipientName: string;
  occasion: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  videoUrl?: string;
  error?: string;
}

interface SimplifiedTalent {
  id: string;
  temp_full_name?: string;
  username?: string;
  users?: {
    full_name: string;
  } | {
    full_name: string;
  }[];
}

const BulkVideoUpload: React.FC = () => {
  const [talents, setTalents] = useState<SimplifiedTalent[]>([]);
  const [videoItems, setVideoItems] = useState<VideoUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchTalents();
  }, []);

  const fetchTalents = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          temp_full_name,
          username,
          users!talent_profiles_user_id_fkey (
            full_name
          )
        `)
        .eq('is_active', true)
        .order('temp_full_name', { ascending: true });

      if (error) throw error;
      setTalents(data || []);
    } catch (error) {
      console.error('Error fetching talents:', error);
      toast.error('Failed to load talent list');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const newItems: VideoUploadItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      talentId: '',
      recipientName: '',
      occasion: 'Historical Video',
      status: 'pending' as const,
      progress: 0
    }));

    setVideoItems(prev => [...prev, ...newItems]);
  };

  const updateVideoItem = (id: string, updates: Partial<VideoUploadItem>) => {
    setVideoItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeVideoItem = (id: string) => {
    setVideoItems(prev => prev.filter(item => item.id !== id));
  };

  const uploadSingleVideo = async (item: VideoUploadItem) => {
    try {
      // Validate
      if (!item.talentId) {
        throw new Error('Please select a talent for this video');
      }

      updateVideoItem(item.id, { status: 'uploading', progress: 10 });

      // Generate a unique order ID for the historical video
      const orderId = `historical-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      updateVideoItem(item.id, { progress: 30 });

      // Upload video to Wasabi
      const uploadResult = await uploadVideoToWasabi(item.file, orderId);
      
      updateVideoItem(item.id, { progress: 60 });

      // Create a "historical" order entry
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id, // Admin user
          talent_id: item.talentId,
          recipient_name: item.recipientName || 'Historical Order',
          recipient_email: 'historical@shoutout.us',
          occasion: item.occasion,
          message: 'Historical video upload',
          pricing: 0,
          status: 'completed',
          video_url: uploadResult.videoUrl,
          completed_at: new Date().toISOString(),
          is_historical: true // Mark as historical
        })
        .select()
        .single();

      if (orderError) throw orderError;

      updateVideoItem(item.id, { progress: 80 });

      // Update talent statistics
      const { error: statsError } = await supabase.rpc('increment_talent_orders', {
        talent_profile_id: item.talentId,
        is_fulfilled: true
      });

      if (statsError) console.warn('Stats update warning:', statsError);

      updateVideoItem(item.id, { 
        status: 'success', 
        progress: 100,
        videoUrl: uploadResult.videoUrl 
      });

      return true;
    } catch (error: any) {
      console.error('Upload error:', error);
      updateVideoItem(item.id, { 
        status: 'error', 
        progress: 0,
        error: error.message 
      });
      return false;
    }
  };

  const handleBulkUpload = async () => {
    const pendingItems = videoItems.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      toast.error('No videos to upload');
      return;
    }

    // Validate all have talent assigned
    const missingTalent = pendingItems.find(item => !item.talentId);
    if (missingTalent) {
      toast.error('Please assign a talent to all videos before uploading');
      return;
    }

    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;

    // Upload sequentially to avoid overwhelming the system
    for (const item of pendingItems) {
      const success = await uploadSingleVideo(item);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} video(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to upload ${failCount} video(s)`);
    }
  };

  const getTalentName = (talentId: string) => {
    const talent = talents.find(t => t.id === talentId);
    if (!talent) return 'Unknown';
    
    // Handle both single object and array from Supabase
    const userName = Array.isArray(talent.users) 
      ? talent.users[0]?.full_name 
      : "talent.users?.full_name";
    
    return talent.temp_full_name || userName || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-strong rounded-2xl p-6 border border-white/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <VideoCameraIcon className="h-8 w-8" />
              Bulk Video Upload
            </h2>
            <p className="text-gray-300 mt-1">
              Upload historical videos and assign them to talent profiles
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Total Videos</div>
            <div className="text-2xl font-bold text-white">{videoItems.length}</div>
          </div>
        </div>

        {/* File Upload Button */}
        <div className="flex items-center gap-4">
          <label className="flex-1">
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <div className="glass hover:glass-strong border border-white/30 rounded-xl p-6 text-center cursor-pointer transition-all duration-300">
              <CloudArrowUpIcon className="h-12 w-12 text-blue-400 mx-auto mb-2" />
              <p className="text-white font-medium">Select Videos</p>
              <p className="text-sm text-gray-400 mt-1">Click to browse or drag and drop</p>
            </div>
          </label>

          {videoItems.length > 0 && (
            <button
              onClick={handleBulkUpload}
              disabled={isUploading || videoItems.every(item => item.status !== 'pending')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
            >
              {isUploading ? 'Uploading...' : `Upload All (${videoItems.filter(v => v.status === 'pending').length})`}
            </button>
          )}
        </div>
      </div>

      {/* Video List */}
      {videoItems.length > 0 && (
        <div className="glass-strong rounded-2xl p-6 border border-white/30">
          <h3 className="text-lg font-semibold text-white mb-4">Videos to Upload</h3>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {videoItems.map((item) => (
              <div 
                key={item.id}
                className={`glass rounded-xl p-4 border transition-all ${
                  item.status === 'success' 
                    ? 'border-green-500/50 bg-green-500/10' 
                    : item.status === 'error'
                    ? 'border-red-500/50 bg-red-500/10'
                    : item.status === 'uploading'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {item.status === 'success' && (
                      <CheckCircleIcon className="h-8 w-8 text-green-400" />
                    )}
                    {item.status === 'error' && (
                      <XCircleIcon className="h-8 w-8 text-red-400" />
                    )}
                    {item.status === 'uploading' && (
                      <div className="h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {item.status === 'pending' && (
                      <VideoCameraIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-white font-medium truncate">{item.file.name}</p>
                      <span className="text-xs text-gray-400">
                        ({(item.file.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>

                    {/* Form Fields */}
                    {item.status === 'pending' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                        <select
                          value={item.talentId}
                          onChange={(e) => updateVideoItem(item.id, { talentId: e.target.value })}
                          className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Talent *</option>
                          {talents.map(talent => (
                            <option key={talent.id} value={talent.id} className="bg-gray-800">
                              {talent.temp_full_name || ""}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          placeholder="Recipient Name (optional)"
                          value={item.recipientName}
                          onChange={(e) => updateVideoItem(item.id, { recipientName: e.target.value })}
                          className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                          type="text"
                          placeholder="Occasion (optional)"
                          value={item.occasion}
                          onChange={(e) => updateVideoItem(item.id, { occasion: e.target.value })}
                          className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Success/Error Messages */}
                    {item.status === 'success' && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400">✓ Uploaded successfully</span>
                        <span className="text-gray-400">→ {getTalentName(item.talentId)}</span>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <p className="text-sm text-red-400">✗ {item.error || 'Upload failed'}</p>
                    )}

                    {item.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-400">Uploading...</span>
                          <span className="text-gray-400">{item.progress}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {item.talentId && item.status === 'pending' && (
                      <p className="text-sm text-gray-400 mt-1">
                        → Will be added to {getTalentName(item.talentId)}'s profile
                      </p>
                    )}
                  </div>

                  {/* Remove Button */}
                  {(item.status === 'pending' || item.status === 'error') && (
                    <button
                      onClick={() => removeVideoItem(item.id)}
                      className="flex-shrink-0 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      disabled={isUploading}
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-400">
                  Pending: <span className="text-white font-medium">{videoItems.filter(v => v.status === 'pending').length}</span>
                </span>
                <span className="text-gray-400">
                  Uploading: <span className="text-blue-400 font-medium">{videoItems.filter(v => v.status === 'uploading').length}</span>
                </span>
                <span className="text-gray-400">
                  Success: <span className="text-green-400 font-medium">{videoItems.filter(v => v.status === 'success').length}</span>
                </span>
                <span className="text-gray-400">
                  Failed: <span className="text-red-400 font-medium">{videoItems.filter(v => v.status === 'error').length}</span>
                </span>
              </div>
              
              {videoItems.some(v => v.status === 'success' || v.status === 'error') && (
                <button
                  onClick={() => setVideoItems(prev => prev.filter(v => v.status === 'pending' || v.status === 'uploading'))}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Clear Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="glass rounded-2xl p-6 border border-white/30">
        <h3 className="text-lg font-semibold text-white mb-3">📝 Instructions</h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>• <strong>Select videos</strong> from your computer (multiple files supported)</li>
          <li>• <strong>Assign each video</strong> to a talent profile</li>
          <li>• <strong>Add recipient name and occasion</strong> (optional, for better organization)</li>
          <li>• <strong>Click "Upload All"</strong> to start the batch upload</li>
          <li>• Videos will appear on the talent's profile under "Recent Videos"</li>
          <li>• These orders are marked as "historical" and won't affect payment processing</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkVideoUpload;

