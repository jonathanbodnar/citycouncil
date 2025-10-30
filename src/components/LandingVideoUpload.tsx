import React from 'react';
import { supabase } from '../services/supabase';
import { uploadVideoToWasabi } from '../services/videoUpload';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Video {
  id: string;
  video_url: string;
  display_order: number;
  is_active: boolean;
}

export default function LandingVideoUpload() {
  const [videos, setVideos] = React.useState<Video[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadVideos();
  }, []);

  async function loadVideos() {
    try {
      const { data, error } = await supabase
        .from('landing_promo_videos')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('video') as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      toast.error('Select a video');
      return;
    }

    setUploading(true);

    try {
      const id = `promo_${Date.now()}`;
      const result = await uploadVideoToWasabi(file, id);

      if (!result.success) throw new Error(result.error);

      const { error } = await supabase.from('landing_promo_videos').insert({
        video_url: result.videoUrl,
        display_order: videos.length,
        is_active: true
      });

      if (error) throw error;

      toast.success('Uploaded!');
      form.reset();
      loadVideos();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteVideo(id: string) {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Delete this video?')) return;

    try {
      await supabase.from('landing_promo_videos').delete().eq('id', id);
      toast.success('Deleted');
      loadVideos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await supabase.from('landing_promo_videos').update({ is_active: !current }).eq('id', id);
      loadVideos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function reorder(id: string, direction: 'up' | 'down') {
    const idx = videos.findIndex(v => v.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= videos.length) return;

    const current = videos[idx];
    const target = videos[targetIdx];

    await Promise.all([
      supabase.from('landing_promo_videos').update({ display_order: target.display_order }).eq('id', current.id),
      supabase.from('landing_promo_videos').update({ display_order: current.display_order }).eq('id', target.id)
    ]);

    loadVideos();
  }

  if (loading) {
    return <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="glass rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <VideoCameraIcon className="h-6 w-6" />
          Upload Landing Page Video
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            name="video"
            accept="video/*,.mp4,.mov,.webm"
            required
            disabled={uploading}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          />

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
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
        </form>
      </div>

      {/* Videos List */}
      <div className="glass rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-semibold text-white mb-4">Landing Page Videos ({videos.length})</h3>

        {videos.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <VideoCameraIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No videos yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video, idx) => (
              <div key={video.id} className="glass-strong rounded-xl p-4 border border-white/20 flex items-center gap-4">
                <video src={video.video_url} className="w-32 h-20 object-cover rounded-lg bg-black" muted />
                
                <div className="flex-1">
                  <h4 className="text-white font-semibold">Video {idx + 1}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${video.is_active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
                    {video.is_active ? 'Visible' : 'Hidden'}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={() => reorder(video.id, 'up')} disabled={idx === 0} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30">
                    <ArrowUpIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => reorder(video.id, 'down')} disabled={idx === videos.length - 1} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30">
                    <ArrowDownIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggleActive(video.id, video.is_active)} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-white/10 rounded">
                    {video.is_active ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button onClick={() => deleteVideo(video.id)} className="p-2 text-red-400 hover:text-red-300 hover:bg-white/10 rounded">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

