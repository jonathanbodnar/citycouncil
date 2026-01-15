import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import TalentCard from '../components/TalentCard';
import TalentBannerCard from '../components/TalentBannerCard';
import SEOHelmet from '../components/SEOHelmet';
import FOMONotification from '../components/FOMONotification';

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
  const [talentList, setTalentList] = useState<TalentWithDetails[]>([]);
  const [filteredTalent, setFilteredTalent] = useState<TalentWithDetails[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalReviews, setTotalReviews] = useState(0);
  
  // Get discount info from localStorage
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [expiryTime, setExpiryTime] = useState<number | null>(null);

  // Check for UTM or live link
  const utmParam = searchParams.get('utm');
  const urlPath = window.location.pathname.replace('/', '');
  const liveLink = urlPath.endsWith('live') ? urlPath.replace('live', '') : null;

  useEffect(() => {
    fetchTalentData();
    fetchReviewCount();
    checkDiscount();
  }, []);

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
      }
    }
  };

  const fetchReviewCount = async () => {
    try {
      const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true });
      setTotalReviews(count || 477); // Fallback to 477 if no reviews
    } catch (error) {
      setTotalReviews(477);
    }
  };

  const fetchTalentData = async () => {
    try {
      setLoading(true);

      // Fetch talent with at least one completed order (video delivered)
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
        .gt('total_orders', 0)
        .order('total_orders', { ascending: false });

      if (talentError) throw talentError;

      if (!talentData) {
        setTalentList([]);
        setLoading(false);
        return;
      }

      // OPTIMIZE: Fetch ALL orders and reviews in 2 queries instead of N queries per talent
      const talentIds = talentData.map(t => t.id);

      // Batch fetch: Get most recent completed order with video for each talent
      const { data: allOrders } = await supabase
        .from('orders')
        .select('talent_id, video_url, occasion, completed_at, status')
        .in('talent_id', talentIds)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('completed_at', { ascending: false });

      // Batch fetch: Get most recent review for each talent
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('talent_id, rating, comment, created_at')
        .in('talent_id', talentIds)
        .order('created_at', { ascending: false });

      // Process data for each talent (now using cached batch data)
      const enrichedTalent = talentData.map((talent) => {
        // Get most recent video for this talent
        const talentOrders = allOrders?.filter(o => o.talent_id === talent.id) || [];
        const recentOrder = talentOrders[0]; // Already sorted by completed_at desc

        // Get most recent review for this talent
        const talentReviews = allReviews?.filter(r => r.talent_id === talent.id) || [];
        const recentReview = talentReviews[0]; // Already sorted by created_at desc

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
          recent_review: recentReview ? {
            rating: recentReview.rating,
            comment: recentReview.comment
          } : undefined,
          top_categories: topCategories,
        };
      });

      // Filter out talent without videos
      const talentWithVideos = enrichedTalent.filter(t => t.recent_video_url);

      // Find similar talent for each (same categories)
      const talentWithSimilar = talentWithVideos.map((talent) => {
        const similar = talentWithVideos
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
    } catch (error) {
      console.error('Error fetching talent:', error);
      setTalentList([]);
    } finally {
      setLoading(false);
    }
  };

  const applyOccasionFilter = () => {
    if (!selectedOccasion) {
      setFilteredTalent(talentList);
      return;
    }

    // Filter talent that have orders with this occasion
    const filtered = talentList.filter((talent) =>
      talent.top_categories?.includes(selectedOccasion)
    );

    setFilteredTalent(filtered);
  };

  const handleOccasionClick = (occasionKey: string) => {
    if (selectedOccasion === occasionKey) {
      setSelectedOccasion(null); // Deselect if clicking same occasion
    } else {
      setSelectedOccasion(occasionKey);
      // Scroll to filtered results
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
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
        <div className="py-8 mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-[1.75rem] font-normal text-white mb-4">
              Personalized Video ShoutOuts From<br />Free-Speech Influencers
            </h1>
            
            {/* Rating */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-6 h-6" viewBox="0 0 20 20" fill="#facc15">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-xl font-medium text-white/80">
                5.0 ({totalReviews.toLocaleString()} fans)
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
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
            <div className="space-y-12">
              {/* Talent Banner Cards with Similar Talent Carousels */}
              {filteredTalent.map((talent, index) => (
                <div key={talent.id} className="space-y-4">
                  {/* Banner Card */}
                  <TalentBannerCard
                    talent={talent}
                    videoOnRight={index % 2 === 0}
                    topCategories={talent.top_categories || []}
                    discountCode={discountCode || undefined}
                    discountAmount={discountAmount || undefined}
                    expiryTime={expiryTime || undefined}
                  />

                  {/* Similar Talent Carousel */}
                  {talent.similar_talent && talent.similar_talent.length > 0 && (
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
                          {talent.similar_talent.filter(t => t.users).map((similarTalent) => (
                            <div 
                              key={similarTalent.id} 
                              className="flex-shrink-0"
                              style={{ width: '180px' }}
                            >
                              <TalentCard talent={similarTalent as TalentProfile & { users: { id: string; full_name: string; avatar_url?: string } }} compact />
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
                  )}
                </div>
              ))}

              {/* "A ShoutOut for every occasion" Section - Show after first talent */}
              {!selectedOccasion && filteredTalent.length > 0 && (
                <div className="my-16">
                  <h2 className="text-3xl font-bold text-white text-center mb-8">
                    A ShoutOut for every occasion
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {OCCASIONS.map((occasion) => (
                      <button
                        key={occasion.key}
                        onClick={() => handleOccasionClick(occasion.key)}
                        className="glass rounded-2xl p-6 hover:scale-105 transition-all text-center"
                      >
                        <div className="text-5xl mb-3">{occasion.emoji}</div>
                        <p className="text-white font-medium">{occasion.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOMO Notification */}
        <FOMONotification interval={8000} />
      </div>
    </>
  );
}
