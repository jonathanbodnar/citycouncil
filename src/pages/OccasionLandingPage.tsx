import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import TalentCard from '../components/TalentCard';
import TalentBannerCard from '../components/TalentBannerCard';
import SEOHelmet from '../components/SEOHelmet';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PauseIcon, StarIcon, BoltIcon, GiftIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/solid';

interface TalentWithDetails extends TalentProfile {
  users?: { id: string; full_name: string; avatar_url?: string };
  recent_video_url?: string;
  recent_review?: { rating: number; comment: string };
  top_categories?: string[];
}

interface OccasionConfig {
  key: string;
  label: string;
  emoji: string;
  headline: string;
  subheadline: string;
  painPoints: string[];
  ctaText: string;
  expressHeadline: string;
  seoTitle: string;
  seoDescription: string;
}

// Configuration for each occasion
const OCCASION_CONFIGS: Record<string, OccasionConfig> = {
  birthday: {
    key: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    headline: "They won't remember a text. They will remember this.",
    subheadline: "The birthday gift that gets replayed for years.",
    painPoints: [
      "When a 'Happy Birthday' text just isn't enough.",
      "People that really care send a Birthday ShoutOut.",
      "You'll never top last year's gift — unless you do this.",
      "The birthday gift that gets replayed for years.",
    ],
    ctaText: "Send a Birthday ShoutOut",
    expressHeadline: "Birthday tomorrow? We got you.",
    seoTitle: "Birthday ShoutOut | Personalized Video Birthday Messages",
    seoDescription: "Send an unforgettable birthday gift. Get a personalized video message from your favorite personalities. The gift they'll replay for years.",
  },
  roast: {
    key: 'roast',
    label: 'Friendly Roast',
    emoji: '🔥',
    headline: "Your group chat will never recover from this.",
    subheadline: "A roast so good, they'll frame it.",
    painPoints: [
      "Your friend deserves to be absolutely destroyed.",
      "The roast that becomes a legendary inside joke.",
      "Some burns are too good for regular people to deliver.",
      "When you want to destroy them, but with love.",
    ],
    ctaText: "Order a Roast",
    expressHeadline: "Need to roast someone by tomorrow?",
    seoTitle: "Friendly Roast ShoutOut | Personalized Roast Videos",
    seoDescription: "Order a hilarious personalized roast video. The perfect way to roast your friends with help from your favorite personalities.",
  },
  encouragement: {
    key: 'encouragement',
    label: 'Encouragement',
    emoji: '💪',
    headline: "Sometimes they need to hear it from someone else.",
    subheadline: "A pep talk that actually sticks.",
    painPoints: [
      "When your words aren't getting through.",
      "The encouragement they need, from someone they admire.",
      "A message that could change everything.",
      "Sometimes the right words need the right voice.",
    ],
    ctaText: "Send Encouragement",
    expressHeadline: "Big moment tomorrow? Get a pep talk today.",
    seoTitle: "Encouragement ShoutOut | Personalized Pep Talk Videos",
    seoDescription: "Send an inspiring personalized pep talk video. Help someone you love with encouragement from personalities they admire.",
  },
  advice: {
    key: 'advice',
    label: 'Get Advice',
    emoji: '💡',
    headline: "Get advice from people who've actually been there.",
    subheadline: "Real wisdom from real experience.",
    painPoints: [
      "When you need more than a Google search.",
      "Advice from people who've walked the path.",
      "The guidance that could change your trajectory.",
      "Sometimes you need to hear it from the pros.",
    ],
    ctaText: "Get Advice",
    expressHeadline: "Need guidance fast?",
    seoTitle: "Get Advice ShoutOut | Personalized Advice Videos",
    seoDescription: "Get personalized advice from experts and personalities you trust. Real wisdom from real experience, delivered just for you.",
  },
  celebrate: {
    key: 'celebrate',
    label: 'Celebrate a Win',
    emoji: '🏆',
    headline: "Make their win feel even bigger.",
    subheadline: "The celebration they'll never forget.",
    painPoints: [
      "They achieved something huge. Celebrate it huge.",
      "A congratulations that actually matches the moment.",
      "Turn their win into an unforgettable memory.",
      "Some victories deserve more than a 'congrats' text.",
    ],
    ctaText: "Send a Celebration",
    expressHeadline: "Celebrate their win today.",
    seoTitle: "Celebration ShoutOut | Personalized Congratulations Videos",
    seoDescription: "Send an unforgettable congratulations video. Celebrate achievements with personalized messages from amazing personalities.",
  },
  announcement: {
    key: 'announcement',
    label: 'Announcement',
    emoji: '📣',
    headline: "Make your announcement unforgettable.",
    subheadline: "Big news deserves a big delivery.",
    painPoints: [
      "Some announcements need to be legendary.",
      "The reveal that everyone will talk about.",
      "When the news is too big for a text.",
      "Make it a moment they'll replay forever.",
    ],
    ctaText: "Make an Announcement",
    expressHeadline: "Big reveal coming up?",
    seoTitle: "Announcement ShoutOut | Personalized Announcement Videos",
    seoDescription: "Make your big announcement unforgettable with a personalized video message. Perfect for reveals, proposals, and life updates.",
  },
  debate: {
    key: 'debate',
    label: 'End a Debate',
    emoji: '⚔️',
    headline: "End the debate. Permanently.",
    subheadline: "Settle it with authority.",
    painPoints: [
      "When you need to prove you were right all along.",
      "End arguments with the ultimate trump card.",
      "They won't argue with this authority.",
      "Settle it once and for all.",
    ],
    ctaText: "End the Debate",
    expressHeadline: "Need to win this argument today?",
    seoTitle: "Settle a Debate ShoutOut | End Arguments with Authority",
    seoDescription: "End debates and settle arguments with personalized videos from authoritative voices. Prove your point once and for all.",
  },
  corporate: {
    key: 'corporate',
    label: 'Corporate Event',
    emoji: '🏢',
    headline: "Make your event the one they talk about.",
    subheadline: "Corporate entertainment that actually impresses.",
    painPoints: [
      "Boring events make boring impressions.",
      "The keynote surprise no one saw coming.",
      "Make your corporate event actually memorable.",
      "When PowerPoints just won't cut it.",
    ],
    ctaText: "Book for Your Event",
    expressHeadline: "Event coming up fast?",
    seoTitle: "Corporate Event ShoutOut | Business Video Messages",
    seoDescription: "Elevate your corporate event with personalized video messages. Perfect for team building, awards, and company celebrations.",
  },
};

// Curated talent for each occasion (by username)
const OCCASION_TALENT_MAPPING: Record<string, string[]> = {
  'birthday': ['shawnfarash', 'meloniemac', 'joshfirestine', 'lydiashaffer', 'thehodgetwins', 'elsakurt', 'jeremyhambly', 'kevinsorbo', 'kayleecampbell', 'jeremyherrell'],
  'roast': ['shawnfarash', 'hayleycaronia', 'joshfirestine', 'jpsears', 'thehodgetwins', 'bryancallen', 'nickdipaolo', 'elsakurt', 'esteepalti', 'pearldavis', 'lauraloomer', 'kaitlinbennett', 'mattiseman'],
  'announcement': ['shawnfarash', 'hayleycaronia', 'lydiashaffer', 'bryancallen', 'basrutten', 'nicksearcy', 'markdavis', 'larryelder', 'mattiseman'],
  'encouragement': ['meloniemac', 'hayleycaronia', 'jpsears', 'lydiashaffer', 'davidharrisjr', 'bryancallen', 'elsakurt', 'basrutten', 'gregonfire', 'nicksearcy', 'markdavis', 'larryelder', 'geraldmorgan', 'kevinsorbo', 'johnohurley'],
  'celebrate': ['joshfirestine', 'jpsears', 'jeremyhambly', 'basrutten', 'bradstine', 'gregonfire', 'chaelsonnen', 'lauraloomer', 'johnohurley', 'mattiseman'],
  'debate': ['davidharrisjr', 'nickdipaolo', 'bradstine', 'kayleecampbell', 'chaelsonnen', 'lauraloomer', 'pearldavis', 'geraldmorgan', 'kaitlinbennett', 'chrissalcedo'],
  'advice': ['meloniemac', 'thehodgetwins', 'davidharrisjr', 'nickdipaolo', 'bradstine', 'esteepalti', 'gregonfire', 'nicksearcy', 'chaelsonnen', 'markdavis', 'larryelder', 'pearldavis', 'geraldmorgan', 'kevinsorbo', 'kaitlinbennett', 'chrissalcedo', 'johnohurley'],
  'corporate': ['shawnfarash', 'meloniemac', 'bryancallen', 'basrutten', 'nicksearcy', 'kevinsorbo', 'johnohurley'],
};

// Seeded random shuffle for consistent ordering
const seededShuffle = <T,>(arr: T[], seed: string): T[] => {
  const shuffled = [...arr];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Horizontal scroll carousel component
const TalentCarousel: React.FC<{
  talent: TalentWithDetails[];
  title: string;
  subtitle?: string;
}> = ({ talent, title, subtitle }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkArrows = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkArrows();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkArrows);
      return () => ref.removeEventListener('scroll', checkArrows);
    }
  }, [talent]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (talent.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4 px-4 md:px-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="hidden md:flex gap-2">
          <button
            onClick={() => scroll('left')}
            className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${!showLeftArrow ? 'opacity-30 cursor-not-allowed' : ''}`}
            disabled={!showLeftArrow}
          >
            <ChevronLeftIcon className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => scroll('right')}
            className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${!showRightArrow ? 'opacity-30 cursor-not-allowed' : ''}`}
            disabled={!showRightArrow}
          >
            <ChevronRightIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-4 md:px-8"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {talent.map((t) => (
          <div key={t.id} className="flex-shrink-0 w-[160px] md:w-[200px]">
            <TalentCard talent={t as any} compact showExpressBadge={t.express_delivery_enabled} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Video example with review component
const VideoExampleCard: React.FC<{
  videoUrl: string;
  review: { rating: number; comment: string; reviewer_name?: string };
  occasionEmoji: string;
}> = ({ videoUrl, review, occasionEmoji }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl overflow-hidden border border-gray-700/50 shadow-xl">
      {/* Video */}
      <div className="relative aspect-[9/16] max-h-[400px]">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          playsInline
          muted={!isPlaying}
          loop
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
        >
          <div className={`w-16 h-16 rounded-full bg-white/90 flex items-center justify-center transition-transform group-hover:scale-110 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : ''}`}>
            {isPlaying ? (
              <PauseIcon className="w-8 h-8 text-gray-900" />
            ) : (
              <PlayIcon className="w-8 h-8 text-gray-900 ml-1" />
            )}
          </div>
        </button>
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
          <span>{occasionEmoji} Real ShoutOut</span>
        </div>
      </div>
      
      {/* Review */}
      <div className="p-4">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-600'}`} />
          ))}
        </div>
        <p className="text-gray-300 text-sm line-clamp-3">"{review.comment}"</p>
        {review.reviewer_name && (
          <p className="text-gray-500 text-xs mt-2">— {review.reviewer_name}</p>
        )}
      </div>
    </div>
  );
};

// Main component
export default function OccasionLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Extract occasion from URL path (e.g., /birthday -> birthday)
  const occasion = location.pathname.replace('/', '').split('/')[0] || 'birthday';
  
  const [loading, setLoading] = useState(true);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithDetails[]>([]);
  const [moreTalent, setMoreTalent] = useState<TalentWithDetails[]>([]);
  const [expressTalent, setExpressTalent] = useState<TalentWithDetails[]>([]);
  const [exampleVideos, setExampleVideos] = useState<{ video_url: string; review: any }[]>([]);
  const [currentPainPointIndex, setCurrentPainPointIndex] = useState(0);
  
  const config = OCCASION_CONFIGS[occasion || 'birthday'] || OCCASION_CONFIGS.birthday;
  
  // Capture UTM from URL
  useEffect(() => {
    const utmParam = searchParams.get('utm') || searchParams.get('umt');
    if (utmParam) {
      localStorage.setItem('promo_source_global', utmParam);
    }
  }, [searchParams]);
  
  // Rotate pain points
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPainPointIndex((prev) => (prev + 1) % config.painPoints.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [config.painPoints.length]);

  // Fetch talent data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch all active talent
        const { data: talentData } = await supabase
          .from('talent_profiles')
          .select(`*, users!talent_profiles_user_id_fkey (id, full_name, avatar_url)`)
          .eq('is_active', true)
          .order('total_orders', { ascending: false });
        
        if (!talentData || talentData.length === 0) {
          setLoading(false);
          return;
        }
        
        const talentIds = talentData.map(t => t.id);
        
        // Fetch orders with videos for this occasion
        const { data: occasionOrders } = await supabase
          .from('orders')
          .select('id, talent_id, video_url, occasion, completed_at')
          .in('talent_id', talentIds)
          .not('video_url', 'is', null)
          .eq('status', 'completed')
          .eq('occasion', config.key)
          .order('completed_at', { ascending: false })
          .limit(50);
        
        // Fetch all completed orders with videos (for any occasion)
        const { data: allOrders } = await supabase
          .from('orders')
          .select('id, talent_id, video_url, occasion, completed_at')
          .in('talent_id', talentIds)
          .not('video_url', 'is', null)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(100);
        
        // Fetch 5-star reviews
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('talent_id, rating, comment, created_at, order_id')
          .in('talent_id', talentIds)
          .eq('rating', 5)
          .not('comment', 'is', null);
        
        // Map orders and reviews to talent
        const ordersByTalent = new Map<string, any>();
        const reviewsByTalent = new Map<string, any>();
        
        allOrders?.forEach(order => {
          if (!ordersByTalent.has(order.talent_id)) {
            ordersByTalent.set(order.talent_id, order);
          }
        });
        
        allReviews?.forEach(review => {
          if (!reviewsByTalent.has(review.talent_id) && review.comment && review.comment.length > 20) {
            reviewsByTalent.set(review.talent_id, review);
          }
        });
        
        // Enhance talent with video and review data
        const enhancedTalent: TalentWithDetails[] = talentData.map(t => ({
          ...t,
          recent_video_url: ordersByTalent.get(t.id)?.video_url,
          recent_review: reviewsByTalent.get(t.id) ? {
            rating: reviewsByTalent.get(t.id).rating,
            comment: reviewsByTalent.get(t.id).comment,
          } : undefined,
        }));
        
        // Get curated talent for this occasion
        const curatedUsernames = OCCASION_TALENT_MAPPING[config.key] || [];
        const curatedTalent = curatedUsernames
          .map(username => enhancedTalent.find(t => t.username?.toLowerCase() === username.toLowerCase()))
          .filter(Boolean) as TalentWithDetails[];
        
        // Talent with orders for this specific occasion (priority)
        const talentWithOccasionOrders = new Set(occasionOrders?.map(o => o.talent_id) || []);
        const priorityTalent = curatedTalent.filter(t => talentWithOccasionOrders.has(t.id));
        const otherCurated = curatedTalent.filter(t => !talentWithOccasionOrders.has(t.id));
        
        // Featured: First 3 talent with occasion orders, then fill with curated
        const featured = [...priorityTalent.slice(0, 3), ...otherCurated.slice(0, 3 - priorityTalent.length)];
        setFeaturedTalent(featured.slice(0, 3));
        
        // More talent: Rest of curated + shuffled others
        const remaining = curatedTalent.filter(t => !featured.includes(t));
        const shuffledOthers = seededShuffle(
          enhancedTalent.filter(t => !curatedTalent.includes(t) && t.recent_video_url),
          config.key
        ).slice(0, 10);
        setMoreTalent([...remaining, ...shuffledOthers]);
        
        // Express talent
        const express = enhancedTalent.filter(t => t.express_delivery_enabled);
        setExpressTalent(seededShuffle(express, config.key + '-express'));
        
        // Example videos with reviews (from this occasion)
        const videosWithReviews: { video_url: string; review: any }[] = [];
        occasionOrders?.forEach(order => {
          if (order.video_url && videosWithReviews.length < 3) {
            // Find a review for this order or talent
            const review = allReviews?.find(r => r.order_id === order.id) || 
                          allReviews?.find(r => r.talent_id === order.talent_id);
            if (review && review.comment) {
              videosWithReviews.push({
                video_url: order.video_url,
                review: { rating: review.rating, comment: review.comment },
              });
            }
          }
        });
        
        // If not enough from this occasion, add from any occasion
        if (videosWithReviews.length < 3) {
          allOrders?.forEach(order => {
            if (order.video_url && videosWithReviews.length < 3) {
              const existing = videosWithReviews.find(v => v.video_url === order.video_url);
              if (!existing) {
                const review = allReviews?.find(r => r.order_id === order.id) || 
                              allReviews?.find(r => r.talent_id === order.talent_id);
                if (review && review.comment) {
                  videosWithReviews.push({
                    video_url: order.video_url,
                    review: { rating: review.rating, comment: review.comment },
                  });
                }
              }
            }
          });
        }
        
        setExampleVideos(videosWithReviews);
        
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [config.key]);

  const handleCTAClick = () => {
    // Scroll to featured talent or navigate to home with occasion filter
    navigate(`/?occasion=${config.key}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <>
      <SEOHelmet
        title={config.seoTitle}
        description={config.seoDescription}
      />
      
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Hero Section */}
        <section className="relative pt-8 pb-16 md:pt-16 md:pb-24 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-gray-900 to-gray-900 pointer-events-none" />
          
          <div className="relative max-w-6xl mx-auto px-4 md:px-8 text-center">
            {/* Occasion badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <span className="text-2xl">{config.emoji}</span>
              <span className="text-sm font-medium text-gray-200">{config.label} ShoutOut</span>
            </div>
            
            {/* Main headline */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
              {config.headline}
            </h1>
            
            {/* Rotating pain points */}
            <div className="h-8 md:h-10 mb-8 overflow-hidden">
              <p className="text-lg md:text-xl text-gray-300 transition-all duration-500">
                {config.painPoints[currentPainPointIndex]}
              </p>
            </div>
            
            {/* CTA Button */}
            <button
              onClick={handleCTAClick}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg shadow-red-600/30"
            >
              <GiftIcon className="w-6 h-6" />
              {config.ctaText}
            </button>
            
            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-yellow-400" />
                <span>4.9 avg rating</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-blue-400" />
                <span>24hr delivery available</span>
              </div>
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-purple-400" />
                <span>1000+ delivered</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Featured Talent Section */}
        {featuredTalent.length > 0 && (
          <section className="py-12 md:py-16">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                Perfect for {config.label} ShoutOuts
              </h2>
              <p className="text-gray-400 text-center mb-10">
                These creators have delivered amazing {config.label.toLowerCase()} messages
              </p>
              
              <div className="space-y-8">
                {featuredTalent.map((talent, index) => (
                  <TalentBannerCard
                    key={talent.id}
                    talent={talent as any}
                    videoOnRight={index % 2 === 1}
                    topCategories={talent.top_categories}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
        
        {/* More Talent Carousel */}
        {moreTalent.length > 0 && (
          <section className="py-12 bg-gray-900/50">
            <TalentCarousel
              talent={moreTalent}
              title={`More ${config.label} Talent`}
              subtitle="Explore more amazing creators"
            />
          </section>
        )}
        
        {/* Example Videos Section */}
        {exampleVideos.length > 0 && (
          <section className="py-16 md:py-20">
            <div className="max-w-6xl mx-auto px-4 md:px-8">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                See Real {config.label} ShoutOuts
              </h2>
              <p className="text-gray-400 text-center mb-10">
                Watch what others received and what they said
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {exampleVideos.map((item, index) => (
                  <VideoExampleCard
                    key={index}
                    videoUrl={item.video_url}
                    review={item.review}
                    occasionEmoji={config.emoji}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
        
        {/* 24-Hour Express Section */}
        {expressTalent.length > 0 && (
          <section className="py-16 md:py-20 bg-gradient-to-r from-yellow-900/20 via-orange-900/20 to-red-900/20">
            <div className="max-w-6xl mx-auto px-4 md:px-8">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full mb-4">
                  <BoltIcon className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-300">Express Delivery</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  {config.expressHeadline}
                </h2>
                <p className="text-gray-400">
                  These creators deliver within 24 hours
                </p>
              </div>
              
              <TalentCarousel
                talent={expressTalent.slice(0, 10)}
                title=""
              />
            </div>
          </section>
        )}
        
        {/* Final CTA Section */}
        <section className="py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {config.subheadline}
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              {config.painPoints[0]}
            </p>
            
            <button
              onClick={handleCTAClick}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-10 py-5 rounded-xl text-xl transition-all transform hover:scale-105 shadow-lg shadow-red-600/30"
            >
              <GiftIcon className="w-7 h-7" />
              {config.ctaText}
            </button>
            
            <p className="text-gray-500 text-sm mt-6">
              Satisfaction guaranteed • Secure payment • Fast delivery
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
