import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [talent, setTalent] = useState<TalentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedTalent, setRelatedTalent] = useState<TalentWithDetails[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [playingPromoVideo, setPlayingPromoVideo] = useState(false);
  const [ordersRemaining, setOrdersRemaining] = useState<number>(10);

  // Capture UTM tracking and store in localStorage
  // utm=1 means "self_promo" - ONLY tracks for this specific talent
  // All other UTMs (rumble, twitter, etc.) are GLOBAL - track for any talent ordered
  useEffect(() => {
    const utmParam = searchParams.get('utm');
    const talentIdentifier = username || id;
    
    if (utmParam === '1' && talentIdentifier) {
      // Self-promo: store per-talent (only tracks if they order from THIS talent)
      localStorage.setItem(`promo_source_${talentIdentifier}`, 'self_promo');
    } else if (utmParam && utmParam !== '1') {
      // Global UTM: store globally (tracks for ANY talent they order from)
      localStorage.setItem('promo_source_global', utmParam);
    }
  }, [searchParams, username, id]);

  // Also store self-promo by talent's actual ID once loaded (for order page lookup)
  useEffect(() => {
    const utmParam = searchParams.get('utm');
    
    if (utmParam === '1' && talent?.id) {
      // Self-promo: store by talent profile ID (used by order page)
      localStorage.setItem(`promo_source_${talent.id}`, 'self_promo');
      // Also store by username if available
      if (talent.username) {
        localStorage.setItem(`promo_source_${talent.username}`, 'self_promo');
      }
    }
  }, [searchParams, talent?.id, talent?.username]);
  
  // Helper for onClick handlers
  const storePromoSourceOnClick = () => {
    const utmParam = searchParams.get('utm');
    if (utmParam === '1' && talent?.id) {
      localStorage.setItem(`promo_source_${talent.id}`, 'self_promo');
    }
    // Global UTMs are already stored, no need to do anything on click
  };

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
      console.log('🎬 Fetching videos for talent_id:', talentData.id);
      const { data: videosData, error: videosError } = await supabase
        .from('orders')
        .select('video_url, created_at')
        .eq('talent_id', talentData.id)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);

      console.log('🎬 Videos query result:', { videosData, videosError });
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

      // Fetch other talent (random, not just same category)
      // First try same category, then fill with others if needed
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
        .eq('is_active', true)
        .neq('id', talentData.id)
        .limit(8); // Fetch more to shuffle and pick from

      if (relatedError) throw relatedError;
      
      // Shuffle the results to show random talent each time
      const shuffled = (relatedData || []).sort(() => Math.random() - 0.5).slice(0, 4);

      // Handle incomplete profiles in related talent
      const relatedWithUsers = shuffled.map(profile => {
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
      {/* Hero Banner */}
      <div className="rounded-2xl px-6 py-3 mb-6 flex items-center justify-center gap-4 border border-white/10 bg-white/5">
        <p className="text-white/80 text-sm sm:text-base font-medium">
          Get personalized video ShoutOuts from top conservative voices.
        </p>
        <div className="flex items-center gap-1">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill="url(#starGradientProfile)">
                <defs>
                  <linearGradient id="starGradientProfile" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
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
          <div className="md:w-2/3 p-4 md:p-5 relative z-10 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {/* Name and Rating inline */}
                <div className="flex items-center justify-between mb-1">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    {talent.temp_full_name || talent.users.full_name}
                  </h1>
                  <button 
                    onClick={() => setShareModalOpen(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    title="Share talent profile"
                  >
                    <ShareIcon className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Rating */}
                <div className="flex items-center mb-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.floor(talent.average_rating || 0)
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-1.5 text-sm font-semibold text-gray-900">
                    {talent.average_rating ? talent.average_rating.toFixed(1) : '0.0'}
                  </span>
                  <span className="ml-1 text-xs text-gray-500">
                    ({talent.reviews.length})
                  </span>
                  {/* Verified Badge inline */}
                  {talent.is_verified && (
                    <CheckBadgeIcon className="h-4 w-4 text-blue-500 ml-2" title="Verified" />
                  )}
                </div>
                
                {/* Categories - compact */}
                <div className="flex items-center flex-wrap gap-1.5 mb-2">
                  {talent.categories && talent.categories.length > 0 ? (
                    talent.categories.slice(0, 2).map((category, index) => (
                      <span key={index} className="glass-light border border-white/20 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                        {getCategoryLabel(category)}
                      </span>
                    ))
                  ) : talent.category && talent.category.toLowerCase() !== 'other' && (
                    <span className="glass border border-white/20 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                      {getCategoryLabel(talent.category)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bio - condensed */}
            <p className="text-sm text-gray-600 mb-2 leading-relaxed line-clamp-3">
              {talent.bio}
            </p>

            {/* Stats - Simple inline text */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-gray-400 mb-3">
              <span className="font-bold text-white">${talent.pricing}</span>
              <span className="text-gray-500">•</span>
              <span className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-0.5" />
                {talent.fulfillment_time_hours}h delivery
              </span>
              {(talent.charity_percentage && Number(talent.charity_percentage) > 0 && talent.charity_name) && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="flex items-center text-purple-400">
                    <HeartIcon className="h-4 w-4 mr-0.5" />
                    {talent.charity_percentage}% to {talent.charity_name}
                  </span>
                </>
              )}
            </div>

            {/* Order Ideas - Click any to order */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300 text-center">Choose a ShoutOut type</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  to={user ? `/order/${talent.id}?occasion=roast` : `/signup?returnTo=/order/${talent.id}?occasion=roast`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
                >
                  🎁 Gag gift for a liberal
                </Link>
                <Link
                  to={user ? `/order/${talent.id}?occasion=pep-talk` : `/signup?returnTo=/order/${talent.id}?occasion=pep-talk`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
                >
                  💝 Surprise a loved one
                </Link>
                <Link
                  to={user ? `/order/${talent.id}?occasion=holiday` : `/signup?returnTo=/order/${talent.id}?occasion=holiday`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
                >
                  🎄 Merry Christmas
                </Link>
                <Link
                  to={user ? `/order/${talent.id}?occasion=birthday` : `/signup?returnTo=/order/${talent.id}?occasion=birthday`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
                >
                  🎂 Happy Birthday
                </Link>
                <Link
                  to={user ? `/order/${talent.id}?occasion=roast` : `/signup?returnTo=/order/${talent.id}?occasion=roast`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
                >
                  🔥 Holiday roast
                </Link>
                <Link
                  to={user ? `/order/${talent.id}?occasion=advice` : `/signup?returnTo=/order/${talent.id}?occasion=advice`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
                >
                  💡 Get advice
                </Link>
                <Link
                  to={user ? `/order/${talent.id}?occasion=other` : `/signup?returnTo=/order/${talent.id}?occasion=other`}
                  onClick={storePromoSourceOnClick}
                  className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center col-span-2"
                >
                  ✨ Other
                </Link>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-2 text-center">
              <div className="text-sm font-medium text-gray-400">
                🔒 Money-Back Guarantee • 🛡️ Secure • ⚡ Fast
              </div>
            </div>

            {/* Pricing Urgency Indicator - flush at bottom */}
            {ordersRemaining <= 10 && (
              <div className="mt-4 -mx-4 md:-mx-5 -mb-4 md:-mb-5 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/30 to-red-500/30 border-t border-orange-400/50 px-4 py-3">
                <FireIcon className="h-5 w-5 text-orange-400" />
                <span className="text-sm font-bold text-orange-100">
                  Only {ordersRemaining} left at this price!
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Social Media Links */}
      {(() => {
        // Combine social_accounts with direct handle columns
        const socialLinks: { platform: string; handle: string; url: string }[] = [];
        
        // Add from social_accounts relation
        if (talent.social_accounts?.length > 0) {
          talent.social_accounts.forEach(account => {
            socialLinks.push({
              platform: account.platform,
              handle: account.handle,
              url: `https://${account.platform}.com/${account.handle.replace('@', '')}`
            });
          });
        }
        
        // Add from direct columns (if not already present)
        const directHandles = [
          { platform: 'twitter', handle: (talent as any).twitter_handle, url: 'https://x.com/' },
          { platform: 'instagram', handle: (talent as any).instagram_handle, url: 'https://instagram.com/' },
          { platform: 'facebook', handle: (talent as any).facebook_handle, url: 'https://facebook.com/' },
          { platform: 'tiktok', handle: (talent as any).tiktok_handle, url: 'https://tiktok.com/@' }
        ];
        
        directHandles.forEach(({ platform, handle, url }) => {
          if (handle && !socialLinks.find(s => s.platform === platform)) {
            socialLinks.push({
              platform,
              handle: handle.replace('@', ''),
              url: url + handle.replace('@', '')
            });
          }
        });
        
        if (socialLinks.length === 0) return null;
        
        return (
          <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Follow {talent.temp_full_name || talent.users.full_name}</h2>
            <div className="flex flex-wrap gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
                >
                  <span className="font-medium capitalize">{link.platform === 'twitter' ? 'X' : link.platform}</span>
                  <span className="text-gray-600">@{link.handle}</span>
                </a>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Recent Orders Section - Show videos if available, or "Be the first" CTA if no videos */}
      <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
        {talent.recent_videos.length > 0 ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Orders</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {talent.recent_videos.map((videoUrl, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 w-48 h-64 md:w-56 md:h-72">
                  <VideoPlayer 
                    videoUrl={videoUrl}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Be the first to order from {talent.temp_full_name || talent.users.full_name}!
            </h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Get a personalized video message for any occasion
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              <span className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 border border-white/20">
                🎂 Birthday Wishes
              </span>
              <span className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 border border-white/20">
                🔥 Roasts
              </span>
              <span className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 border border-white/20">
                🎄 Holiday Greetings
              </span>
              <span className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 border border-white/20">
                💪 Motivation
              </span>
              <span className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 border border-white/20">
                🎉 Congratulations
              </span>
              <span className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 border border-white/20">
                ❤️ Anniversary
              </span>
            </div>
            <Link
              to={user ? `/order/${talent.id}` : `/signup?returnTo=/order/${talent.id}`}
              onClick={storePromoSourceOnClick}
              className="inline-block px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg"
            >
              Order Now - ${talent.pricing}
            </Link>
          </div>
        )}
      </div>

      {/* Reviews Section - Only show if there are reviews */}
      {talent.reviews.length > 0 && (
        <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Reviews ({talent.reviews.length})
          </h2>
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
        </div>
      )}

      {/* Related Talent - Always show */}
      {relatedTalent.length > 0 && (
        <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Others like {talent.temp_full_name || talent.users.full_name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedTalent.map((related) => (
              <Link
                key={related.id}
                to={related.username ? `/${related.username}` : `/talent/${related.id}`}
                className="block bg-white/10 rounded-xl p-4 hover:bg-white/20 transition-colors border border-white/10"
              >
                <div className="aspect-square bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {(related.temp_avatar_url || related.users.avatar_url) ? (
                    <img
                      src={related.temp_avatar_url || related.users.avatar_url}
                      alt={related.temp_full_name || related.users.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white/60">
                      {(related.temp_full_name || related.users.full_name).charAt(0)}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-white mb-1 truncate">
                  {related.temp_full_name || related.users.full_name}
                </h3>
                <div className="text-lg font-bold text-green-400">
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
