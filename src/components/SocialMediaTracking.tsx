import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { CheckCircleIcon, XCircleIcon, LinkIcon, HashtagIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface SocialMediaData {
  talent_id: string;
  talent_name: string;
  instagram_link: boolean;
  tiktok_link: boolean;
  twitter_link: boolean;
  instagram_tags: number;
  tiktok_tags: number;
  twitter_tags: number;
  last_checked: string;
}

const SocialMediaTracking: React.FC = () => {
  const [trackingData, setTrackingData] = useState<SocialMediaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    
    fetchSocialMediaData();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchSocialMediaData();
    }
  }, [startDate, endDate]);

  const fetchSocialMediaData = async () => {
    try {
      setLoading(true);

      // Fetch talent in promotion program
      const { data: talents, error: talentsError } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          temp_full_name,
          users!talent_profiles_user_id_fkey (
            full_name
          )
        `)
        .eq('is_participating_in_promotion', true);

      if (talentsError) throw talentsError;

      // Fetch bio tracking data
      const { data: bioData, error: bioError } = await supabase
        .from('social_media_bio_tracking')
        .select('*');

      if (bioError) throw bioError;

      // Fetch tag counts for date range
      const { data: tagData, error: tagError } = await supabase
        .from('social_media_tags')
        .select('talent_id, platform')
        .gte('post_date', startDate)
        .lte('post_date', endDate);

      if (tagError) throw tagError;

      // Combine data
      const combinedData: SocialMediaData[] = (talents || []).map(talent => {
        const talentId = talent.id;
        const talentName = talent.users?.full_name || talent.temp_full_name || 'Unknown';

        // Get bio tracking
        const instagramBio = bioData?.find(b => b.talent_id === talentId && b.platform === 'instagram');
        const tiktokBio = bioData?.find(b => b.talent_id === talentId && b.platform === 'tiktok');
        const twitterBio = bioData?.find(b => b.talent_id === talentId && b.platform === 'twitter');

        // Count tags by platform
        const instagramTags = tagData?.filter(t => t.talent_id === talentId && t.platform === 'instagram').length || 0;
        const tiktokTags = tagData?.filter(t => t.talent_id === talentId && t.platform === 'tiktok').length || 0;
        const twitterTags = tagData?.filter(t => t.talent_id === talentId && t.platform === 'twitter').length || 0;

        // Get most recent check date
        const lastChecked = [instagramBio, tiktokBio, twitterBio]
          .filter(Boolean)
          .map(b => new Date(b!.last_checked_at))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        return {
          talent_id: talentId,
          talent_name: talentName,
          instagram_link: instagramBio?.has_shoutout_link || false,
          tiktok_link: tiktokBio?.has_shoutout_link || false,
          twitter_link: twitterBio?.has_shoutout_link || false,
          instagram_tags: instagramTags,
          tiktok_tags: tiktokTags,
          twitter_tags: twitterTags,
          last_checked: lastChecked ? lastChecked.toLocaleDateString() : 'Never'
        };
      });

      setTrackingData(combinedData);
    } catch (error) {
      console.error('Error fetching social media data:', error);
      toast.error('Failed to load social media tracking data');
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon: React.FC<{ status: boolean }> = ({ status }) => (
    status ? (
      <CheckCircleIcon className="h-5 w-5 text-green-400" />
    ) : (
      <XCircleIcon className="h-5 w-5 text-red-400" />
    )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Social Media Tracking</h2>
          <p className="text-gray-300 mt-1">
            Track bio links and tagged posts for promotion program participants
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="glass-strong px-3 py-1.5 rounded-lg text-white border border-white/30 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="glass-strong px-3 py-1.5 rounded-lg text-white border border-white/30 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-strong rounded-xl p-4 border border-white/30">
          <p className="text-sm text-gray-300">Total Participants</p>
          <p className="text-2xl font-bold text-white mt-1">{trackingData.length}</p>
        </div>
        <div className="glass-strong rounded-xl p-4 border border-white/30">
          <p className="text-sm text-gray-300">With Bio Links</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {trackingData.filter(t => t.instagram_link || t.tiktok_link || t.twitter_link).length}
          </p>
        </div>
        <div className="glass-strong rounded-xl p-4 border border-white/30">
          <p className="text-sm text-gray-300">Total Tags (Period)</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {trackingData.reduce((sum, t) => sum + t.instagram_tags + t.tiktok_tags + t.twitter_tags, 0)}
          </p>
        </div>
        <div className="glass-strong rounded-xl p-4 border border-white/30">
          <p className="text-sm text-gray-300">Most Active</p>
          <p className="text-lg font-bold text-purple-400 mt-1">
            {trackingData.sort((a, b) => 
              (b.instagram_tags + b.tiktok_tags + b.twitter_tags) - 
              (a.instagram_tags + a.tiktok_tags + a.twitter_tags)
            )[0]?.talent_name.split(' ')[0] || 'N/A'}
          </p>
        </div>
      </div>

      {/* Tracking Table */}
      <div className="glass rounded-2xl shadow-modern overflow-hidden border border-white/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="glass-strong">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Talent
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <LinkIcon className="h-4 w-4" />
                    Instagram Link
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <HashtagIcon className="h-4 w-4" />
                    IG Tags
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <LinkIcon className="h-4 w-4" />
                    TikTok Link
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <HashtagIcon className="h-4 w-4" />
                    TT Tags
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <LinkIcon className="h-4 w-4" />
                    Twitter Link
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <HashtagIcon className="h-4 w-4" />
                    X Tags
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Last Checked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {trackingData.map((data) => (
                <tr key={data.talent_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-white">{data.talent_name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={data.instagram_link} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`text-sm font-semibold ${data.instagram_tags > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                      {data.instagram_tags}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={data.tiktok_link} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`text-sm font-semibold ${data.tiktok_tags > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                      {data.tiktok_tags}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={data.twitter_link} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`text-sm font-semibold ${data.twitter_tags > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                      {data.twitter_tags}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300">{data.last_checked}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {trackingData.length === 0 && (
            <div className="text-center py-12">
              <HashtagIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No promotion participants yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Talent who claim the promotion package will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Note about API integration */}
      <div className="glass-strong rounded-xl p-4 border border-yellow-500/30">
        <p className="text-sm text-yellow-400 font-medium">
          ⚠️ Note: Social media API integration is pending. Currently showing manual/test data.
        </p>
        <p className="text-xs text-gray-300 mt-1">
          Full automation with Instagram, TikTok, and Twitter APIs will be implemented next.
        </p>
      </div>
    </div>
  );
};

export default SocialMediaTracking;

