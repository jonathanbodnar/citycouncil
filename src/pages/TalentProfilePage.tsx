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
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="md:flex">
          {/* Avatar */}
          <div className="md:w-1/3">
            <div className="aspect-square bg-gray-100 relative">
              {talent.users.avatar_url ? (
                <img
                  src={talent.users.avatar_url}
                  alt={talent.users.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-100">
                  <span className="text-6xl font-bold text-primary-600">
                    {talent.users.full_name.charAt(0)}
                  </span>
                </div>
              )}
              
              {/* Demand Badge */}
              <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium ${demand.color}`}>
                {demand.level}
              </div>

              {/* Charity Badge */}
              {talent.charity_percentage && talent.charity_percentage > 0 && (
                <div className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm">
                  <HeartIcon className="h-6 w-6 text-red-500" />
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
                  {talent.users.full_name}
                </h1>
                <div className="flex items-center space-x-4 mb-4">
                  <span className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium">
                    {getCategoryLabel(talent.category)}
                  </span>
                  <CheckBadgeIcon className="h-5 w-5 text-blue-500" />
                  <span className="text-sm text-gray-600">Verified</span>
                </div>
              </div>
              
              <button className="p-2 text-gray-400 hover:text-gray-600">
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
            <p className="text-gray-700 mb-6 leading-relaxed">
              {talent.bio}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">
                  ${talent.pricing}
                </div>
                <div className="text-sm text-gray-600">Personal</div>
                {talent.corporate_pricing && talent.corporate_pricing !== talent.pricing && (
                  <>
                    <div className="text-lg font-bold text-gray-700 mt-1">
                      ${talent.corporate_pricing}
                    </div>
                    <div className="text-xs text-gray-500">Corporate</div>
                  </>
                )}
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 flex items-center justify-center">
                  <ClockIcon className="h-6 w-6 mr-1" />
                  {talent.fulfillment_time_hours}h
                </div>
                <div className="text-sm text-gray-600">Delivery</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {talent.total_orders}
                </div>
                <div className="text-sm text-gray-600">Orders</div>
              </div>
              {talent.charity_percentage && talent.charity_percentage > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500 flex items-center justify-center">
                    <HeartIcon className="h-6 w-6 mr-1" />
                    {talent.charity_percentage}%
                  </div>
                  <div className="text-sm text-gray-600">To Charity</div>
                </div>
              )}
            </div>

            {/* Charity Info */}
            {talent.charity_name && (
              <div className="bg-red-50 p-4 rounded-lg mb-6">
                <div className="flex items-center">
                  <HeartIcon className="h-5 w-5 text-red-500 mr-2" />
                  <span className="font-medium text-red-900">
                    {talent.charity_percentage}% of proceeds go to {talent.charity_name}
                  </span>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <Link
              to={user ? `/order/${talent.id}` : '/login'}
              className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center"
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
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Follow {talent.users.full_name}</h2>
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
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
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
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
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
        <div className="bg-white rounded-lg shadow-sm p-6">
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
    </div>
  );
};

export default TalentProfilePage;
