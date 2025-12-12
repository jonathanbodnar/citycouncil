import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon, HeartIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, TalentCategory } from '../types';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TalentCategory | 'all' | 'coming_soon'>('all');
  const [availableCategories, setAvailableCategories] = useState<TalentCategory[]>([]);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const onboardingContainerRef = useRef<HTMLDivElement | null>(null);

  // Capture coupon from URL (e.g., shoutout.us/?coupon=SANTA25)
  useEffect(() => {
    const couponParam = searchParams.get('coupon');
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
    fetchTalent();
    fetchFeaturedTalent();
    fetchTotalUsers();
  }, []);

  const fetchTalent = async () => {
    try {
      console.log('Fetching talent...');
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .or('is_active.eq.true,is_coming_soon.eq.true'); // Show active OR coming soon

      if (error) {
        console.error('Supabase error fetching talent:', error);
        throw error;
      }

      // Sort by display_order (admin-set positioning), then active before coming soon
      const sortedData = (data || []).sort((a, b) => {
        // 1. If both have display_order, sort by that (ascending)
        if (a.display_order !== null && b.display_order !== null) {
          return a.display_order - b.display_order;
        }
        
        // 2. If only one has display_order, it comes first
        if (a.display_order !== null) return -1;
        if (b.display_order !== null) return 1;
        
        // 3. For NULL display_order: Active before Coming Soon
        const aIsActive = a.is_active && !a.is_coming_soon;
        const bIsActive = b.is_active && !b.is_coming_soon;
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        // 4. Within same status, newest first (by created_at)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      console.log('Talent data fetched:', sortedData.length, 'profiles');

      // Handle null data
      if (!sortedData || sortedData.length === 0) {
        setTalent([]);
        setAvailableCategories([]);
        return;
      }

      // Map profiles - use temp fields if users data is missing (for incomplete onboarding)
      const talentWithUsers = sortedData.map(profile => {
        // If no users data, create a synthetic user object from temp fields
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

      setTalent(talentWithUsers);

      // Get available categories from both single category and categories array
      const allCategories = sortedData.flatMap(t => 
        t.categories && t.categories.length > 0 ? t.categories : [t.category]
      );
      const categories = Array.from(new Set(allCategories));
      setAvailableCategories(categories);
    } catch (error) {
      console.error('Error fetching talent:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedTalent = async () => {
    try {
      console.log('Fetching featured talent...');
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('featured_order', { ascending: true, nullsFirst: false })
        .limit(5);

      if (error) throw error;

      // Handle null data
      if (!data || data.length === 0) {
        setFeaturedTalent([]);
        return;
      }

      console.log('Featured talent raw data:', data);

      // Map profiles - use temp fields if users data is missing (for incomplete onboarding)
      const featuredWithUsers = (data || []).map(profile => {
        // If no users data, create a synthetic user object from temp fields
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

      console.log('Featured talent after mapping:', featuredWithUsers);
      setFeaturedTalent(featuredWithUsers);
    } catch (error) {
      console.error('Error fetching featured talent:', error);
    }
  };

  const fetchTotalUsers = async () => {
    try {
      // Get count of registered users
      const { count: usersCount, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'user');

      if (usersError) throw usersError;

      // Get count of beta signups (phone numbers not from registered users)
      const { count: betaCount, error: betaError } = await supabase
        .from('beta_signups')
        .select('*', { count: 'exact', head: true });

      if (betaError) throw betaError;

      const total = (usersCount || 0) + (betaCount || 0);
      setTotalUsers(total);
    } catch (error) {
      console.error('Error fetching total users:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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
      <div className="rounded-2xl px-6 py-3 mb-6 flex items-center justify-center gap-4 border border-white/10 bg-white/5">
        <p className="text-white/80 text-sm sm:text-base font-medium">
          Get personalized video ShoutOuts from top conservative voices.
        </p>
        {totalUsers > 0 && (
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
            <span className="text-white/60 text-sm">({totalUsers.toLocaleString()})</span>
          </div>
        )}
      </div>

      {/* Featured Talent Carousel */}
      {featuredTalent.length > 0 && (
        <div className="mb-12">
          <FeaturedCarousel talent={featuredTalent} />
        </div>
      )}

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

      {/* Talent Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {filteredTalent.map(talentProfile => (
          <TalentCard key={talentProfile.id} talent={talentProfile} />
        ))}
      </div>

      {filteredTalent.length === 0 && (
        <div className="text-center py-12">
          <HeartIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No talent found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or category filter.
          </p>
        </div>
      )}

      {/* Simple overlay to host the <moov-onboarding> drop */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-full max-w-2xl p-4">
            <div ref={onboardingContainerRef} />
          </div>
        </div>
      )}


      {/* FOMO Notification - Shows real reviews */}
      <FOMONotification interval={8000} />

    </div>
    </>
  );
};

export default HomePage;
