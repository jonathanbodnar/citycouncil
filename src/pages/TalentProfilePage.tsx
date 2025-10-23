import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  StarIcon, 
  HeartIcon, 
  ClockIcon, 
  PlayIcon,
  ShareIcon,
  CheckBadgeIcon 
} from '@heroicons/react/24/solid';
import { 
  StarIcon as StarOutline
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, Review, SocialAccount } from '../types';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import ShareModal from '../components/ShareModal';
import toast from 'react-hot-toast';

interface TalentWithDetails extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  social_accounts: SocialAccount[];
  reviews: (Review & {
    users: {
      full_name: string;
    };
  })[];
  recent_videos: string[];
}

const TalentProfilePage: React.FC = () => {
  const { id, username } = useParams<{ id?: string; username?: string }>();
  const { user } = useAuth();
  const [talent, setTalent] = useState<TalentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedTalent, setRelatedTalent] = useState<TalentWithDetails[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    if (id || username) {
      fetchTalentProfile();
    }
  }, [id, username]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTalentProfile = async () => {
    try {
      // Fetch talent profile with related data (by ID or username)
      let query = supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          ),
          social_accounts (
            platform,
            handle
          )
        `)
        .eq('is_active', true);

      if (id) {
        query = query.eq('id', id);
      } else if (username) {
        query = query.eq('username', username.toLowerCase());
      }

      const { data: talentData, error: talentError } = await query.single();

      if (talentError) throw talentError;

      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          users!reviews_user_id_fkey (
            full_name
          )
        `)
        .eq('talent_id', talentData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reviewsError) throw reviewsError;

      // Fetch recent videos from completed orders
      const { data: videosData, error: videosError } = await supabase
        .from('orders')
        .select('video_url, created_at')
        .eq('talent_id', talentData.id)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);

      if (videosError) throw videosError;

      // Fetch related talent (same category)
      const { data: relatedData, error: relatedError } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('category', talentData.category)
        .eq('is_active', true)
        .neq('id', talentData.id)
        .limit(4);

      if (relatedError) throw relatedError;

      setTalent({
        ...talentData,
        reviews: reviewsData || [],
        recent_videos: videosData?.map(v => v.video_url).filter(Boolean) || [],
      });

      setRelatedTalent(relatedData || []);
    } catch (error) {
      console.error('Error fetching talent profile:', error);
      toast.error('Failed to load talent profile');
    } finally {
      setLoading(false);
    }
  };

  const getDemandLevel = (totalOrders: number) => {
    if (totalOrders > 20) return { level: 'High Demand', color: 'bg-red-100 text-red-800', intensity: 'high' };
    if (totalOrders > 10) return { level: 'Popular', color: 'bg-yellow-100 text-yellow-800', intensity: 'medium' };
    return { level: 'Available', color: 'bg-green-100 text-green-800', intensity: 'low' };
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'tv-host': 'TV/Radio Host',
      'politician': 'Politician',
      'commentator': 'Commentator',
      'author': 'Author/Speaker',
      // Add more mappings as needed
    };
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Talent Not Found</h1>
          <p className="text-gray-600">The talent profile you're looking for doesn't exist.</p>
          <Link to="/home" className="mt-4 inline-block bg-primary-600 text-white px-4 py-2 rounded-md">
            Browse All Talent
          </Link>
        </div>
      </div>
    );
  }

  const demand = getDemandLevel(talent.total_orders);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 overflow-hidden mb-8">
        <div className="md:flex">
          {/* Avatar */}
          <div className="md:w-1/3">
            <div className="h-full min-h-[400px] bg-gray-100 relative">
              {(talent.temp_avatar_url || talent.users.avatar_url) ? (
                <img
                  src={talent.temp_avatar_url || talent.users.avatar_url}
                  alt={talent.temp_full_name || talent.users.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-100">
                  <span className="text-6xl font-bold text-primary-600">
                    {(talent.temp_full_name || talent.users.full_name).charAt(0)}
                  </span>
                </div>
              )}
              
              {/* Demand Badge */}
              <div className={`absolute top-4 left-4 px-4 py-2 rounded-2xl text-sm font-bold glass-strong border border-white/40 ${demand.color}`}>
                {demand.level}
              </div>

              {/* Charity Badge */}
              {talent.charity_percentage && Number(talent.charity_percentage) > 0 && talent.charity_name && (
                <div className="absolute top-4 right-4 p-3 glass-strong rounded-2xl shadow-modern border border-white/40 glow-red animate-glow-pulse">
                  <HeartIcon className="h-6 w-6 text-red-600" />
                </div>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="md:w-2/3 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                {/* Position Title */}
                {talent.position && (
                  <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide">
                    {talent.position}
                  </p>
                )}
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {talent.temp_full_name || talent.users.full_name}
                </h1>
                <div className="flex items-center space-x-4 mb-4">
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-modern">
                    {getCategoryLabel(talent.category)}
                  </span>
                  {talent.is_verified && (
                    <div className="flex items-center gap-1">
                      <CheckBadgeIcon className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-gray-600">Verified</span>
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => setShareModalOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Share talent profile"
              >
                <ShareIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Rating */}
            <div className="flex items-center mb-4">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.floor(talent.average_rating || 0)
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="ml-2 text-lg font-semibold text-gray-900">
                {talent.average_rating ? talent.average_rating.toFixed(1) : '0.0'}
              </span>
              <span className="ml-2 text-gray-600">
                ({talent.reviews.length} reviews)
              </span>
            </div>

            {/* Bio */}
            <p className="text-gray-700 mb-4 leading-relaxed">
              {talent.bio}
            </p>

            {/* Stats - Clean Glass Layout */}
            <div className="glass-strong rounded-2xl p-4 mb-4 border border-white/30">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">${talent.pricing}</div>
                  <div className="text-xs text-gray-600 font-medium">Personal</div>
                  {talent.allow_corporate_pricing && talent.corporate_pricing && talent.corporate_pricing !== talent.pricing && (
                    <div className="text-sm font-semibold text-blue-600">${talent.corporate_pricing} Corp</div>
                  )}
                </div>
                
                <div className="flex-1 border-l border-white/30">
                  <div className="text-xl font-bold text-primary-600 flex items-center justify-center">
                    <ClockIcon className="h-5 w-5 mr-1" />
                    {talent.fulfillment_time_hours}h
                  </div>
                  <div className="text-xs text-gray-600">Delivery</div>
                </div>
                
                <div className="flex-1 border-l border-white/30">
                  <div className="text-xl font-bold text-blue-600">{talent.total_orders}</div>
                  <div className="text-xs text-gray-600 font-medium">Orders</div>
                </div>
                
                {talent.charity_percentage && Number(talent.charity_percentage) > 0 && talent.charity_name && (
                  <div className="flex-1 border-l border-white/30">
                    <div className="text-xl font-bold text-red-600 flex items-center justify-center">
                      <HeartIcon className="h-5 w-5 mr-1" />
                      {talent.charity_percentage}%
                    </div>
                    <div className="text-xs text-gray-600 font-medium">To Charity</div>
                  </div>
                )}
              </div>
            </div>

            {/* Charity Info */}
            {talent.charity_name && talent.charity_percentage && Number(talent.charity_percentage) > 0 && (
              <div className="glass-strong p-4 rounded-2xl mb-4 border border-white/30">
                <div className="flex items-center">
                  <HeartIcon className="h-5 w-5 text-red-600 mr-3" />
                  <span className="font-bold text-red-800">
                    {talent.charity_percentage}% of proceeds go to {talent.charity_name}
                  </span>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <Link
              to={user ? `/order/${talent.id}` : '/login'}
              className="w-full bg-gradient-to-r from-blue-600 to-red-600 text-white py-4 px-8 rounded-2xl font-bold hover:from-blue-700 hover:to-red-700 transition-all duration-300 flex items-center justify-center shadow-modern-lg hover:shadow-modern-xl glow-blue hover:scale-[1.02]"
            >
              Order ShoutOut - Starting at ${talent.pricing}
            </Link>

            {/* Trust Indicators */}
            <div className="mt-4 text-center">
              <div className="text-sm text-gray-600">
                🔒 100% Money-Back Guarantee • 🛡️ Secure Payment • ⚡ Fast Delivery
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Media Links */}
      {talent.social_accounts.length > 0 && (
        <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Follow {talent.temp_full_name || talent.users.full_name}</h2>
          <div className="flex flex-wrap gap-4">
            {talent.social_accounts.map((account) => (
              <a
                key={account.platform}
                href={`https://${account.platform}.com/${account.handle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                <span className="font-medium capitalize">{account.platform}</span>
                <span className="text-gray-600">{account.handle}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recent Videos Section */}
      <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Videos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {talent.recent_videos.length > 0 ? (
            talent.recent_videos.slice(0, 6).map((videoUrl, index) => (
              <div key={index} className="aspect-video">
                <VideoPlayer 
                  videoUrl={videoUrl}
                  className="w-full h-full"
                />
              </div>
            ))
          ) : (
            /* Placeholder for no videos */
            [1, 2, 3].map((i) => (
              <div key={i} className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <PlayIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600">No videos yet</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Reviews ({talent.reviews.length})
        </h2>
        
        {talent.reviews.length > 0 ? (
          <div className="space-y-6">
            {talent.reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium">
                        {review.users.full_name.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="font-medium text-gray-900 mr-2">
                        {review.users.full_name}
                      </span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="ml-2 text-sm text-gray-600">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-gray-700">{review.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <StarOutline className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reviews yet. Be the first to order!</p>
          </div>
        )}
      </div>

      {/* Related Talent */}
      {relatedTalent.length > 0 && (
        <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            More {getCategoryLabel(talent.category)}s
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedTalent.map((related) => (
              <Link
                key={related.id}
                to={`/talent/${related.id}`}
                className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                  {related.users.avatar_url ? (
                    <img
                      src={related.users.avatar_url}
                      alt={related.users.full_name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-primary-600">
                      {related.users.full_name.charAt(0)}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 mb-1">
                  {related.users.full_name}
                </h3>
                <div className="text-lg font-bold text-primary-600">
                  ${related.pricing}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && talent && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          talentName={talent.temp_full_name || talent.users.full_name}
          talentSocialHandles={{
            twitter: talent.social_accounts?.find(acc => acc.platform === 'twitter')?.handle,
            facebook: talent.social_accounts?.find(acc => acc.platform === 'facebook')?.handle,
            instagram: talent.social_accounts?.find(acc => acc.platform === 'instagram')?.handle,
            tiktok: talent.social_accounts?.find(acc => acc.platform === 'tiktok')?.handle,
            linkedin: talent.social_accounts?.find(acc => acc.platform === 'linkedin')?.handle,
          }}
        />
      )}
    </div>
  );
};

export default TalentProfilePage;
