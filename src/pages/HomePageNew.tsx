import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import TalentCard from '../components/TalentCard';
import TalentBannerCard from '../components/TalentBannerCard';
import SEOHelmet from '../components/SEOHelmet';
import FOMONotification from '../components/FOMONotification';
import { useAuth } from '../context/AuthContext';

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
  { key: 'pep-talk', label: 'Surprise a Loved One', emoji: '💝' },
  { key: 'birthday', label: 'Birthday Wishes', emoji: '🎂' },
  { key: 'roast', label: 'Friendly Roast', emoji: '🔥' },
  { key: 'advice', label: 'Get Advice', emoji: '💡' },
  { key: 'corporate', label: 'Corporate Event', emoji: '🏢' },
];

export default function HomePageNew() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [talentList, setTalentList] = useState<TalentWithDetails[]>([]);
  const [filteredTalent, setFilteredTalent] = useState<TalentWithDetails[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithDetails[]>([]); // ALL featured talent
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalReviews, setTotalReviews] = useState(0);
  const [dataFetched, setDataFetched] = useState(false);
  
  // Get discount info from localStorage
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);

  // Check for UTM or live link
  const utmParam = searchParams.get('utm');
  const urlPath = window.location.pathname.replace('/', '');
  const liveLink = urlPath.endsWith('live') ? urlPath.replace('live', '') : null;

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
    const prizeBrand = localStorage.getItem('giveaway_prize');
    const prizeExpiry = localStorage.getItem('giveaway_prize_expiry');

    if (code && prizeExpiry) {
      const expiry = parseInt(prizeExpiry, 10);
      if (Date.now() < expiry) {
        setDiscountCode(code);
        setExpiryTime(expiry);
        
        // Determine discount amount based on code
        if (code.includes('15')) setDiscountAmount(15);
        else if (code.includes('10')) setDiscountAmount(10);
        else if (code.includes('25')) setDiscountAmount(25);
        else if (code.includes('20')) setDiscountAmount(20);
        else if (code.includes('100')) setDiscountAmount(100); // Free shoutout
      }
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

  return (
    <>
      <SEOHelmet 
        title="ShoutOut - Personalized Video ShoutOuts from Free-Speech Influencers"
        description="Book personalized video messages from your favorite free-speech influencers. Authentic video shoutouts for birthdays, special occasions, and more."
        keywords="personalized video shoutout, video message, celebrity shoutout, influencer video, birthday video message"
        url="https://shoutout.us"
      />

      <div className="min-h-screen">
        {/* Hero Header */}
        <div className="pt-6 sm:pt-8 pb-4 mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-lg sm:text-xl font-normal text-white mb-2">
              Personalized Video ShoutOuts From<br />Free-Speech Influencers
            </h1>
            
            {/* Rating */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="#facc15">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-base sm:text-lg font-medium text-white/80">
                5.0 ({totalReviews.toLocaleString()} fans)
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-6 pb-12">
          {loading ? (
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass rounded-3xl h-64 animate-pulse"></div>
              ))}
            </div>
          ) : filteredTalent.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white text-xl">No talent found for this occasion.</p>
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

                  {/* After FIRST banner: Show Featured Talent carousel */}
                  {index === 0 && (() => {
                    const carouselItems = featuredTalent.filter(t => t.id !== talent.id && t.users);
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

                  {/* After SECOND banner: Show "ShoutOut for every occasion" */}
                  {index === 1 && (
                    <div className="mt-8 mb-6 md:mt-12 md:mb-10">
                      <h2 className="text-lg sm:text-xl font-bold text-white text-center mb-4 md:mb-6">
                        A ShoutOut for every occasion
                      </h2>
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
                      
                      {/* Carousel for selected occasion */}
                      {selectedOccasion && (() => {
                        // Include talent with this occasion in top_categories OR featured_shoutout_types
                        const occasionTalent = talentList.filter(t => 
                          t.users && (
                            t.top_categories?.includes(selectedOccasion) ||
                            t.featured_shoutout_types?.includes(selectedOccasion)
                          )
                        );
                        const hasOverflow = occasionTalent.length > 5;
                        return (
                          <div className="mt-4">
                            <div className="relative group">
                              <div 
                                className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                              >
                                {occasionTalent.map((t) => (
                                  <div key={t.id} className="flex-shrink-0" style={{ width: '140px' }}>
                                    <TalentCard talent={t as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
                                  </div>
                                ))}
                              </div>
                              {/* Right Fade Gradient - only show if overflow */}
                              {hasOverflow && (
                                <div 
                                  className="absolute top-0 right-0 bottom-4 w-16 pointer-events-none"
                                  style={{ background: 'linear-gradient(to right, transparent 0%, rgba(15, 15, 26, 0.8) 70%, rgb(15, 15, 26) 100%)' }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* For index > 1: Show similar talent carousel */}
                  {index > 1 && talent.similar_talent && talent.similar_talent.length > 0 && (() => {
                    const similarItems = talent.similar_talent.filter(t => t.users);
                    const hasOverflow = similarItems.length > 5;
                    return (
                      <div className="space-y-2">
                        <h3 className="text-white text-lg font-semibold px-2">
                          Others like "{talent.temp_full_name || talent.users?.full_name || talent.username}"
                        </h3>
                        <div className="relative group">
                          <div 
                            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                            style={{
                              scrollbarWidth: 'none',
                              msOverflowStyle: 'none',
                            }}
                          >
                            {similarItems.map((similarTalent) => (
                              <div 
                                key={similarTalent.id} 
                                className="flex-shrink-0"
                                style={{ width: '140px' }}
                              >
                                <TalentCard talent={similarTalent as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
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
