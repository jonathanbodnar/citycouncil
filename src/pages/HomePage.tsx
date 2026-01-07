import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon, HeartIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, TalentCategory } from '../types';
import TalentCard from '../components/TalentCard';
import FeaturedCarousel from '../components/FeaturedCarousel';
import SEOHelmet from '../components/SEOHelmet';
import FOMONotification from '../components/FOMONotification';

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

// Cache talent data to avoid refetching on every render
let cachedTalent: TalentWithUser[] | null = null;
let cachedFeaturedTalent: TalentWithUser[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

const TALENT_CATEGORIES = [
  { key: 'politician', label: 'Politicians' },
  { key: 'candidate', label: 'Candidates' },
  { key: 'party-leader', label: 'Party Leaders' },
  { key: 'reporter', label: 'Reporters' },
  { key: 'tv-host', label: 'TV/Radio Hosts' },
  { key: 'commentator', label: 'Commentators' },
  { key: 'author', label: 'Authors/Speakers' },
  { key: 'comedian', label: 'Comedians' },
  { key: 'musician', label: 'Musicians' },
  { key: 'actor', label: 'Actors' },
  { key: 'influencer', label: 'Influencers' },
  { key: 'activist', label: 'Activists' },
  { key: 'faith-leader', label: 'Faith Leaders' },
  { key: 'academic', label: 'Academics' },
  { key: 'military', label: 'Military/Veterans' },
  { key: 'youth-leader', label: 'Youth Leaders' },
  { key: 'patriotic-entertainer', label: 'Patriotic Entertainers' },
  { key: 'other', label: 'Other' },
];

const HomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TalentCategory | 'all' | 'coming_soon'>('all');
  const [availableCategories, setAvailableCategories] = useState<TalentCategory[]>([]);
  const [totalFans, setTotalFans] = useState<number>(0);

  // Capture coupon from URL (e.g., shoutout.us/?coupon=SANTA25)
  // Also handles malformed URLs like ?utm=sms?coupon=SANTA25 (double question mark)
  useEffect(() => {
    let couponParam = searchParams.get('coupon');
    
    // Handle malformed URLs with double question marks (e.g., ?utm=sms?coupon=SANTA25)
    if (!couponParam) {
      const fullUrl = window.location.href;
      const couponMatch = fullUrl.match(/[?&]coupon=([^&?#]+)/i);
      if (couponMatch) {
        couponParam = couponMatch[1];
      }
    }
    
    if (couponParam) {
      localStorage.setItem('auto_apply_coupon', couponParam.toUpperCase());
      // Dispatch event to update TalentCards immediately
      window.dispatchEvent(new Event('couponApplied'));
    }
  }, [searchParams]);

  // Capture global UTM tracking (e.g., shoutout.us/?utm=rumble or Facebook's detailed params)
  // These track for ANY talent the user orders from
  // Facebook format: ?utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
  useEffect(() => {
    // Check for simple utm param first
    const utmParam = searchParams.get('utm');
    // Check for Facebook-style utm_source param
    const utmSource = searchParams.get('utm_source');
    
    // Determine the source to store
    let sourceToStore: string | null = null;
    
    if (utmParam && utmParam !== '1') {
      // Simple utm param (not self-promo)
      sourceToStore = utmParam;
    } else if (utmSource) {
      // Facebook-style UTM - normalize Facebook sources to 'fb'
      // Facebook sources include: fb, facebook, ig, instagram, meta, audience_network, messenger, etc.
      const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
      const normalizedSource = utmSource.toLowerCase();
      
      if (fbSources.some(s => normalizedSource.includes(s))) {
        sourceToStore = 'fb';
      } else {
        sourceToStore = utmSource;
      }
      
      // Also store the full UTM details for reference
      const utmDetails = {
        source: utmSource,
        medium: searchParams.get('utm_medium'),
        campaign: searchParams.get('utm_campaign'),
        content: searchParams.get('utm_content')
      };
      localStorage.setItem('utm_details', JSON.stringify(utmDetails));
    }
    
    if (sourceToStore) {
      localStorage.setItem('promo_source_global', sourceToStore);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    const now = Date.now();
    
    // Use cache if available and fresh
    if (cachedTalent && cachedFeaturedTalent && (now - cacheTimestamp) < CACHE_DURATION) {
      setTalent(cachedTalent);
      setFeaturedTalent(cachedFeaturedTalent);
      
      // Get available categories from cached data
      const allCategories = cachedTalent.flatMap(t => 
        t.categories && t.categories.length > 0 ? t.categories : [t.category]
      );
      setAvailableCategories(Array.from(new Set(allCategories)));
      setLoading(false);
      return;
    }

    try {
      // Fetch ONLY the columns we need - much faster than select(*)
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          user_id,
          username,
          bio,
          category,
          categories,
          pricing,
          fulfillment_time_hours,
          is_featured,
          is_active,
          is_coming_soon,
          is_verified,
          total_orders,
          average_rating,
          charity_percentage,
          charity_name,
          temp_full_name,
          temp_avatar_url,
          display_order,
          featured_order,
          featured_image_position,
          created_at,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .or('is_active.eq.true,is_coming_soon.eq.true');

      if (error) throw error;

      // Filter out hidden profiles (keep them accessible via direct URL)
      const visibleData = (data || []).filter((profile: any) => {
        // Hide Jonathan Bodnar from homepage (still accessible via /jonathanbodnar)
        const users = profile.users;
        const userName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
        const name = profile.temp_full_name || userName || '';
        if (name.toLowerCase() === 'jonathan bodnar') return false;
        return true;
      });

      // Sort by display_order, then active before coming soon
      const sortedData = visibleData.sort((a, b) => {
        if (a.display_order !== null && b.display_order !== null) {
          return a.display_order - b.display_order;
        }
        if (a.display_order !== null) return -1;
        if (b.display_order !== null) return 1;
        
        const aIsActive = a.is_active && !a.is_coming_soon;
        const bIsActive = b.is_active && !b.is_coming_soon;
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Map profiles with synthetic user data if needed
      // Use 'as any' to bypass strict TypeScript checks since we're selecting specific columns
      const talentWithUsers = sortedData.map(profile => {
        if (!profile.users) {
          return {
            ...profile,
            users: {
              id: profile.user_id || '',
              full_name: profile.temp_full_name || 'Unknown',
              avatar_url: profile.temp_avatar_url || null,
            },
          } as any;
        }
        return profile as any;
      }) as TalentWithUser[];

      // Extract featured talent from the same query (no second DB call!)
      const featured = talentWithUsers
        .filter(t => t.is_featured && t.is_active)
        .sort((a, b) => (a.featured_order || 999) - (b.featured_order || 999))
        .slice(0, 5);

      // Update cache
      cachedTalent = talentWithUsers;
      cachedFeaturedTalent = featured;
      cacheTimestamp = now;

      setTalent(talentWithUsers);
      setFeaturedTalent(featured);

      // Get available categories
      const allCategories = sortedData.flatMap(t => 
        t.categories && t.categories.length > 0 ? t.categories : [t.category]
      );
      setAvailableCategories(Array.from(new Set(allCategories)));

      // Fetch total fans count (users with phone numbers)
      const { count: fansCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('phone', 'is', null);
      
      setTotalFans(fansCount || 0);
    } catch (error) {
      console.error('Error fetching talent:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTalent = talent.filter(t => {
    const matchesSearch = !searchQuery || 
      t.users.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.bio.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category filtering logic
    let matchesCategory = false;
    
    if (selectedCategory === 'all') {
      // Show everything (active + coming soon)
      matchesCategory = true;
    } else if (selectedCategory === 'coming_soon') {
      // Show only coming soon
      matchesCategory = t.is_coming_soon === true;
    } else {
      // Show by specific category
      matchesCategory = t.categories && t.categories.length > 0 
        ? t.categories.includes(selectedCategory) 
        : t.category === selectedCategory;
    }
    
    return matchesSearch && matchesCategory;
  });

  // Skeleton card component for loading state
  const SkeletonCard = () => (
    <div className="glass rounded-2xl sm:rounded-3xl shadow-modern overflow-hidden h-full flex flex-col animate-pulse">
      <div className="aspect-square bg-white/10"></div>
      <div className="p-3 sm:p-6 flex flex-col flex-grow">
        <div className="h-5 bg-white/10 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-white/10 rounded w-1/4 mt-auto"></div>
      </div>
    </div>
  );

  return (
    <>
      <SEOHelmet 
        title="ShoutOut - Conservative & Faith-Based Video Shoutouts | Personalized Messages from Patriots"
        description="Book personalized video messages from conservative voices, political commentators, faith leaders, and patriotic influencers. The #1 platform for authentic conservative video shoutouts. Support free speech and American values."
        keywords="conservative video message, faith-based video shoutout, patriotic celebrity message, political commentator video, Christian influencer personalized video, conservative alternative to cameo, faith leaders video message, patriot voices, MAGA influencer shoutout, conservative booking platform"
        url="https://shoutout.us"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">

      {/* Hero Banner */}
      <div className="rounded-2xl px-4 sm:px-6 py-3 mb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 border border-white/10 bg-white/5">
        <p className="text-white/80 text-sm sm:text-base font-medium text-center">
          Connect with your favorite conservative voices through personalized video ShoutOuts.
        </p>
        <div className="flex items-center gap-1">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill="url(#starGradient)">
                <defs>
                  <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-white/60 text-sm">5.0</span>
          {totalFans > 0 && (
            <span className="text-white/50 text-sm">({totalFans.toLocaleString()} Fans)</span>
          )}
        </div>
      </div>

      {/* Featured Talent Carousel - Show skeleton while loading */}
      {loading ? (
        <div className="mb-12">
          <div className="glass rounded-3xl p-6 animate-pulse">
            <div className="h-64 bg-white/10 rounded-2xl"></div>
          </div>
        </div>
      ) : null /* Featured carousel temporarily hidden */}

      {/* Category Filter with Search */}
      <div className="mb-8">
        {/* Expandable Search */}
        {searchQuery !== '' && (
          <div className="mb-4">
            <div className="max-w-md relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search talent..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={searchQuery === 'search' ? '' : searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSearchQuery(searchQuery ? '' : 'search')}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/20 hover:text-white border border-white/10"
            title="Search talent"
          >
            🔍 Search
          </button>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-white/20 backdrop-blur-md text-white border border-white/30'
                : 'bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/20 hover:text-white border border-white/10'
            }`}
          >
            All Categories
          </button>
          <button
            onClick={() => setSelectedCategory('coming_soon')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
              selectedCategory === 'coming_soon'
                ? 'bg-white/20 backdrop-blur-md text-white border border-white/30'
                : 'bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/20 hover:text-white border border-white/10'
            }`}
          >
            ⏳ Coming Soon
          </button>
          {TALENT_CATEGORIES
            .filter(cat => availableCategories.includes(cat.key as TalentCategory))
            .map(category => (
              <button
                key={category.key}
                onClick={() => setSelectedCategory(category.key as TalentCategory)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  selectedCategory === category.key
                    ? 'bg-white/20 backdrop-blur-md text-white border border-white/30'
                    : 'bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/20 hover:text-white border border-white/10'
                }`}
              >
                {category.label}
              </button>
            ))}
        </div>
      </div>

      {/* Talent Grid - Show skeleton cards while loading */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
        {loading ? (
          // Show 10 skeleton cards while loading
          [...Array(10)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          filteredTalent.map(talentProfile => (
            <TalentCard key={talentProfile.id} talent={talentProfile} />
          ))
        )}
      </div>

      {!loading && filteredTalent.length === 0 && (
        <div className="text-center py-12">
          <HeartIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No talent found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or category filter.
          </p>
        </div>
      )}

      {/* FOMO Notification - Shows real reviews */}
      <FOMONotification interval={8000} />

    </div>
    </>
  );
};

export default HomePage;
