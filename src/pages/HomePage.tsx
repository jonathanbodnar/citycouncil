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
  { key: 'academic', label: 'Academics' },
  { key: 'military', label: 'Military/Veterans' },
];

// Categories to exclude
const EXCLUDED_CATEGORIES = ['faith-leader', 'youth-leader', 'other'];

// Map patriotic-entertainer to comedian
const CATEGORY_MAPPING: Record<string, string> = {
  'patriotic-entertainer': 'comedian',
};

const HomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<TalentCategory | 'all' | 'coming_soon'>('all');
  const [availableCategories, setAvailableCategories] = useState<TalentCategory[]>([]);
  const [totalFans, setTotalFans] = useState<number>(0);

  // Listen for header search events
  useEffect(() => {
    const handleHeaderSearch = (event: CustomEvent) => {
      setSearchQuery(event.detail || '');
    };
    window.addEventListener('headerSearch', handleHeaderSearch as EventListener);
    return () => window.removeEventListener('headerSearch', handleHeaderSearch as EventListener);
  }, []);

  // Capture coupon from URL (e.g., shoutout.us/?coupon=SANTA25)
  // Also handles malformed URLs like ?utm=sms?coupon=SANTA25 (double question mark)
  useEffect(() => {
    const fetchAndApplyCoupon = async () => {
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
        const couponCode = couponParam.toUpperCase();
        localStorage.setItem('auto_apply_coupon', couponCode);
        
        // Fetch coupon details from database to get discount info
        try {
          const { data: coupon } = await supabase
            .from('coupons')
            .select('code, discount_type, discount_value')
            .eq('code', couponCode)
            .eq('is_active', true)
            .single();
          
          if (coupon) {
            // Store coupon details for use in TalentCard/TalentBannerCard
            localStorage.setItem('coupon_details', JSON.stringify({
              code: coupon.code,
              type: coupon.discount_type,
              value: coupon.discount_value,
              label: coupon.discount_type === 'percentage' 
                ? `${coupon.discount_value}% OFF` 
                : `$${coupon.discount_value} OFF`
            }));
            console.log('🎟️ Coupon details fetched from database:', coupon);
          }
        } catch (error) {
          console.log('🎟️ Could not fetch coupon details (may be hardcoded):', error);
        }
        
        // Dispatch event to update TalentCards immediately
        window.dispatchEvent(new Event('couponApplied'));
      }
    };
    
    fetchAndApplyCoupon();
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

      // Fetch total fans count (all users)
      const { count: fansCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
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
    
    return matchesSearch;
  });

  // Group talent by categories for Netflix-style strips
  const getTalentsByCategory = () => {
    const categoryMap = new Map<string, TalentWithUser[]>();
    
    // Add "Featured" category for featured talent
    if (featuredTalent.length > 0) {
      categoryMap.set('Featured', featuredTalent);
    }
    
    // Group talent by categories
    filteredTalent.forEach(t => {
      const rawCategories = t.categories && t.categories.length > 0 ? t.categories : [t.category];
      
      // Apply category mapping and filter excluded categories
      const talentCategories = rawCategories
        .map(cat => CATEGORY_MAPPING[cat] || cat) // Map categories
        .filter(cat => cat && !EXCLUDED_CATEGORIES.includes(cat)) as TalentCategory[]; // Exclude unwanted categories
      
      talentCategories.forEach(cat => {
        const categoryLabel = TALENT_CATEGORIES.find(c => c.key === cat)?.label || cat;
        
        if (!categoryMap.has(categoryLabel)) {
          categoryMap.set(categoryLabel, []);
        }
        
        // Only add if not already in this category (avoid duplicates)
        const categoryTalent = categoryMap.get(categoryLabel)!;
        if (!categoryTalent.find(existing => existing.id === t.id)) {
          categoryTalent.push(t);
        }
      });
    });

    // Add "Coming Soon" category if we have any (and more than 2)
    const comingSoon = filteredTalent.filter(t => t.is_coming_soon);
    if (comingSoon.length > 2) {
      categoryMap.set('Coming Soon', comingSoon);
    }
    
    // Filter out categories with 2 or fewer people
    const filteredMap = new Map<string, TalentWithUser[]>();
    categoryMap.forEach((talents, category) => {
      if (talents.length > 2) {
        filteredMap.set(category, talents);
      }
    });
    
    // Reorder categories to avoid consecutive duplicates
    // Track IDs shown in previous category and move them to the end of current category
    const reorderedMap = new Map<string, TalentWithUser[]>();
    let previousCategoryIds = new Set<string>();
    
    Array.from(filteredMap.entries()).forEach(([category, talents]) => {
      // Separate talents into two groups: appeared above (move to back) and new (keep at front)
      const talentsInPrevious: TalentWithUser[] = [];
      const talentsNotInPrevious: TalentWithUser[] = [];
      
      talents.forEach(t => {
        if (previousCategoryIds.has(t.id)) {
          talentsInPrevious.push(t);
        } else {
          talentsNotInPrevious.push(t);
        }
      });
      
      // Reorder: new talents first, then previously shown talents
      const reorderedTalents = [...talentsNotInPrevious, ...talentsInPrevious];
      reorderedMap.set(category, reorderedTalents);
      
      // Update previousCategoryIds for next iteration
      previousCategoryIds = new Set(talents.map(t => t.id));
    });
    
    return reorderedMap;
  };

  const categoryStrips = getTalentsByCategory();

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
        title="ShoutOut - Free-Speech & Faith-Based Video Shoutouts | Personalized Messages from Patriots"
        description="Book personalized video messages from free-speech voices, political commentators, faith leaders, and patriotic influencers. The #1 platform for authentic free-speech video shoutouts. Support free speech and American values."
        keywords="free-speech video message, faith-based video shoutout, patriotic celebrity message, political commentator video, Christian influencer personalized video, free-speech alternative to cameo, faith leaders video message, patriot voices, MAGA influencer shoutout, free-speech booking platform"
        url="https://shoutout.us"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">

      {/* Hero Banner */}
      <div className="rounded-2xl px-4 sm:px-6 py-3 mb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 border border-white/10 bg-white/5">
        <p className="text-white/80 text-sm sm:text-base font-medium text-center">
          Connect with your favorite free-speech influencers through personalized video ShoutOuts.
        </p>
        <div className="flex items-center gap-1 flex-wrap justify-center">
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
            <span className="text-white/50 text-sm whitespace-nowrap">({totalFans.toLocaleString()} Fans)</span>
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

        {/* Category bar temporarily hidden */}
      </div>

      {/* Netflix-style Category Strips */}
      {loading ? (
        // Loading skeleton - show a few category placeholders
        <div className="space-y-8">
          {[...Array(3)].map((_, categoryIndex) => (
            <div key={categoryIndex} className="space-y-3">
              <div className="inline-block">
                <div className="h-8 w-32 bg-white/10 rounded-full animate-pulse"></div>
              </div>
              <div className="relative">
                <div className="flex gap-3 overflow-hidden">
                  {[...Array(6)].map((_, cardIndex) => (
                    <div key={cardIndex} className="flex-shrink-0" style={{ width: '180px' }}>
                      <SkeletonCard />
                    </div>
                  ))}
                </div>
                {/* Right Fade Gradient */}
                <div 
                  className="absolute top-0 right-0 bottom-0 w-24 pointer-events-none"
                  style={{
                    background: 'linear-gradient(to right, transparent, rgb(15, 15, 26))'
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      ) : categoryStrips.size === 0 ? (
        <div className="text-center py-12">
          <HeartIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-white">No talent found</h3>
          <p className="mt-1 text-sm text-white/60">
            Try adjusting your search.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(categoryStrips.entries()).map(([category, talents]) => (
            <div key={category} className="space-y-3">
              {/* Category Header Badge */}
              <div className="inline-block">
                <span className="px-4 py-1.5 rounded-full text-sm font-bold glass-strong bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-white border border-white/20">
                  {category}
                </span>
              </div>
              
              {/* Horizontal Scrolling Strip with Cycling */}
              <div className="relative group">
                <div 
                  className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory scroll-smooth"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {/* Render talents twice for infinite scroll effect */}
                  {talents.map(talentProfile => (
                    <div 
                      key={`first-${talentProfile.id}`} 
                      className="flex-shrink-0 snap-start"
                      style={{ width: '180px' }}
                    >
                      <TalentCard talent={talentProfile} compact />
                    </div>
                  ))}
                  {/* Duplicate for cycling (only if more than 3 items) */}
                  {talents.length > 3 && talents.map(talentProfile => (
                    <div 
                      key={`second-${talentProfile.id}`} 
                      className="flex-shrink-0 snap-start"
                      style={{ width: '180px' }}
                    >
                      <TalentCard talent={talentProfile} compact />
                    </div>
                  ))}
                </div>
                
                {/* Right Fade Gradient */}
                <div 
                  className="absolute top-0 right-0 bottom-4 w-24 pointer-events-none"
                  style={{
                    background: 'linear-gradient(to right, transparent, rgb(15, 15, 26))'
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FOMO Notification - Shows real reviews */}
      <FOMONotification interval={8000} />

    </div>
    </>
  );
};

export default HomePage;
