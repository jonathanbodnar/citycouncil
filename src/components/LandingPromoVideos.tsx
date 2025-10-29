import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { uploadVideoToWasabi } from '../services/videoUpload';
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowUpIcon,
  ArrowDownIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface LandingPromoVideo {
  id: string;
  video_url: string;
  title: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

const LandingPromoVideos: React.FC = () => {
  const [videos, setVideos] = useState<LandingPromoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newVideo, setNewVideo] = useState({
    title: '',
    description: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('landing_promo_videos')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load promo videos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }

      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Video file must be less than 100MB');
        return;
      }

      setNewVideo(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async () => {
    if (!newVideo.file) {
      toast.error('Please select a video file');
      return;
    }

    setUploading(true);

    try {
      // Upload video to Wasabi
      const uploadResult = await uploadVideoToWasabi(newVideo.file);
      
      if (!uploadResult.success || !uploadResult.videoUrl) {
        throw new Error('Failed to upload video');
      }

      // Get the max display order
      const maxOrder = videos.reduce((max, v) => Math.max(max, v.display_order), 0);

      // Insert video record
      const { error } = await supabase
        .from('landing_promo_videos')
        .insert({
          video_url: uploadResult.videoUrl,
          title: newVideo.title || null,
          description: newVideo.description || null,
          display_order: maxOrder + 1,
          is_active: true
        });

      if (error) throw error;

      toast.success('Promo video uploaded successfully!');
      setNewVideo({ title: '', description: '', file: null });
      
      // Reset file input
      const fileInput = document.getElementById('video-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchVideos();
    } catch (error: any) {
      console.error('Error uploading video:', error);
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo video?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('landing_promo_videos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Promo video deleted');
      fetchVideos();
    } catch (error: any) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('landing_promo_videos')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Video hidden from landing page' : 'Video shown on landing page');
      fetchVideos();
    } catch (error: any) {
      console.error('Error toggling video status:', error);
      toast.error('Failed to update video status');
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = videos.findIndex(v => v.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;

    try {
      // Swap display orders
      const currentVideo = videos[currentIndex];
      const targetVideo = videos[targetIndex];

      await Promise.all([
        supabase
          .from('landing_promo_videos')
          .update({ display_order: targetVideo.display_order })
          .eq('id', currentVideo.id),
        supabase
          .from('landing_promo_videos')
          .update({ display_order: currentVideo.display_order })
          .eq('id', targetVideo.id)
      ]);

      fetchVideos();
    } catch (error: any) {
      console.error('Error reordering videos:', error);
      toast.error('Failed to reorder videos');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="glass rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <VideoCameraIcon className="h-6 w-6" />
          Upload New Landing Page Video
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video File
            </label>
            <input
              id="video-file-input"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
              disabled={uploading}
            />
            {newVideo.file && (
              <p className="mt-2 text-sm text-gray-400">
                Selected: {newVideo.file.name} ({(newVideo.file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={newVideo.title}
              onChange={(e) => setNewVideo(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Sample Birthday Shoutout"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={newVideo.description}
              onChange={(e) => setNewVideo(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this example video..."
              rows={3}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !newVideo.file}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              <>
                <PlusIcon className="h-5 w-5" />
                Upload Video
              </>
            )}
          </button>
        </div>
      </div>

      {/* Videos List */}
      <div className="glass rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-semibold text-white mb-4">
          Landing Page Videos ({videos.length})
        </h3>

        {videos.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <VideoCameraIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No promo videos uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video, index) => (
              <div key={video.id} className="glass-strong rounded-xl p-4 border border-white/20">
                <div className="flex items-start gap-4">
                  {/* Video Preview */}
                  <video
                    src={video.video_url}
                    className="w-32 h-20 object-cover rounded-lg bg-black"
                    muted
                  />

                  {/* Video Info */}
                  <div className="flex-1">
                    <h4 className="text-white font-semibold">
                      {video.title || `Video ${index + 1}`}
                    </h4>
                    {video.description && (
                      <p className="text-gray-400 text-sm mt-1">{video.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        video.is_active 
                          ? 'bg-green-500/20 text-green-300' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {video.is_active ? 'Active' : 'Hidden'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Order: {video.display_order}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleReorder(video.id, 'up')}
                      disabled={index === 0}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(video.id, 'down')}
                      disabled={index === videos.length - 1}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(video.id, video.is_active)}
                      className="p-2 text-blue-400 hover:text-blue-300 hover:bg-white/10 rounded-lg transition-all"
                      title={video.is_active ? 'Hide' : 'Show'}
                    >
                      {video.is_active ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition-all"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPromoVideos;

