import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
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
import { ImageSizes } from '../utils/imageOptimization';

// Coupon configurations for instant giveaway prizes - defined outside component
const COUPON_DISCOUNTS: Record<string, { type: 'percentage' | 'fixed'; value: number; label: string }> = {
  'WINNER100': { type: 'fixed', value: 100, label: 'FREE' },
  'SANTA25': { type: 'percentage', value: 25, label: '25% OFF' },
  'SAVE15': { type: 'percentage', value: 15, label: '15% OFF' },
  'SAVE10': { type: 'percentage', value: 10, label: '10% OFF' },
  'TAKE25': { type: 'fixed', value: 25, label: '$25 OFF' },
};

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
  const { id, username: rawUsername } = useParams<{ id?: string; username?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Normalize username: remove spaces (%20), trim, lowercase
  // This handles URLs like /melonie%20mac -> /meloniemac
  const username = rawUsername ? rawUsername.replace(/\s+/g, '').toLowerCase() : undefined;
  
  // Redirect if URL contains spaces or uppercase - clean URL for SEO and sharing
  useEffect(() => {
    if (rawUsername && rawUsername !== username) {
      // Preserve query params when redirecting
      const queryString = searchParams.toString();
      const newUrl = `/${username}${queryString ? `?${queryString}` : ''}`;
      navigate(newUrl, { replace: true });
    }
  }, [rawUsername, username, searchParams, navigate]);
  
  const [talent, setTalent] = useState<TalentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedTalent, setRelatedTalent] = useState<TalentWithDetails[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [playingPromoVideo, setPlayingPromoVideo] = useState(false);
  const [ordersRemaining, setOrdersRemaining] = useState<number>(10);
  const [activeCoupon, setActiveCoupon] = useState<string | null>(null);
  const [christmasModeEnabled, setChristmasModeEnabled] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 3;
  
  // Subscribe/Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribePhone, setSubscribePhone] = useState('');
  const [showPhoneField, setShowPhoneField] = useState(false);

  // Fetch Christmas mode setting (non-blocking, low priority)
  useEffect(() => {
    // Use requestIdleCallback to defer non-critical fetch
    const fetchChristmasMode = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'christmas_mode_enabled')
        .single();
      setChristmasModeEnabled(data?.setting_value === 'true');
    };
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => fetchChristmasMode());
    } else {
      // Fallback: delay slightly to not block initial render
      setTimeout(fetchChristmasMode, 100);
    }
  }, []);

  // Check coupon from localStorage (check both keys for compatibility)
  const checkCoupon = useCallback(() => {
    const coupon = localStorage.getItem('auto_apply_coupon') || localStorage.getItem('auto_coupon');
    console.log('🎟️ Checking coupon from localStorage:', coupon);
    if (coupon && COUPON_DISCOUNTS[coupon.toUpperCase()]) {
      console.log('🎟️ Valid coupon found, setting activeCoupon:', coupon.toUpperCase());
      setActiveCoupon(coupon.toUpperCase());
    } else {
      console.log('🎟️ No valid coupon found');
      setActiveCoupon(null);
    }
  }, []);

  // Check for coupon from URL or localStorage on mount and when URL changes
  useEffect(() => {
    // Check URL param first and store it
    const couponParam = searchParams.get('coupon');
    if (couponParam) {
      console.log('🎟️ Found coupon in URL:', couponParam);
      localStorage.setItem('auto_apply_coupon', couponParam.toUpperCase());
      // Set state immediately since we just stored it
      if (COUPON_DISCOUNTS[couponParam.toUpperCase()]) {
        setActiveCoupon(couponParam.toUpperCase());
      }
      window.dispatchEvent(new Event('couponApplied'));
    } else {
      // No URL param, check localStorage
      checkCoupon();
    }
    
    // Listen for storage changes and custom events
    window.addEventListener('storage', checkCoupon);
    window.addEventListener('couponApplied', checkCoupon);
    
    return () => {
      window.removeEventListener('storage', checkCoupon);
      window.removeEventListener('couponApplied', checkCoupon);
    };
  }, [searchParams, checkCoupon]);

  // Calculate discounted price based on active coupon
  const originalPrice = talent?.pricing || 0;
  const getDiscountedPrice = () => {
    if (!activeCoupon || !COUPON_DISCOUNTS[activeCoupon]) return originalPrice;
    const discount = COUPON_DISCOUNTS[activeCoupon];
    if (discount.type === 'percentage') {
      return Math.round(originalPrice * (1 - discount.value / 100));
    } else {
      return Math.max(0, originalPrice - discount.value);
    }
  };
  const discountedPrice = getDiscountedPrice();
  const discountLabel = activeCoupon ? COUPON_DISCOUNTS[activeCoupon]?.label : '';
  const hasCoupon = !!activeCoupon;

  // Check if user is already following this talent
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!talent?.id) return;
      
      if (user) {
        // Logged in user - check by user ID
        const { data } = await supabase
          .from('talent_followers')
          .select('id')
          .eq('user_id', user.id)
          .eq('talent_id', talent.id)
          .single();
        setIsFollowing(!!data);
      }
    };
    checkFollowStatus();
  }, [talent?.id, user]);

  // Format phone number for display
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  // Handle subscribe/follow
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!talent?.id) return;

    // If user is already logged in, just follow
    if (user) {
      setSubscribing(true);
      try {
        const { error: followError } = await supabase
          .from('talent_followers')
          .insert({
            user_id: user.id,
            talent_id: talent.id,
          });

        if (followError && !followError.message.includes('duplicate')) {
          throw followError;
        }

        setIsFollowing(true);
        toast.success(`You're now subscribed to ${talent.temp_full_name || talent.users.full_name}!`);
      } catch (error) {
        console.error('Follow error:', error);
        toast.error('Failed to subscribe. Please try again.');
      } finally {
        setSubscribing(false);
      }
      return;
    }

    // New user flow - need email first
    if (!subscribeEmail) {
      toast.error('Please enter your email');
      return;
    }

    // If we need phone and don't have it yet, show phone field
    if (showPhoneField && !subscribePhone) {
      toast.error('Please enter your phone number');
      return;
    }

    setSubscribing(true);
    try {
      // Check if user already exists by email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, phone')
        .eq('email', subscribeEmail.toLowerCase())
        .single();

      let userId: string;

      if (existingUser) {
        // User exists, use their ID
        userId = existingUser.id;
        
        // If they don't have a phone and we collected one, update it
        if (!existingUser.phone && subscribePhone) {
          await supabase
            .from('users')
            .update({ phone: subscribePhone })
            .eq('id', existingUser.id);
        }
      } else {
        // New user - show phone field if not already shown
        if (!showPhoneField) {
          setShowPhoneField(true);
          setSubscribing(false);
          return;
        }

        // Create new user
        const newUserId = crypto.randomUUID();
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            email: subscribeEmail.toLowerCase(),
            phone: subscribePhone || null,
            user_type: 'user',
            full_name: subscribeEmail.split('@')[0],
            promo_source: `talent_profile_${talent.username || talent.id}`,
          })
          .select()
          .single();

        if (createError) {
          if (createError.message.includes('duplicate')) {
            const { data: dupUser } = await supabase
              .from('users')
              .select('id')
              .ilike('email', subscribeEmail)
              .single();
            if (dupUser) {
              userId = dupUser.id;
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        } else {
          userId = newUser.id;
        }
      }

      // Add the follow relationship
      const { error: followError } = await supabase
        .from('talent_followers')
        .insert({
          user_id: userId!,
          talent_id: talent.id,
        });

      if (followError && !followError.message.includes('duplicate')) {
        throw followError;
      }

      setIsFollowing(true);
      toast.success(`You're now subscribed to ${talent.temp_full_name || talent.users.full_name}!`);
      setSubscribeEmail('');
      setSubscribePhone('');
      setShowPhoneField(false);
    } catch (error) {
      console.error('Subscribe error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  // Capture UTM tracking and store in localStorage
  // utm=1 means "self_promo" - ONLY tracks for this specific talent
  // All other UTMs (rumble, twitter, etc.) are GLOBAL - track for any talent ordered
  // Also supports Facebook's utm_source format
  useEffect(() => {
    const utmParam = searchParams.get('utm');
    const utmSource = searchParams.get('utm_source');
    const talentIdentifier = username || id;
    
    if (utmParam === '1' && talentIdentifier) {
      // Self-promo: store per-talent (only tracks if they order from THIS talent)
      localStorage.setItem(`promo_source_${talentIdentifier}`, 'self_promo');
    } else if (utmParam && utmParam !== '1') {
      // Global UTM: store globally (tracks for ANY talent they order from)
      localStorage.setItem('promo_source_global', utmParam);
    } else if (utmSource) {
      // Facebook-style UTM - normalize Facebook sources to 'fb'
      const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
      const normalizedSource = utmSource.toLowerCase();
      const sourceToStore = fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : utmSource;
      localStorage.setItem('promo_source_global', sourceToStore);
      
      // Also store the full UTM details for reference
      const utmDetails = {
        source: utmSource,
        medium: searchParams.get('utm_medium'),
        campaign: searchParams.get('utm_campaign'),
        content: searchParams.get('utm_content')
      };
      localStorage.setItem('utm_details', JSON.stringify(utmDetails));
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
      if (!talentData.users || (Array.isArray(talentData.users) && talentData.users.length === 0)) {
        (talentData as any).users = {
          id: '',
          full_name: talentData.temp_full_name || 'Unknown',
          avatar_url: talentData.temp_avatar_url || null,
        };
      }

      // Fetch reviews, videos, urgency, and related talent IN PARALLEL
      const [reviewsResult, videosResult, urgencyResult, relatedResult] = await Promise.all([
        // Reviews
        supabase
          .from('reviews')
          .select(`
            *,
            users!reviews_user_id_fkey (
              full_name
            )
          `)
          .eq('talent_id', talentData.id)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Videos
        supabase
          .from('orders')
          .select('video_url')
          .eq('talent_id', talentData.id)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6),
        
        // Pricing urgency
        supabase
          .from('talent_pricing_urgency')
          .select('orders_remaining_at_price')
          .eq('id', talentData.id)
          .single(),
        
        // Related talent - only fetch essential fields
        supabase
          .from('talent_profiles')
          .select(`
            id,
            username,
            pricing,
            is_verified,
            fulfillment_time_hours,
            temp_full_name,
            temp_avatar_url,
            users!talent_profiles_user_id_fkey (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('is_active', true)
          .neq('id', talentData.id)
          .limit(8)
      ]);

      const { data: reviewsData } = reviewsResult;
      const { data: videosData } = videosResult;
      const { data: urgencyData } = urgencyResult;
      const { data: relatedData } = relatedResult;

      if (urgencyData) {
        setOrdersRemaining(urgencyData.orders_remaining_at_price);
      }
      
      // Shuffle the results to show random talent each time
      const shuffled = (relatedData || []).sort(() => Math.random() - 0.5).slice(0, 4);

      // Handle incomplete profiles in related talent
      const relatedWithUsers = shuffled.map(profile => {
        if (!profile.users) {
          return {
            ...profile,
            users: {
              id: '',
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

      setRelatedTalent(relatedWithUsers as TalentWithDetails[]);
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
      <div className="rounded-2xl px-4 sm:px-6 py-3 mb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 border border-white/10 bg-white/5">
        <p className="text-white/80 text-sm sm:text-base font-medium text-center">
          Connect with your favorite conservative voices through personalized video ShoutOuts.
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

      {/* Hero + Order Card Container - Side by side on desktop */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
      
      {/* Hero Section */}
      <div className="gradient-border rounded-3xl shadow-modern-xl lg:flex-1">
        <div className="md:flex rounded-3xl overflow-hidden relative h-full">
          {/* Background Gradient - Desktop */}
          <div 
            className="hidden md:block absolute inset-0 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, #0b0123 0%, #905476 100%)'
            }}
          ></div>
          
          {/* Avatar / Promo Video */}
          <div className="md:w-1/3 relative z-10 md:self-stretch">
            <div className="aspect-square md:aspect-auto md:h-full bg-gray-100 relative group">
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
                  {/* Profile Image - LCP element, prioritize loading */}
                  {(talent.temp_avatar_url || talent.users.avatar_url) ? (
                    <img
                      src={ImageSizes.profileHero((talent.temp_avatar_url || talent.users.avatar_url)!)}
                      alt={talent.temp_full_name || talent.users.full_name}
                      className="w-full h-full object-cover"
                      fetchPriority="high"
                      loading="eager"
                      decoding="sync"
                      width={400}
                      height={400}
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
                      className="absolute inset-0 flex items-center justify-center bg-black/5 hover:bg-black/20 transition-all duration-300"
                    >
                      <div className="bg-black/30 backdrop-blur-sm p-4 rounded-full border border-white/40 hover:bg-black/50 hover:scale-110 transition-all duration-300">
                        <PlayIcon className="h-12 w-12 text-white/80" />
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
            {/* Name */}
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {talent.temp_full_name || talent.users.full_name}
            </h1>
            
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
            <div className="flex items-center flex-wrap gap-1.5 mb-3">
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

            {/* Bio - right under categories */}
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-3">
              {talent.bio}
            </p>

            {/* Social Links - moved below bio */}
            <div className="flex items-center gap-1 mt-auto">
              {(() => {
                // Get handles - prioritize social_accounts (talent-entered) over _handle columns
                const twitterHandle = 
                  talent.social_accounts?.find(a => a.platform === 'twitter')?.handle?.replace('@', '') ||
                  talent.twitter_handle;
                const instagramHandle = 
                  talent.social_accounts?.find(a => a.platform === 'instagram')?.handle?.replace('@', '') ||
                  talent.instagram_handle;
                const facebookHandle = 
                  talent.social_accounts?.find(a => a.platform === 'facebook')?.handle?.replace('@', '') ||
                  talent.facebook_handle;
                const tiktokHandle = 
                  talent.social_accounts?.find(a => a.platform === 'tiktok')?.handle?.replace('@', '') ||
                  talent.tiktok_handle;
                const rumbleHandle = 
                  talent.social_accounts?.find(a => a.platform === 'rumble')?.handle?.replace('@', '') ||
                  talent.rumble_handle;
                const rumbleType = (talent as any).rumble_type || 'c'; // 'c' for channel, 'user' for user
                const youtubeHandle = 
                  talent.social_accounts?.find(a => a.platform === 'youtube')?.handle?.replace('@', '') ||
                  talent.youtube_handle;
                
                return (
                  <>
                    {twitterHandle && (
                      <a 
                        href={`https://x.com/${twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                        title={`@${twitterHandle}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </a>
                    )}
                    {instagramHandle && (
                      <a 
                        href={`https://instagram.com/${instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                        title={`@${instagramHandle}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </a>
                    )}
                    {facebookHandle && (
                      <a 
                        href={`https://facebook.com/${facebookHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                        title={`@${facebookHandle}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                    )}
                    {tiktokHandle && (
                      <a 
                        href={`https://tiktok.com/@${tiktokHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                        title={`@${tiktokHandle}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                        </svg>
                      </a>
                    )}
                    {rumbleHandle && (
                      <a 
                        href={`https://rumble.com/${rumbleType}/${rumbleHandle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                        title={`Rumble: ${rumbleHandle.replace('@', '')}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14.4528 13.5458c0.8064 -0.6542 0.9297 -1.8381 0.2756 -2.6445a1.8802 1.8802 0 0 0 -0.2756 -0.2756 21.2127 21.2127 0 0 0 -4.3121 -2.776c-1.066 -0.51 -2.256 0.2 -2.4261 1.414a23.5226 23.5226 0 0 0 -0.14 5.5021c0.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062 -2.704v-0.008zm6.9322 -5.4002c2.0335 2.228 2.0396 5.637 0.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848 0.6713 -5.4168 -0.914 -6.1662 -3.5781 -1.524 -5.2002 -1.3 -11.0803 0.17 -16.3045 0.772 -2.744 3.3521 -4.4661 6.0102 -3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v0.002z"/>
                        </svg>
                      </a>
                    )}
                    {youtubeHandle && (
                      <a 
                        href={`https://youtube.com/@${youtubeHandle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                        title={`YouTube: @${youtubeHandle.replace('@', '')}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                    )}
                  </>
                );
              })()}
              {/* Share Button */}
              <button 
                onClick={() => setShareModalOpen(true)}
                className="p-1.5 text-white/60 hover:text-white/90 transition-colors"
                title="Share talent profile"
              >
                <ShareIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Card - Pricing and CTAs */}
      <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-4 md:p-5 lg:w-96 lg:flex-shrink-0">
        {/* Section Header */}
        <h2 className="text-base font-semibold text-white text-center mb-4">
          Get a personalized video ShoutOut from {talent.temp_full_name || talent.users.full_name}
        </h2>
        
        {/* Stats - Simple inline text */}
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-sm text-gray-400 mb-4">
          {hasCoupon ? (
            <span className="flex items-center gap-2">
              <span className="text-gray-400 line-through">${originalPrice}</span>
              <span 
                className="font-bold bg-clip-text text-transparent text-lg"
                style={{ backgroundImage: 'linear-gradient(to right, #8B5CF6, #3B82F6)' }}
              >
                {discountedPrice === 0 ? 'FREE' : `$${discountedPrice}`}
              </span>
            </span>
          ) : (
            <span className="font-bold text-white text-lg">${talent.pricing}</span>
          )}
          <span className="text-gray-500">•</span>
          <span className="flex items-center">
            <ClockIcon className="h-4 w-4 mr-0.5" />
            {talent.fulfillment_time_hours && talent.fulfillment_time_hours > 0 ? talent.fulfillment_time_hours : 48}h delivery
          </span>
          {christmasModeEnabled && talent.christmas_deadline && (
            (() => {
              const deadline = new Date(talent.christmas_deadline + 'T23:59:59');
              const now = new Date();
              const isPastDeadline = now > deadline;
              const diffMs = deadline.getTime() - now.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              
              return isPastDeadline ? (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-orange-400 text-xs">⚠️ May not arrive before Christmas</span>
                </>
              ) : (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-green-400 text-xs">🎄 Order in {diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`} for Christmas</span>
                </>
              );
            })()
          )}
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
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              to={user ? `/order/${talent.id}?occasion=pep-talk` : `/signup?returnTo=/order/${talent.id}?occasion=pep-talk`}
              onClick={storePromoSourceOnClick}
              className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
            >
              💝 Surprise a loved one
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
              🔥 Friendly roast
            </Link>
            <Link
              to={user ? `/order/${talent.id}?occasion=advice` : `/signup?returnTo=/order/${talent.id}?occasion=advice`}
              onClick={storePromoSourceOnClick}
              className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
            >
              💡 Get advice
            </Link>
            <Link
              to={user ? `/order/${talent.id}?occasion=new-year` : `/signup?returnTo=/order/${talent.id}?occasion=new-year`}
              onClick={storePromoSourceOnClick}
              className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
            >
              🎆 New Years Party
            </Link>
            <Link
              to={user ? `/order/${talent.id}?occasion=other` : `/signup?returnTo=/order/${talent.id}?occasion=other`}
              onClick={storePromoSourceOnClick}
              className="px-2 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-center"
            >
              ✨ Other
            </Link>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-4 text-center">
          <div className="text-sm font-medium text-gray-400">
            🔒 Money-Back Guarantee • 🛡️ Secure • ⚡ Fast
          </div>
        </div>

        {/* Pricing Urgency Indicator - flush at bottom (hide if coupon applied) */}
        {ordersRemaining <= 10 && !hasCoupon && (
          <div className="mt-4 -mx-4 md:-mx-5 -mb-4 md:-mb-5 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/30 to-red-500/30 border-t border-orange-400/50 px-4 py-3 rounded-b-3xl">
            <FireIcon className="h-5 w-5 text-orange-400" />
            <span className="text-sm font-bold text-orange-100">
              Only {ordersRemaining} left at this price!
            </span>
          </div>
        )}
      </div>
      
      </div>{/* End Hero + Order Card Container */}

      {/* Subscribe/Follow Widget */}
      <div className="mb-8">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-4">
            Stay Connected with {talent.temp_full_name || talent.users.full_name}
          </h3>
          
          {/* Already subscribed message */}
          {isFollowing ? (
            <div className="py-3 space-y-1">
              <p className="text-white/60 text-sm">
                ✓ You're subscribed to {(talent.temp_full_name || talent.users.full_name).split(' ')[0]}
              </p>
              <p className="text-white/40 text-xs">
                You now have exclusive access to their updates.
              </p>
            </div>
          ) : user ? (
            /* Logged in user - show subscribe button */
            <div className="space-y-2 max-w-sm mx-auto">
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="w-full py-3 rounded-full font-medium transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white"
              >
                {subscribing ? '...' : (
                  <>
                    Stay connected
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
              <p className="text-white/40 text-xs">
                Logged in as {user.email || user.phone}
              </p>
            </div>
          ) : (
            /* Not logged in - email/phone form */
            <form onSubmit={handleSubscribe} className="space-y-3 max-w-sm mx-auto">
              {/* Email field with button inside */}
              {!showPhoneField && (
                <div className="relative">
                  <input
                    type="email"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-full pl-4 pr-44 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/40 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="absolute right-1 top-1 bottom-1 px-4 rounded-full font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                    style={{ minWidth: '140px' }}
                  >
                    {subscribing ? '...' : (
                      <>
                        Stay connected
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Phone field - shown after email for new users */}
              {showPhoneField && (
                <div className="relative">
                  <input
                    type="tel"
                    value={subscribePhone}
                    onChange={(e) => setSubscribePhone(formatPhoneNumber(e.target.value))}
                    placeholder="(555) 555-5555"
                    className="w-full bg-white/10 border border-white/20 rounded-full pl-4 pr-40 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/40 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="absolute right-1 top-1 bottom-1 px-4 rounded-full font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {subscribing ? '...' : 'Confirm Access'}
                    {!subscribing && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Recent Orders Section - Show videos if available, or "Be the first" CTA if no videos */}
      <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 mb-8">
        {talent.recent_videos.length > 0 ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent ShoutOuts</h2>
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
              {hasCoupon ? (
                <span className="flex items-center gap-2">
                  Order Now - <span className="line-through opacity-70">${originalPrice}</span>
                  <span className="font-bold">{discountedPrice === 0 ? 'FREE' : `$${discountedPrice}`}</span>
                </span>
              ) : (
                <>Order Now - ${talent.pricing}</>
              )}
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
            {talent.reviews.slice(0, reviewsPage * REVIEWS_PER_PAGE).map((review) => (
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
          {/* Show More Button */}
          {talent.reviews.length > reviewsPage * REVIEWS_PER_PAGE && (
            <button
              onClick={() => setReviewsPage(prev => prev + 1)}
              className="mt-4 w-full py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
            >
              Show More Reviews ({talent.reviews.length - reviewsPage * REVIEWS_PER_PAGE} remaining)
            </button>
          )}
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
                      src={ImageSizes.thumbnail((related.temp_avatar_url || related.users.avatar_url)!)}
                      alt={related.temp_full_name || related.users.full_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      width={150}
                      height={150}
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
                <div className="text-lg font-bold">
                  {hasCoupon ? (
                    <span className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm line-through">${related.pricing}</span>
                      <span 
                        className="bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(to right, #8B5CF6, #3B82F6)' }}
                      >
                        ${Math.round((related.pricing || 0) * 0.75)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-green-400">${related.pricing}</span>
                  )}
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
