import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import TalentCard from '../components/TalentCard';
import TalentBannerCard from '../components/TalentBannerCard';
import SEOHelmet from '../components/SEOHelmet';
import FOMONotification from '../components/FOMONotification';
import { useAuth } from '../context/AuthContext';

// Seeded random shuffle to ensure stable ordering per carousel
// Uses a simple hash of the seed string to generate pseudo-random ordering
const seededShuffle = <T,>(arr: T[], seed: string): T[] => {
  const shuffled = [...arr];
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface TalentWithDetails extends TalentProfile {
  users?: { id: string; full_name: string; avatar_url?: string };
  recent_video_url?: string;
  recent_review?: { rating: number; comment: string };
  top_categories?: string[];
  similar_talent?: TalentWithDetails[];
}

interface OccasionType {
  key: string;
  label: string;
  emoji: string;
}

const OCCASIONS: OccasionType[] = [
  { key: 'birthday', label: 'Happy Birthday', emoji: '🎂' },
  { key: 'express', label: '24hr Delivery', emoji: '⚡' },
  { key: 'roast', label: 'Friendly Roast', emoji: '🔥' },
  { key: 'encouragement', label: 'Encouragement', emoji: '💪' },
  { key: 'debate', label: 'End a Debate', emoji: '⚔️' },
  { key: 'announcement', label: 'Make an Announcement', emoji: '📣' },
  { key: 'celebrate', label: 'Celebrate A Win', emoji: '🏆' },
  { key: 'advice', label: 'Get Advice', emoji: '💡' },
  { key: 'corporate', label: 'Corporate Event', emoji: '🏢' },
];

// Occasion-specific phrases for when selected from popup
const OCCASION_PHRASES: Record<string, string> = {
  'birthday': "Say happy birthday better than a text.",
  'express': "Need it fast? These talent deliver in 24 hours.",
  'roast': "Your group chat will never recover.",
  'encouragement': "Encouragement from people that have been there.",
  'debate': "End the debate with a ShoutOut.",
  'announcement': "Tell everyone in a way no one else can.",
  'celebrate': "Celebrate in the most unique way possible.",
  'advice': "Get advice from people who've been there.",
  'corporate': "Make your event unforgettable.",
};

// Curated talent for each occasion (by username)
// Note: 'express' is handled dynamically by filtering express_delivery_enabled talent
const OCCASION_TALENT_MAPPING: Record<string, string[]> = {
  'birthday': ['shawnfarash', 'meloniemac', 'joshfirestine', 'lydiashaffer', 'thehodgetwins', 'elsakurt', 'jeremyhambly', 'kevinsorbo', 'kayleecampbell', 'jeremyherrell'],
  'roast': ['shawnfarash', 'hayleycaronia', 'joshfirestine', 'jpsears', 'thehodgetwins', 'bryancallen', 'nickdipaolo', 'elsakurt', 'esteepalti', 'pearldavis', 'lauraloomer', 'kaitlinbennett', 'mattiseman'],
  'announcement': ['shawnfarash', 'hayleycaronia', 'lydiashaffer', 'bryancallen', 'basrutten', 'nicksearcy', 'markdavis', 'larryelder', 'mattiseman'],
  'encouragement': ['meloniemac', 'hayleycaronia', 'jpsears', 'lydiashaffer', 'davidharrisjr', 'bryancallen', 'elsakurt', 'basrutten', 'gregonfire', 'nicksearcy', 'markdavis', 'larryelder', 'geraldmorgan', 'kevinsorbo', 'johnohurley'],
  'celebrate': ['joshfirestine', 'jpsears', 'jeremyhambly', 'basrutten', 'bradstine', 'gregonfire', 'chaelsonnen', 'lauraloomer', 'johnohurley', 'mattiseman'],
  'debate': ['davidharrisjr', 'nickdipaolo', 'bradstine', 'kayleecampbell', 'chaelsonnen', 'lauraloomer', 'pearldavis', 'geraldmorgan', 'kaitlinbennett', 'chrissalcedo'],
  'advice': ['meloniemac', 'thehodgetwins', 'davidharrisjr', 'nickdipaolo', 'bradstine', 'esteepalti', 'gregonfire', 'nicksearcy', 'chaelsonnen', 'markdavis', 'larryelder', 'pearldavis', 'geraldmorgan', 'kevinsorbo', 'kaitlinbennett', 'chrissalcedo', 'johnohurley'],
};

// Dedicated category talent (by username)
// Comedians includes those marked as Comedian or Impersonator
const COMEDIAN_TALENT = ['jpsears', 'mattiseman', 'shawnfarash', 'elsakurt', 'esteepalti', 'joshfirestine', 'thehodgetwins'];
const ACTOR_TALENT = ['bradstine', 'nicksearcy', 'kevinsorbo', 'johnohurley'];

// Rotating taglines for the header
const ROTATING_TAGLINES = [
  "Your friend lost a bet. End him properly.",
  "Say happy birthday better than a text.",
  "Your group chat will never recover from this.",
  "The gift they didn't know existed.",
  "When words aren't enough, say it with a ShoutOut.",
  "Last-minute gift. Legendary outcome.",
  "Some moments deserve more.",
  "This roast comes with witnesses.",
  "Let someone say it for you, just funnier.",
];

export default function HomePageNew() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [talentList, setTalentList] = useState<TalentWithDetails[]>([]);
  const [filteredTalent, setFilteredTalent] = useState<TalentWithDetails[]>([]);
  const [allActiveTalent, setAllActiveTalent] = useState<TalentWithDetails[]>([]); // ALL active talent for carousels
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithDetails[]>([]); // ALL featured talent
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [occasionFromPopup, setOccasionFromPopup] = useState<string | null>(null); // Tracks if occasion was selected from giveaway popup
  const [occasionTalent, setOccasionTalent] = useState<TalentWithDetails[]>([]); // Random 4 talent for selected occasion
  const [loading, setLoading] = useState(true);
  const [totalReviews, setTotalReviews] = useState(0);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');
  const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);
  
  // Get discount info from localStorage
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);

  // Rotate taglines every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTaglineIndex((prev) => (prev + 1) % ROTATING_TAGLINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for occasion selection from giveaway popup
  useEffect(() => {
    const handlePopupOccasion = (event: CustomEvent) => {
      const occasion = event.detail;
      if (occasion && OCCASION_PHRASES[occasion]) {
        setSelectedOccasion(occasion);
        setOccasionFromPopup(occasion);
      }
    };
    window.addEventListener('occasionSelectedFromPopup', handlePopupOccasion as EventListener);
    return () => window.removeEventListener('occasionSelectedFromPopup', handlePopupOccasion as EventListener);
  }, []);

  // Listen for header search events
  useEffect(() => {
    const handleHeaderSearch = (event: CustomEvent) => {
      const query = event.detail || '';
      setSearchQuery(query);
      // Clear occasion selection when searching
      if (query.trim()) {
        setSelectedOccasion(null);
        setOccasionFromPopup(null);
      }
    };
    window.addEventListener('headerSearch', handleHeaderSearch as EventListener);
    return () => window.removeEventListener('headerSearch', handleHeaderSearch as EventListener);
  }, []);

  // Apply search filter when searchQuery changes - search ALL active talent by NAME only
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      // Search ALL active talent, not just banner cards
      const filtered = allActiveTalent.filter(talent => {
        const name = (talent.temp_full_name || talent.users?.full_name || '').toLowerCase();
        return name.includes(query);
      });
      setFilteredTalent(filtered);
    } else {
      setFilteredTalent(talentList);
    }
  }, [searchQuery, talentList, allActiveTalent]);

  // Check for UTM or live link
  const utmParam = searchParams.get('utm');
  const urlPath = window.location.pathname.replace('/', '');
  const liveLink = urlPath.endsWith('live') ? urlPath.replace('live', '') : null;

  // Capture coupon from URL and store in localStorage
  useEffect(() => {
    const captureUrlCoupon = async () => {
      // Parse URL directly for reliability
      const urlParams = new URLSearchParams(window.location.search);
      let couponParam = urlParams.get('coupon') || searchParams.get('coupon');
      
      // Handle malformed URLs
      if (!couponParam) {
        const couponMatch = window.location.href.match(/[?&]coupon=([^&?#]+)/i);
        if (couponMatch) couponParam = couponMatch[1];
      }
      
      if (couponParam) {
        const couponCode = couponParam.toUpperCase();
        localStorage.setItem('auto_apply_coupon', couponCode);
        
        // Fetch coupon details from database
        try {
          const { data: coupon } = await supabase
            .from('coupons')
            .select('code, discount_type, discount_value')
            .eq('code', couponCode)
            .eq('is_active', true)
            .single();
          
          if (coupon) {
            const couponDetails = {
              code: coupon.code,
              type: coupon.discount_type,
              value: coupon.discount_value,
              label: coupon.discount_type === 'percentage' 
                ? `${coupon.discount_value}% OFF` 
                : `$${coupon.discount_value} OFF`
            };
            localStorage.setItem('coupon_details', JSON.stringify(couponDetails));
          }
        } catch (error) {
          // Coupon may be hardcoded, continue
        }
        
        // Dispatch events to update cards
        window.dispatchEvent(new Event('couponApplied'));
        setTimeout(() => window.dispatchEvent(new Event('couponApplied')), 500);
        setTimeout(() => window.dispatchEvent(new Event('couponApplied')), 1500);
      }
    };
    
    captureUrlCoupon();
  }, [searchParams]);

  // Refetch data when auth state changes (login/logout)
  useEffect(() => {
    // Reset dataFetched to trigger refetch
    setDataFetched(false);
  }, [user?.id]);

  useEffect(() => {
    if (!dataFetched) {
      fetchTalentData();
      fetchReviewCount();
      checkDiscount();
      setDataFetched(true);
    }
    
    // Listen for coupon/giveaway events
    const handleCouponUpdate = () => checkDiscount();
    window.addEventListener('couponApplied', handleCouponUpdate);
    window.addEventListener('storage', handleCouponUpdate);
    window.addEventListener('giveawayCountdownUpdate', handleCouponUpdate);
    
    return () => {
      window.removeEventListener('couponApplied', handleCouponUpdate);
      window.removeEventListener('storage', handleCouponUpdate);
      window.removeEventListener('giveawayCountdownUpdate', handleCouponUpdate);
    };
  }, [dataFetched]);

  useEffect(() => {
    applyOccasionFilter();
  }, [selectedOccasion, talentList]);

  const checkDiscount = () => {
    const code = localStorage.getItem('auto_apply_coupon');
    const prizeExpiry = localStorage.getItem('giveaway_prize_expiry');
    const couponDetailsStr = localStorage.getItem('coupon_details');

    if (code) {
      // If there's an expiry, check it; otherwise coupon is valid for session
      if (prizeExpiry) {
        const expiry = parseInt(prizeExpiry, 10);
        if (Date.now() >= expiry) {
          return; // Coupon expired
        }
        setExpiryTime(expiry);
      }
      
      setDiscountCode(code);
      
      // First try to get amount from coupon_details (database coupons)
      if (couponDetailsStr) {
        try {
          const details = JSON.parse(couponDetailsStr);
          if (details.code === code.toUpperCase()) {
            setDiscountAmount(details.value);
            return;
          }
        } catch (e) {
          // Continue to fallback
        }
      }
      
      // Fallback: Determine discount amount based on code name
      if (code.includes('100')) setDiscountAmount(100);
      else if (code.includes('25')) setDiscountAmount(25);
      else if (code.includes('20')) setDiscountAmount(20);
      else if (code.includes('15')) setDiscountAmount(15);
      else if (code.includes('10')) setDiscountAmount(10);
    }
  };

  const fetchReviewCount = async () => {
    try {
      // Get total users count from analytics
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      setTotalReviews(count || 516); // Fallback to 516 if error
    } catch (error) {
      setTotalReviews(516);
    }
  };

  const fetchTalentData = async () => {
    try {
      setLoading(true);

      // Fetch ALL active talent - reviews filter will determine banner cards
      const { data: talentData, error: talentError } = await supabase
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
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('total_orders', { ascending: false });

      if (talentError) throw talentError;

      if (!talentData) {
        setTalentList([]);
        setLoading(false);
        return;
      }

      // OPTIMIZE: Fetch ALL orders and reviews in 2 queries instead of N queries per talent
      const talentIds = talentData.map(t => t.id);

      // Batch fetch: Get ANY order with video (no status filter)
      // Note: Use public/anon access for orders to avoid RLS restrictions
      const { data: allOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, talent_id, video_url, occasion, completed_at, status')
        .in('talent_id', talentIds)
        .not('video_url', 'is', null) // Just needs a video
        .order('completed_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders for videos:', ordersError);
      }

      // Batch fetch: Get ONLY 5-star reviews for banner cards
      const { data: allReviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('talent_id, rating, comment, created_at, order_id')
        .in('talent_id', talentIds)
        .eq('rating', 5) // Only 5-star reviews!
        .order('created_at', { ascending: false });

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
      }

      // Debug: Log what we got
      console.log('HomePageNew: Fetched', allOrders?.length || 0, 'orders with videos,', allReviews?.length || 0, 'reviews');

      // Process data for each talent (now using cached batch data)
      const enrichedTalent = talentData.map((talent) => {
        // Get videos for this talent
        const talentOrders = allOrders?.filter(o => o.talent_id === talent.id) || [];
        
        // Get 5-star reviews for this talent
        const talentReviews = allReviews?.filter(r => r.talent_id === talent.id) || [];
        
        // Pick the most recent 5-star review with at least 45 characters
        const validReviews = talentReviews.filter(r => r.comment && r.comment.length >= 45);
        const randomReview = validReviews.length > 0 
          ? validReviews[0] // Most recent valid review (already sorted)
          : null;
        
        // Use the most recent video to prevent glitching on re-renders
        // Always use talentOrders[0] since they're sorted by completed_at desc
        const recentOrder = talentOrders.length > 0 ? talentOrders[0] : null;

        // Calculate top 3 order categories
        const categoryCount: Record<string, number> = {};
        talentOrders.forEach((order) => {
          if (order.occasion) {
            categoryCount[order.occasion] = (categoryCount[order.occasion] || 0) + 1;
          }
        });

        // Get top 3 - Use featured_shoutout_types if set by admin, otherwise calculate from orders
        const topCategories = talent.featured_shoutout_types && talent.featured_shoutout_types.length > 0
          ? talent.featured_shoutout_types.slice(0, 3)
          : Object.entries(categoryCount)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([category]) => category);

        return {
          ...talent,
          recent_video_url: recentOrder?.video_url,
          recent_review: randomReview ? {
            rating: randomReview.rating,
            comment: randomReview.comment
          } : undefined,
          top_categories: topCategories,
        };
      });

      // Store ALL active talent for carousels (before filtering)
      setAllActiveTalent(enrichedTalent);

      // BANNER CARDS: Show talent with reviews (that's it)
      const talentForBanners = enrichedTalent.filter(t => t.recent_review);

      // Find similar talent for each (same categories)
      const talentWithSimilar = talentForBanners.map((talent) => {
        const similar = enrichedTalent // Use ALL active talent for carousels
          .filter((other) => {
            if (other.id === talent.id) return false;
            // Check if they share any categories
            const sharedCategories = talent.categories?.filter((cat: string) =>
              other.categories?.includes(cat)
            );
            return sharedCategories && sharedCategories.length > 0;
          })
          .slice(0, 10); // Get up to 10 similar talent

        return {
          ...talent,
          similar_talent: similar,
        };
      });

      // Sort by priority: UTM/live link first, then by total_orders
      let sortedTalent = [...talentWithSimilar];
      
      if (utmParam === '1' || liveLink) {
        // Find the priority talent
        const priorityTalent = sortedTalent.find((t) => 
          t.username.toLowerCase() === liveLink?.toLowerCase() ||
          t.slug?.toLowerCase() === liveLink?.toLowerCase()
        );

        if (priorityTalent) {
          // Move priority talent to front
          sortedTalent = [
            priorityTalent,
            ...sortedTalent.filter((t) => t.id !== priorityTalent.id),
          ];
        }
      } else {
        // Randomly shuffle the top 4 banner cards for each viewer
        // This creates variety so different visitors see different orders
        const top4 = sortedTalent.slice(0, 4);
        const rest = sortedTalent.slice(4);
        
        // Fisher-Yates shuffle for true randomness (not seeded)
        for (let i = top4.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [top4[i], top4[j]] = [top4[j], top4[i]];
        }
        
        sortedTalent = [...top4, ...rest];
      }

      setTalentList(sortedTalent);
      setFilteredTalent(sortedTalent);
      
      // Fetch ALL featured talent separately (even without orders)
      const { data: allFeatured } = await supabase
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
        .eq('is_featured', true)
        .order('display_order', { ascending: true });
      
      setFeaturedTalent(allFeatured || []);
    } catch (error) {
      console.error('Error fetching talent:', error);
      setTalentList([]);
    } finally {
      setLoading(false);
    }
  };

  const applyOccasionFilter = () => {
    // Don't filter - just show carousel under occasions section
    setFilteredTalent(talentList);
  };

  const handleOccasionClick = (occasionKey: string) => {
    if (selectedOccasion === occasionKey) {
      setSelectedOccasion(null); // Deselect if clicking same occasion
    } else {
      setSelectedOccasion(occasionKey);
    }
  };

  // Pre-compute all carousels to prevent duplicates in first 3 positions
  const precomputedCarousels = useMemo(() => {
    if (!filteredTalent.length || !allActiveTalent.length) return {};
    
    const usedInFirst3 = new Set<string>(); // Track talent used in positions 0-2
    const carousels: Record<number, TalentWithDetails[]> = {};
    
    // First carousel (index 0) - Featured talent
    const featured0 = filteredTalent[0];
    const featured1 = filteredTalent[1];
    if (featured0) {
      const excludeIds = [featured0.id, featured1?.id].filter(Boolean);
      const filtered = featuredTalent.filter(t => !excludeIds.includes(t.id) && t.users);
      const shuffled = seededShuffle(filtered, `featured-${featured0.id}`);
      carousels[0] = shuffled;
      // Mark first 3 as used
      shuffled.slice(0, 3).forEach(t => usedInFirst3.add(t.id));
    }
    
    // Subsequent carousels (index > 1)
    filteredTalent.forEach((talent, index) => {
      if (index <= 1) return;
      
      const prevBanner = filteredTalent[index - 1];
      const nextBanner = filteredTalent[index + 1];
      const excludeIds = new Set([talent.id, prevBanner?.id, nextBanner?.id].filter(Boolean));
      
      // Filter: exclude adjacent banners AND talent already used in first 3 positions
      const available = allActiveTalent.filter(t => 
        t.users && !excludeIds.has(t.id) && !usedInFirst3.has(t.id)
      );
      
      // If not enough talent without duplicates, allow some duplicates but shuffle differently
      let pool = available;
      if (pool.length < 12) {
        // Add back some talent but still exclude adjacent banners
        const withDuplicates = allActiveTalent.filter(t => t.users && !excludeIds.has(t.id));
        pool = withDuplicates;
      }
      
      const shuffled = seededShuffle(pool, `carousel-${index}-${talent.id}`);
      const rotateBy = (index * 4) % Math.max(shuffled.length, 1);
      const rotated = [...shuffled.slice(rotateBy), ...shuffled.slice(0, rotateBy)];
      const items = rotated.slice(0, 12);
      
      carousels[index] = items;
      // Mark first 3 as used
      items.slice(0, 3).forEach(t => usedInFirst3.add(t.id));
    });
    
    return carousels;
  }, [filteredTalent, featuredTalent, allActiveTalent]);

  return (
    <>
      <SEOHelmet 
        title="ShoutOut - Personalized Video ShoutOuts from Free-Speech Influencers"
        description="Book personalized video messages from your favorite free-speech influencers. Authentic video shoutouts for birthdays, special occasions, and more."
        keywords="personalized video shoutout, video message, celebrity shoutout, influencer video, birthday video message"
        url="https://shoutout.us"
      />

      <div className="min-h-screen">
        {/* Hero Header with Rotating Tagline + Occasions */}
        <div className="pt-6 sm:pt-8 pb-4 mb-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Show occasion phrase if selected from popup, otherwise show rotating tagline */}
            {occasionFromPopup && OCCASION_PHRASES[occasionFromPopup] ? (
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6 min-h-[2.5em] flex items-center justify-center">
                <span className="animate-fade-in">
                  {OCCASION_PHRASES[occasionFromPopup]}
                </span>
              </h1>
            ) : (
              <>
                {/* Rotating Tagline */}
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6 min-h-[2.5em] flex items-center justify-center">
                  <span 
                    key={currentTaglineIndex}
                    className="animate-fade-in"
                  >
                    {ROTATING_TAGLINES[currentTaglineIndex]}
                  </span>
                </h1>
                
                {/* Occasion Buttons in Header - hide when occasion selected from popup */}
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {OCCASIONS.map((occasion) => (
                    <button
                      key={occasion.key}
                      onClick={() => handleOccasionClick(occasion.key)}
                      className={`glass rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 hover:scale-105 transition-all text-center ${
                        selectedOccasion === occasion.key ? 'ring-2 ring-cyan-400' : ''
                      }`}
                    >
                      <span className="text-sm sm:text-base mr-1">{occasion.emoji}</span>
                      <span className="text-white font-medium text-xs sm:text-sm">{occasion.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            
            {/* Carousel for selected occasion - only show if NOT selected from popup */}
            {selectedOccasion && !occasionFromPopup && (() => {
              // Special handling for different occasion types
              const isCorporate = selectedOccasion === 'corporate';
              const isExpress = selectedOccasion === 'express';
              
              // Use curated talent mapping for occasions (except corporate and express)
              let occasionTalentList: TalentWithDetails[] = [];
              
              if (isCorporate) {
                // Corporate: filter by corporate_pricing - show all
                const corporateTalent = allActiveTalent.filter(t => 
                  t.users && t.corporate_pricing && t.corporate_pricing > 0
                );
                occasionTalentList = corporateTalent;
              } else if (isExpress) {
                // Express/24hr Delivery: filter by express_delivery_enabled
                const expressTalent = allActiveTalent.filter(t => 
                  t.users && t.express_delivery_enabled === true
                );
                occasionTalentList = expressTalent;
              } else {
                // Use curated mapping - show ALL curated talent for the occasion
                const curatedUsernames = OCCASION_TALENT_MAPPING[selectedOccasion] || [];
                const curatedTalent = curatedUsernames
                  .map(username => allActiveTalent.find(t => t.username?.toLowerCase() === username.toLowerCase()))
                  .filter((t): t is TalentWithDetails => t !== undefined && t.users !== undefined);
                occasionTalentList = curatedTalent; // Show all, not just 4
              }
              
              const hasOverflow = occasionTalentList.length > 4;
              
              return occasionTalentList.length > 0 ? (
                <div className="mt-4">
                  <div className="relative group">
                    <div 
                      className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {occasionTalentList.map((t) => (
                        <div key={t.id} className="flex-shrink-0" style={{ width: '140px' }}>
                          <TalentCard talent={t as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact showExpressBadge={t.express_delivery_enabled} />
                        </div>
                      ))}
                    </div>
                    {/* Right Fade Gradient - only show if overflow */}
                    {hasOverflow && (
                      <div 
                        className="absolute top-0 right-0 bottom-4 w-16 pointer-events-none"
                        style={{
                          background: 'linear-gradient(to right, transparent 0%, rgba(15, 15, 26, 0.9) 100%)'
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-4 lg:px-6 pb-12">
          {loading ? (
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass rounded-3xl h-64 animate-pulse"></div>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            // Search Results - Show as grid of cards
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                Search Results for "{searchQuery}" ({filteredTalent.length} found)
              </h2>
              {filteredTalent.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">No talent found matching "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {filteredTalent.map((talent) => (
                    <TalentCard 
                      key={talent.id} 
                      talent={talent as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} 
                      compact 
                      showExpressBadge={talent.express_delivery_enabled}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : filteredTalent.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white text-xl">No talent found.</p>
              <button
                onClick={() => setSelectedOccasion(null)}
                className="mt-4 px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              >
                Show All Talent
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Talent Banner Cards with Carousels/Occasions */}
              {filteredTalent.map((talent, index) => (
                <div key={talent.id} className="space-y-3">
                  {/* Banner Card */}
                  <TalentBannerCard
                    talent={talent}
                    videoOnRight={index % 2 === 0}
                    topCategories={talent.top_categories || []}
                  />

                  {/* After FIRST banner: Show Featured Talent carousel (precomputed, no duplicates in first 3) */}
                  {index === 0 && precomputedCarousels[0] && (() => {
                    const carouselItems = precomputedCarousels[0];
                    const hasOverflow = carouselItems.length > 5;
                    return (
                      <div className="space-y-2">
                        <div className="relative group">
                          <div 
                            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                            style={{
                              scrollbarWidth: 'none',
                              msOverflowStyle: 'none',
                            }}
                          >
                            {carouselItems.map((ft) => (
                              <div 
                                key={ft.id} 
                                className="flex-shrink-0"
                                style={{ width: '140px' }}
                              >
                                <TalentCard talent={ft as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
                              </div>
                            ))}
                          </div>
                          
                          {/* Right Fade Gradient - only show if overflow */}
                          {hasOverflow && (
                            <div 
                              className="absolute top-0 right-0 bottom-4 w-24 pointer-events-none"
                              style={{
                                background: 'linear-gradient(to right, transparent 0%, rgba(15, 15, 26, 0.8) 70%, rgb(15, 15, 26) 100%)'
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}


                  {/* After 2nd banner (index 1): Show Comedians carousel */}
                  {index === 1 && (() => {
                    const comedianTalent = COMEDIAN_TALENT
                      .map(username => allActiveTalent.find(t => t.username?.toLowerCase() === username.toLowerCase()))
                      .filter((t): t is TalentWithDetails => t !== undefined && t.users !== undefined);
                    
                    if (comedianTalent.length === 0) return null;
                    
                    return (
                      <div className="space-y-2">
                        <div className="inline-block">
                          <span className="px-4 py-1.5 rounded-full text-sm font-bold glass-strong bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white border border-white/20">
                            🎭 Comedians
                          </span>
                        </div>
                        <div className="relative group">
                          <div 
                            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {comedianTalent.map((t) => (
                              <div key={t.id} className="flex-shrink-0" style={{ width: '140px' }}>
                                <TalentCard talent={t as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* After 5th banner (index 4): Show Actors carousel */}
                  {index === 4 && (() => {
                    const actorTalent = ACTOR_TALENT
                      .map(username => allActiveTalent.find(t => t.username?.toLowerCase() === username.toLowerCase()))
                      .filter((t): t is TalentWithDetails => t !== undefined && t.users !== undefined);
                    
                    if (actorTalent.length === 0) return null;
                    
                    return (
                      <div className="space-y-2">
                        <div className="inline-block">
                          <span className="px-4 py-1.5 rounded-full text-sm font-bold glass-strong bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-white/20">
                            🎬 Actors
                          </span>
                        </div>
                        <div className="relative group">
                          <div 
                            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {actorTalent.map((t) => (
                              <div key={t.id} className="flex-shrink-0" style={{ width: '140px' }}>
                                <TalentCard talent={t as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* For index > 1 (except 1 and 4 which have dedicated carousels): Show precomputed carousel */}
                  {index > 1 && index !== 4 && precomputedCarousels[index] && (() => {
                    const carouselItems = precomputedCarousels[index];
                    
                    if (carouselItems.length === 0) return null;
                    
                    const hasOverflow = carouselItems.length > 5;
                    return (
                      <div className="space-y-2">
                        <div className="relative group">
                          <div 
                            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                            style={{
                              scrollbarWidth: 'none',
                              msOverflowStyle: 'none',
                            }}
                          >
                            {carouselItems.map((randomTalent) => (
                              <div 
                                key={randomTalent.id} 
                                className="flex-shrink-0"
                                style={{ width: '140px' }}
                              >
                                <TalentCard talent={randomTalent as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
                              </div>
                            ))}
                          </div>
                          
                          {/* Right Fade Gradient - only show if overflow */}
                          {hasOverflow && (
                            <div 
                              className="absolute top-0 right-0 bottom-4 w-24 pointer-events-none"
                              style={{
                                background: 'linear-gradient(to right, transparent 0%, rgba(15, 15, 26, 0.8) 70%, rgb(15, 15, 26) 100%)'
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOMO Notification */}
        <FOMONotification interval={8000} />
      </div>
    </>
  );
}
