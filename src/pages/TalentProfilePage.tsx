import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  StarIcon, 
  HeartIcon, 
  ClockIcon, 
  PlayIcon,
  ShareIcon,
  CheckBadgeIcon,
  FireIcon
} from '@heroicons/react/24/solid';
import { 
  StarIcon as StarOutline
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, Review, SocialAccount } from '../types';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import ShareModal from '../components/ShareModal';
import FOMONotification from '../components/FOMONotification';
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
  const [playingPromoVideo, setPlayingPromoVideo] = useState(false);
  const [ordersRemaining, setOrdersRemaining] = useState<number>(10);

  useEffect(() => {
    if (id || username) {
      // Reset state when route changes to prevent showing previous talent's data
      setTalent(null);
      setRelatedTalent([]);
      setLoading(true);
      fetchTalentProfile();
    }
  }, [id, username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update meta tags for social sharing
  useEffect(() => {
    if (talent) {
      const talentName = talent.temp_full_name || talent.users.full_name;
      const profileUrl = window.location.href;
      const description = talent.bio || `Get a personalized video ShoutOut from ${talentName}. Order custom video messages from your favorite personalities!`;
      const imageUrl = talent.temp_avatar_url || talent.users.avatar_url || 'https://shoutout.us/logo512.png';

      // Update basic meta tags
      document.title = `${talentName} - Personalized Video ShoutOuts`;
      
      // Update description meta tag
      const descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (descriptionTag) {
        descriptionTag.content = description;
      }
      
      // Update or create Open Graph meta tags
      const updateMetaTag = (property: string, content: string) => {
        let metaTag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('property', property);
          document.head.appendChild(metaTag);
        }
        metaTag.content = content;
      };

      // Update or create Twitter meta tags
      const updateTwitterTag = (name: string, content: string) => {
        let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('name', name);
          document.head.appendChild(metaTag);
        }
        metaTag.content = content;
      };

      // Open Graph tags - with full image URL
      updateMetaTag('og:title', `${talentName} - Personalized Video ShoutOuts`);
      updateMetaTag('og:description', description);
      updateMetaTag('og:image', imageUrl);
      updateMetaTag('og:image:secure_url', imageUrl);
      updateMetaTag('og:image:type', 'image/jpeg');
      updateMetaTag('og:image:width', '1200');
      updateMetaTag('og:image:height', '630');
      updateMetaTag('og:url', profileUrl);
      updateMetaTag('og:type', 'profile');
      updateMetaTag('og:site_name', 'ShoutOut');
      updateMetaTag('fb:app_id', '202212960836121');

      // Twitter Card tags
      updateTwitterTag('twitter:card', 'summary_large_image');
      updateTwitterTag('twitter:title', `${talentName} - Personalized Video ShoutOuts`);
      updateTwitterTag('twitter:description', description);
      updateTwitterTag('twitter:image', imageUrl);
      updateTwitterTag('twitter:image:alt', `${talentName} profile picture`);

      // SEO Keywords - comprehensive for Google search
      const generateKeywords = () => {
        const baseKeywords = [
          talentName,
          `${talentName} video`,
          `${talentName} shoutout`,
          `${talentName} cameo`,
          `${talentName} personalized video`,
          'conservative gifts',
          'conservative shoutouts',
          'conservative video messages',
          'cameo christmas',
          'christmas video message',
          'custom video message',
          'personalized shoutout',
          'celebrity video',
          'get a custom video',
          'order video message',
          'personalized video greeting',
          'conservative christmas gifts',
          'republican gifts',
          'patriotic gifts'
        ];

        // Add category-specific keywords
        const category = talent.category?.toLowerCase() || '';
        if (category.includes('political') || category.includes('commentator')) {
          baseKeywords.push(
            'political commentator video',
            'conservative political figure',
            'republican personality',
            'political video message'
          );
        }
        if (category.includes('faith')) {
          baseKeywords.push(
            'christian video message',
            'faith leader video',
            'religious greeting',
            'christian conservative gift'
          );
        }
        if (category.includes('patriot')) {
          baseKeywords.push(
            'patriotic video message',
            'american patriot video',
            'conservative patriot gift'
          );
        }

        // Add bio keywords (extract important terms)
        if (talent.bio) {
          const bioWords = talent.bio.toLowerCase().split(/\s+/);
          const importantTerms = ['host', 'author', 'speaker', 'founder', 'ceo', 'president', 'judge', 'senator', 'congressman'];
          bioWords.forEach(word => {
            if (importantTerms.some(term => word.includes(term))) {
              baseKeywords.push(`${talentName} ${word}`);
            }
          });
        }

        return baseKeywords.join(', ');
      };

      // Update keywords meta tag
      let keywordsTag = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
      if (!keywordsTag) {
        keywordsTag = document.createElement('meta');
        keywordsTag.setAttribute('name', 'keywords');
        document.head.appendChild(keywordsTag);
      }
      keywordsTag.content = generateKeywords();

      console.log('📱 Meta tags updated:', {
        title: `${talentName} - Personalized Video ShoutOuts`,
        image: imageUrl,
        description: description.substring(0, 50) + '...',
        keywords: generateKeywords().split(', ').slice(0, 5).join(', ') + '...'
      });

      // Return cleanup function
      return () => {
        document.title = 'ShoutOut';
      };
    }
  }, [talent]);

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

      // Handle incomplete profiles - create synthetic user object if needed
      if (!talentData.users) {
        talentData.users = {
          id: talentData.user_id || '',
          full_name: talentData.temp_full_name || 'Unknown',
          avatar_url: talentData.temp_avatar_url || null,
        };
      }

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

      // Fetch pricing urgency data
      const { data: urgencyData, error: urgencyError } = await supabase
        .from('talent_pricing_urgency')
        .select('orders_remaining_at_price')
        .eq('id', talentData.id)
        .single();

      if (!urgencyError && urgencyData) {
        setOrdersRemaining(urgencyData.orders_remaining_at_price);
      }

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

      // Handle incomplete profiles in related talent
      const relatedWithUsers = (relatedData || []).map(profile => {
        if (!profile.users) {
          return {
            ...profile,
            users: {
              id: profile.user_id || '',
              full_name: profile.temp_full_name || 'Unknown',
              avatar_url: profile.temp_avatar_url || null,
            },
          };
        }
        return profile;
      });

      setTalent({
        ...talentData,
        reviews: reviewsData || [],
        recent_videos: videosData?.map(v => v.video_url).filter(Boolean) || [],
      });

      setRelatedTalent(relatedWithUsers);
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
          <Link to="/" className="mt-4 inline-block bg-primary-600 text-white px-4 py-2 rounded-md">
            Browse All Talent
          </Link>
        </div>
      </div>
    );
  }

  const demand = getDemandLevel(talent.total_orders);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Black Friday Banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 p-4 sm:p-6 text-center shadow-2xl animate-pulse border-2 border-yellow-400">
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-2xl sm:text-3xl">🦃</span>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
            Black Friday Deal Is LIVE!
          </h2>
          <span className="text-2xl sm:text-3xl">🎉</span>
        </div>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base md:text-lg text-white font-semibold">
          Get <span className="text-yellow-300 text-xl sm:text-2xl font-bold">25% OFF</span> all ShoutOuts with code{' '}
          <span className="bg-yellow-300 text-red-700 px-2 sm:px-3 py-1 rounded-lg font-mono font-bold text-base sm:text-xl">
            GOBBLE25
          </span>
        </p>
        <p className="mt-2 text-xs sm:text-sm text-yellow-100 font-medium">
          ⏰ Ends Monday! Don't miss out!
        </p>
      </div>

      {/* Hero Section */}
      <div className="gradient-border rounded-3xl shadow-modern-xl mb-8">
        <div className="md:flex rounded-3xl overflow-hidden relative">
          {/* Background Gradient - Desktop */}
          <div 
            className="hidden md:block absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #0b0123 0%, #905476 100%)'
            }}
          ></div>
          
          {/* Avatar / Promo Video */}
          <div className="md:w-1/3 relative z-10">
            <div className="aspect-square md:aspect-auto md:h-full md:min-h-[400px] bg-gray-100 relative group">
              {playingPromoVideo && talent.promo_video_url ? (
                /* Playing Promo Video */
                <video
                  src={talent.promo_video_url}
                  autoPlay
                  controls
                  onEnded={() => setPlayingPromoVideo(false)}
                  className="w-full h-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <>
                  {/* Profile Image */}
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
                  
                  {/* Play Button Overlay - Only show if promo video exists */}
                  {talent.promo_video_url && (
                    <button
                      onClick={() => setPlayingPromoVideo(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-all duration-300"
                    >
                      <div className="glass-strong p-6 rounded-full border-2 border-white/60 glow-blue hover:scale-110 transition-transform duration-300">
                        <PlayIcon className="h-16 w-16 text-white drop-shadow-lg" />
                      </div>
                    </button>
                  )}
                </>
              )}
              
              {/* Demand Badge */}
              <div className={`absolute top-3 left-3 md:top-4 md:left-4 px-3 md:px-4 py-1 md:py-2 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold glass-strong border border-white/40 ${demand.color}`}>
                {demand.level}
              </div>

            </div>
          </div>

          {/* Profile Info */}
          <div className="md:w-2/3 p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                {/* Position Title */}
                {talent.position && (
                  <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide">
                    {talent.position}
                  </p>
                )}
                
                {/* Name and Reviews - Desktop Side by Side */}
                <div className="md:flex md:items-center md:justify-between mb-2">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2 md:mb-0">
                    {talent.temp_full_name || talent.users.full_name}
                  </h1>
                  
                  {/* Rating - Right side on desktop */}
                  <div className="flex items-center">
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
                </div>
                
                <div className="flex items-center flex-wrap gap-3 mb-4">
                  {/* Categories */}
                  {talent.categories && talent.categories.length > 0 ? (
                    talent.categories.map((category, index) => (
                      <span key={index} className="glass-light border border-white/20 text-white px-4 py-2 rounded-full text-sm font-bold">
                        {getCategoryLabel(category)}
                      </span>
                    ))
                  ) : (
                    <span className="glass border border-white/20 text-white px-4 py-2 rounded-full text-sm font-bold">
                      {getCategoryLabel(talent.category)}
                    </span>
                  )}
                  
                  {/* Verified Badge */}
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

            {/* Bio */}
            <p className="text-gray-700 mb-4 leading-relaxed">
              {talent.bio}
            </p>

            {/* Stats - Clean Glass Layout */}
            <div className="glass-strong rounded-2xl px-6 py-4 mb-4 border border-white/30">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <div className="text-2xl font-bold" style={{ color: '#ffffff' }}>${talent.pricing}</div>
                  <div className="text-xs text-gray-600 font-medium">Personal</div>
                  {talent.allow_corporate_pricing && talent.corporate_pricing && talent.corporate_pricing !== talent.pricing && (
                    <div className="text-sm font-semibold text-gray-400">${talent.corporate_pricing} Corp</div>
                  )}
                </div>
                
                <div className="flex-1 border-l border-white/30">
                  <div className="text-xl font-bold flex items-center justify-center" style={{ color: '#ffffff' }}>
                    <ClockIcon className="h-5 w-5 mr-1" />
                    {talent.fulfillment_time_hours}h
                  </div>
                  <div className="text-xs text-gray-600">Delivery</div>
                </div>
                
                <div className="flex-1 border-l border-white/30">
                  <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{talent.total_orders}</div>
                  <div className="text-xs text-gray-600 font-medium">Orders</div>
                </div>
                
                {(talent.charity_percentage && Number(talent.charity_percentage) > 0 && talent.charity_name) ? (
                  <div className="flex-1 border-l border-white/30">
                    <div className="text-xl font-bold flex items-center justify-center" style={{ color: '#ffffff' }}>
                      <HeartIcon className="h-5 w-5 mr-1" />
                      {talent.charity_percentage}%
                    </div>
                    <div className="text-xs text-gray-600 font-medium">To Charity</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Charity Info */}
            {(talent.charity_name && talent.charity_percentage && Number(talent.charity_percentage) > 0) ? (
              <div className="mb-4">
                <div className="flex items-center">
                  <HeartIcon className="h-5 w-5 text-purple-400 mr-3" />
                  <span className="font-bold text-purple-300">
                    {talent.charity_percentage}% of proceeds go to {talent.charity_name}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Pricing Urgency Indicator - Above Order Button */}
            {ordersRemaining <= 10 && (
              <div className="mb-3 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/50 rounded-xl px-4 py-3 animate-pulse">
                <FireIcon className="h-5 w-5 text-orange-400" />
                <span className="text-sm font-bold text-orange-100">
                  Only {ordersRemaining} more {ordersRemaining === 1 ? 'order' : 'orders'} available at this price!
                </span>
              </div>
            )}

            {/* CTA Button */}
            <Link
              to={user ? `/order/${talent.id}` : `/signup?returnTo=/order/${talent.id}`}
              className="w-full text-white py-4 px-8 rounded-2xl font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center shadow-modern-lg hover:shadow-modern-xl hover:scale-[1.02]"
              style={{ backgroundColor: '#3a86ff' }}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {talent.recent_videos.length > 0 ? (
            talent.recent_videos.slice(0, 8).map((videoUrl, index) => (
              <div key={index} className="relative rounded-xl overflow-hidden bg-gray-100 min-h-[200px] md:min-h-[160px]">
                <VideoPlayer 
                  videoUrl={videoUrl}
                  className="w-full h-full object-cover"
                />
              </div>
            ))
          ) : (
            /* Placeholder for no videos */
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="relative rounded-xl overflow-hidden bg-gray-100 min-h-[200px] md:min-h-[160px] flex items-center justify-center">
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
                to={related.username ? `/${related.username}` : `/talent/${related.id}`}
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
          talentProfileUrl={talent.username ? `/${talent.username}` : `/talent/${talent.id}`}
          isTalentPage={true}
          videoUrl={talent.promo_video_url}
          talentSocialHandles={{
            twitter: talent.social_accounts?.find(acc => acc.platform === 'twitter')?.handle,
            facebook: talent.social_accounts?.find(acc => acc.platform === 'facebook')?.handle,
            instagram: talent.social_accounts?.find(acc => acc.platform === 'instagram')?.handle,
            tiktok: talent.social_accounts?.find(acc => acc.platform === 'tiktok')?.handle,
            linkedin: talent.social_accounts?.find(acc => acc.platform === 'linkedin')?.handle,
          }}
        />
      )}

      {/* FOMO Notification - Shows fake recent orders */}
      {talent && <FOMONotification interval={8000} />}
    </div>
  );
};

export default TalentProfilePage;
