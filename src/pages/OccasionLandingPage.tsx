import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import TalentCard from '../components/TalentCard';
import TalentBannerCard from '../components/TalentBannerCard';
import SEOHelmet from '../components/SEOHelmet';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PauseIcon, StarIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { GiftIcon, ClockIcon, SparklesIcon, ShieldCheckIcon, ArrowRightIcon, EnvelopeIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Suppress giveaway popup on occasion pages
const OCCASION_POPUP_SUPPRESSED_KEY = 'occasion_popup_suppressed';

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
  highlightedWord: string;
  subheadline: string;
  painPoints: string[];
  ctaText: string;
  expressHeadline: string;
  seoTitle: string;
  seoDescription: string;
  gradientFrom: string;
  gradientTo: string;
  highlightGradient: string;
}

// Configuration for each occasion with custom gradients
const OCCASION_CONFIGS: Record<string, OccasionConfig> = {
  birthday: {
    key: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    headline: "They won't remember a text.",
    highlightedWord: "They will remember this.",
    subheadline: "The birthday gift that gets replayed for years.",
    painPoints: [
      "When a 'Happy Birthday' text just isn't enough.",
      "People that really care send a Birthday ShoutOut.",
      "You'll never top last year's gift — unless you do this.",
      "The birthday gift that gets replayed for years.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Birthday tomorrow? We got you.",
    seoTitle: "Birthday ShoutOut | Personalized Video Birthday Messages",
    seoDescription: "Send an unforgettable birthday gift. Get a personalized video message from your favorite personalities. The gift they'll replay for years.",
    gradientFrom: 'from-pink-600/30',
    gradientTo: 'to-purple-600/20',
    highlightGradient: 'from-pink-400 via-rose-400 to-red-400',
  },
  roast: {
    key: 'roast',
    label: 'Friendly Roast',
    emoji: '🔥',
    headline: "Your group chat will never",
    highlightedWord: "recover from this.",
    subheadline: "A roast so good, they'll frame it.",
    painPoints: [
      "Your friend deserves to be absolutely destroyed.",
      "The roast that becomes a legendary inside joke.",
      "Some burns are too good for regular people to deliver.",
      "When you want to destroy them, but with love.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Need to roast someone by tomorrow?",
    seoTitle: "Friendly Roast ShoutOut | Personalized Roast Videos",
    seoDescription: "Order a hilarious personalized roast video. The perfect way to roast your friends with help from your favorite personalities.",
    gradientFrom: 'from-orange-600/30',
    gradientTo: 'to-red-600/20',
    highlightGradient: 'from-orange-400 via-red-400 to-rose-400',
  },
  encouragement: {
    key: 'encouragement',
    label: 'Encouragement',
    emoji: '💪',
    headline: "Sometimes they need to hear it",
    highlightedWord: "from someone else.",
    subheadline: "A pep talk that actually sticks.",
    painPoints: [
      "When your words aren't getting through.",
      "The encouragement they need, from someone they admire.",
      "A message that could change everything.",
      "Sometimes the right words need the right voice.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Big moment tomorrow? Get a pep talk today.",
    seoTitle: "Encouragement ShoutOut | Personalized Pep Talk Videos",
    seoDescription: "Send an inspiring personalized pep talk video. Help someone you love with encouragement from personalities they admire.",
    gradientFrom: 'from-emerald-600/30',
    gradientTo: 'to-teal-600/20',
    highlightGradient: 'from-emerald-400 via-teal-400 to-cyan-400',
  },
  advice: {
    key: 'advice',
    label: 'Get Advice',
    emoji: '💡',
    headline: "Get advice from people who've",
    highlightedWord: "actually been there.",
    subheadline: "Real wisdom from real experience.",
    painPoints: [
      "When you need more than a Google search.",
      "Advice from people who've walked the path.",
      "The guidance that could change your trajectory.",
      "Sometimes you need to hear it from the pros.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Need guidance fast?",
    seoTitle: "Get Advice ShoutOut | Personalized Advice Videos",
    seoDescription: "Get personalized advice from experts and personalities you trust. Real wisdom from real experience, delivered just for you.",
    gradientFrom: 'from-amber-600/30',
    gradientTo: 'to-yellow-600/20',
    highlightGradient: 'from-amber-400 via-yellow-400 to-orange-400',
  },
  celebrate: {
    key: 'celebrate',
    label: 'Celebrate a Win',
    emoji: '🏆',
    headline: "Make their win feel",
    highlightedWord: "even bigger.",
    subheadline: "The celebration they'll never forget.",
    painPoints: [
      "They achieved something huge. Celebrate it huge.",
      "A congratulations that actually matches the moment.",
      "Turn their win into an unforgettable memory.",
      "Some victories deserve more than a 'congrats' text.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Celebrate their win today.",
    seoTitle: "Celebration ShoutOut | Personalized Congratulations Videos",
    seoDescription: "Send an unforgettable congratulations video. Celebrate achievements with personalized messages from amazing personalities.",
    gradientFrom: 'from-yellow-600/30',
    gradientTo: 'to-amber-600/20',
    highlightGradient: 'from-yellow-400 via-amber-400 to-orange-400',
  },
  announcement: {
    key: 'announcement',
    label: 'Announcement',
    emoji: '📣',
    headline: "Make your announcement",
    highlightedWord: "unforgettable.",
    subheadline: "Big news deserves a big delivery.",
    painPoints: [
      "Some announcements need to be legendary.",
      "The reveal that everyone will talk about.",
      "When the news is too big for a text.",
      "Make it a moment they'll replay forever.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Big reveal coming up?",
    seoTitle: "Announcement ShoutOut | Personalized Announcement Videos",
    seoDescription: "Make your big announcement unforgettable with a personalized video message. Perfect for reveals, proposals, and life updates.",
    gradientFrom: 'from-blue-600/30',
    gradientTo: 'to-cyan-600/20',
    highlightGradient: 'from-blue-400 via-cyan-400 to-teal-400',
  },
  debate: {
    key: 'debate',
    label: 'End a Debate',
    emoji: '⚔️',
    headline: "End the debate.",
    highlightedWord: "Permanently.",
    subheadline: "Settle it with authority.",
    painPoints: [
      "When you need to prove you were right all along.",
      "End arguments with the ultimate trump card.",
      "They won't argue with this authority.",
      "Settle it once and for all.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Need to win this argument today?",
    seoTitle: "Settle a Debate ShoutOut | End Arguments with Authority",
    seoDescription: "End debates and settle arguments with personalized videos from authoritative voices. Prove your point once and for all.",
    gradientFrom: 'from-red-600/30',
    gradientTo: 'to-rose-600/20',
    highlightGradient: 'from-red-400 via-rose-400 to-pink-400',
  },
  corporate: {
    key: 'corporate',
    label: 'Corporate Event',
    emoji: '🏢',
    headline: "Make your event the one",
    highlightedWord: "they talk about.",
    subheadline: "Corporate entertainment that actually impresses.",
    painPoints: [
      "Boring events make boring impressions.",
      "The keynote surprise no one saw coming.",
      "Make your corporate event actually memorable.",
      "When PowerPoints just won't cut it.",
    ],
    ctaText: "Get a Personalized Video ShoutOut",
    expressHeadline: "Event coming up fast?",
    seoTitle: "Corporate Event ShoutOut | Business Video Messages",
    seoDescription: "Elevate your corporate event with personalized video messages. Perfect for team building, awards, and company celebrations.",
    gradientFrom: 'from-slate-600/30',
    gradientTo: 'to-gray-600/20',
    highlightGradient: 'from-slate-400 via-gray-400 to-zinc-400',
  },
};

// Curated talent for each occasion (by username) - removed jeremyherrell from birthday
const OCCASION_TALENT_MAPPING: Record<string, string[]> = {
  'birthday': ['shawnfarash', 'meloniemac', 'joshfirestine', 'lydiashaffer', 'thehodgetwins', 'elsakurt', 'jeremyhambly', 'kevinsorbo', 'kayleecampbell'],
  'roast': ['shawnfarash', 'hayleycaronia', 'joshfirestine', 'jpsears', 'thehodgetwins', 'bryancallen', 'nickdipaolo', 'elsakurt', 'esteepalti', 'pearldavis', 'lauraloomer', 'kaitlinbennett', 'mattiseman'],
  'announcement': ['shawnfarash', 'hayleycaronia', 'lydiashaffer', 'bryancallen', 'basrutten', 'nicksearcy', 'markdavis', 'larryelder', 'mattiseman'],
  'encouragement': ['meloniemac', 'hayleycaronia', 'jpsears', 'lydiashaffer', 'davidharrisjr', 'bryancallen', 'elsakurt', 'basrutten', 'gregonfire', 'nicksearcy', 'markdavis', 'larryelder', 'geraldmorgan', 'kevinsorbo', 'johnohurley'],
  'celebrate': ['joshfirestine', 'jpsears', 'jeremyhambly', 'basrutten', 'bradstine', 'gregonfire', 'chaelsonnen', 'lauraloomer', 'johnohurley', 'mattiseman'],
  'debate': ['davidharrisjr', 'nickdipaolo', 'bradstine', 'kayleecampbell', 'chaelsonnen', 'lauraloomer', 'pearldavis', 'geraldmorgan', 'kaitlinbennett', 'chrissalcedo'],
  'advice': ['meloniemac', 'thehodgetwins', 'davidharrisjr', 'nickdipaolo', 'bradstine', 'esteepalti', 'gregonfire', 'nicksearcy', 'chaelsonnen', 'markdavis', 'larryelder', 'pearldavis', 'geraldmorgan', 'kevinsorbo', 'kaitlinbennett', 'chrissalcedo', 'johnohurley'],
  'corporate': ['shawnfarash', 'meloniemac', 'bryancallen', 'basrutten', 'nicksearcy', 'kevinsorbo', 'johnohurley'],
};

// Comedians (includes those marked as Comedian or Impersonator)
const COMEDIAN_TALENT = ['jpsears', 'mattiseman', 'shawnfarash', 'elsakurt', 'esteepalti', 'joshfirestine', 'thehodgetwins', 'bryancallen', 'nickdipaolo'];

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

// Daily shuffle - changes based on current date
const dailyShuffle = <T,>(arr: T[], baseSeed: string): T[] => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return seededShuffle(arr, `${baseSeed}-${today}`);
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

  const hasOverflow = talent.length > 5;

  return (
    <div className="space-y-2">
      {title && (
        <div className="px-4 md:px-8 mb-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
        </div>
      )}
      
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-4 md:px-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {talent.map((t) => (
            <div key={t.id} className="flex-shrink-0" style={{ width: '140px' }}>
              <TalentCard talent={t as any} compact showExpressBadge={t.express_delivery_enabled} />
            </div>
          ))}
        </div>
        
        {/* Right fade gradient - matches home page */}
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
};

// Video example with review component - horizontal layout for mobile
const VideoExampleCard: React.FC<{
  videoUrl: string;
  review: { rating: number; comment: string; reviewer_name?: string };
  occasionEmoji: string;
  talentUsername?: string;
  talentName?: string;
}> = ({ videoUrl, review, occasionEmoji, talentUsername, talentName }) => {
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
    <div className="group relative">
      {/* Glow effect on hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition duration-500" />
      
      <div className="relative glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300">
        {/* Horizontal layout: video on left, content on right */}
        <div className="flex flex-row">
          {/* Video - smaller on mobile */}
          <div className="relative w-[120px] sm:w-[140px] flex-shrink-0">
            <div className="aspect-[9/16] h-full">
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
                className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full bg-white/95 flex items-center justify-center transition-all duration-300 shadow-lg ${isPlaying ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                  {isPlaying ? (
                    <PauseIcon className="w-5 h-5 text-gray-900" />
                  ) : (
                    <PlayIcon className="w-5 h-5 text-gray-900 ml-0.5" />
                  )}
                </div>
              </button>
            </div>
          </div>
          
          {/* Content - review and CTA */}
          <div className="flex-1 p-4 flex flex-col justify-between min-h-[200px]">
            {/* Badge */}
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                {occasionEmoji} Real ShoutOut
              </span>
            </div>
            
            {/* Stars */}
            <div className="flex items-center gap-0.5 mb-2">
              {[...Array(5)].map((_, i) => (
                <StarIcon key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-600'}`} />
              ))}
            </div>
            
            {/* Review */}
            <p className="text-gray-200 text-sm leading-relaxed line-clamp-3 flex-1 mb-3">
              "{review.comment}"
            </p>
            
            {/* CTA Button */}
            {talentUsername && (
              <Link
                to={`/${talentUsername}`}
                className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-all hover:scale-105"
              >
                <span>Order from {talentName || 'this personality'}</span>
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component
export default function OccasionLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Extract occasion from URL path (e.g., /birthday -> birthday)
  const occasion = location.pathname.replace('/', '').split('/')[0] || 'birthday';
  
  const [loading, setLoading] = useState(true);
  const [featuredTalent, setFeaturedTalent] = useState<TalentWithDetails[]>([]);
  const [middleBannerTalent, setMiddleBannerTalent] = useState<TalentWithDetails | null>(null);
  const [comedianTalent, setComedianTalent] = useState<TalentWithDetails[]>([]);
  const [moreTalent, setMoreTalent] = useState<TalentWithDetails[]>([]);
  const [expressTalent, setExpressTalent] = useState<TalentWithDetails[]>([]);
  const [exampleVideos, setExampleVideos] = useState<{ video_url: string; review: any; talent_username?: string; talent_name?: string }[]>([]);
  const [currentPainPointIndex, setCurrentPainPointIndex] = useState(0);
  
  // Email/Phone capture state
  const [captureStep, setCaptureStep] = useState<'email' | 'phone' | 'complete'>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  
  // Ref for scrolling to banner cards
  const bannerCardsRef = useRef<HTMLElement>(null);
  
  const config = OCCASION_CONFIGS[occasion || 'birthday'] || OCCASION_CONFIGS.birthday;
  
  // Check if discount already applied (from previous visit or giveaway popup)
  useEffect(() => {
    const existingCoupon = localStorage.getItem('auto_apply_coupon');
    const submitted = localStorage.getItem('holiday_promo_submitted');
    if (existingCoupon || submitted === 'true') {
      setDiscountApplied(true);
      setCaptureStep('complete');
    }
  }, []);
  
  // Suppress giveaway popup on occasion pages
  useEffect(() => {
    // Mark that popup should be suppressed while on this page
    sessionStorage.setItem(OCCASION_POPUP_SUPPRESSED_KEY, 'true');
    return () => {
      sessionStorage.removeItem(OCCASION_POPUP_SUPPRESSED_KEY);
    };
  }, []);
  
  // Mouse tracking for gradient effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
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
        
        // Create talent lookup map
        const talentLookup = new Map(talentData.map(t => [t.id, t]));
        
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
        
        // Shuffle curated talent daily for featured section
        const shuffledCurated = dailyShuffle(curatedTalent, `featured-${config.key}`);
        
        // Featured: First 3 from shuffled curated WHO HAVE REVIEWS (same as home page)
        const talentWithReviews = shuffledCurated.filter(t => t.recent_review);
        const featured = talentWithReviews.slice(0, 3);
        setFeaturedTalent(featured);
        
        // Middle banner: 4th talent with reviews (shows between comedians and unforgettable carousel)
        const middleBanner = talentWithReviews[3] || null;
        setMiddleBannerTalent(middleBanner);
        
        // Get talent IDs used in featured and middle banner
        const featuredIds = new Set(featured.map(t => t.id));
        if (middleBanner) featuredIds.add(middleBanner.id);
        
        // Build comedian list (only show comedians section for birthday)
        const comedians = COMEDIAN_TALENT
          .map(username => enhancedTalent.find(t => t.username?.toLowerCase() === username.toLowerCase()))
          .filter((t): t is TalentWithDetails => t !== undefined && t.users !== undefined);
        const comedianIds = new Set(comedians.map(t => t.id));
        
        // Only set comedians for birthday page
        if (config.key === 'birthday') {
          setComedianTalent(dailyShuffle(comedians, `comedians-${config.key}`));
        } else {
          setComedianTalent([]);
        }
        
        // Example videos with reviews - collect all valid ones first
        const allVideosWithReviews: { video_url: string; review: any; talent_id: string; talent_username?: string; talent_name?: string }[] = [];
        const usedTalentIds = new Set<string>();
        
        // First try occasion-specific orders
        occasionOrders?.forEach(order => {
          if (order.video_url && !usedTalentIds.has(order.talent_id)) {
            const review = allReviews?.find(r => r.order_id === order.id) || 
                          allReviews?.find(r => r.talent_id === order.talent_id);
            if (review && review.comment) {
              const talent = talentLookup.get(order.talent_id);
              allVideosWithReviews.push({
                video_url: order.video_url,
                review: { rating: review.rating, comment: review.comment },
                talent_id: order.talent_id,
                talent_username: talent?.username,
                talent_name: talent?.temp_full_name || talent?.users?.full_name,
              });
              usedTalentIds.add(order.talent_id);
            }
          }
        });
        
        // Then add from any occasion
        allOrders?.forEach(order => {
          if (order.video_url && !usedTalentIds.has(order.talent_id)) {
            const review = allReviews?.find(r => r.order_id === order.id) || 
                          allReviews?.find(r => r.talent_id === order.talent_id);
            if (review && review.comment) {
              const talent = talentLookup.get(order.talent_id);
              allVideosWithReviews.push({
                video_url: order.video_url,
                review: { rating: review.rating, comment: review.comment },
                talent_id: order.talent_id,
                talent_username: talent?.username,
                talent_name: talent?.temp_full_name || talent?.users?.full_name,
              });
              usedTalentIds.add(order.talent_id);
            }
          }
        });
        
        // Shuffle and pick 3 for display (cycling daily)
        const shuffledVideos = dailyShuffle(allVideosWithReviews, `videos-${config.key}`);
        const displayVideos = shuffledVideos.slice(0, 3);
        setExampleVideos(displayVideos);
        
        // Get IDs used in videos
        const videoTalentIds = new Set(displayVideos.map(v => v.talent_id));
        
        // Track all talent that are already shown somewhere
        const shownTalentIds = new Set([
          ...Array.from(featuredIds),
          ...Array.from(videoTalentIds),
          ...(config.key === 'birthday' ? Array.from(comedianIds) : [])
        ]);
        
        // More talent: ALL active talent not already shown in featured, videos, or comedians
        // This ensures everyone is accounted for somewhere on the page
        const moreTalentList = dailyShuffle(
          enhancedTalent.filter(t => 
            t.users && 
            !shownTalentIds.has(t.id)
          ),
          `more-${config.key}`
        );
        setMoreTalent(moreTalentList);
        
        // Express talent
        const express = enhancedTalent.filter(t => t.express_delivery_enabled);
        setExpressTalent(dailyShuffle(express, `express-${config.key}`));
        
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [config.key]);

  const handleCTAClick = () => {
    // Scroll to banner cards section
    if (bannerCardsRef.current) {
      bannerCardsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Email validation
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Phone number formatting
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  // Get UTM source
  const getUtmSource = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUtm = urlParams.get('utm') || urlParams.get('umt');
    const storedUtm = localStorage.getItem('promo_source_global');
    return urlUtm || storedUtm || null;
  };

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setSubmitting(true);
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Check if user exists with phone on file
      const { data: existingUser } = await supabase
        .from('users')
        .select('phone')
        .eq('email', normalizedEmail)
        .single();
      
      if (existingUser?.phone) {
        // User has phone on file - apply discount and complete!
        setPhoneNumber(existingUser.phone);
        await applyDiscount(normalizedEmail, existingUser.phone);
      } else {
        // Capture email + utm as lead
        fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: normalizedEmail,
            source: `occasion_${occasion}`,
            utm_source: getUtmSource(),
          }),
        }).catch(err => console.log('Email capture note:', err.message));
        
        // Need phone - go to phone step
        setCaptureStep('phone');
      }
    } catch {
      // No user found or error - go to phone step
      fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          source: `occasion_${occasion}`,
          utm_source: getUtmSource(),
        }),
      }).catch(err => console.log('Email capture note:', err.message));
      
      setCaptureStep('phone');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle phone submission
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const digits = phoneNumber.replace(/\D/g, '');
    let cleanDigits = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
      cleanDigits = digits.slice(1);
    }
    
    if (cleanDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setSubmitting(true);
    const formattedPhone = `+1${cleanDigits}`;
    const normalizedEmail = email.toLowerCase().trim();
    
    await applyDiscount(normalizedEmail, formattedPhone);
  };

  // Apply discount after email/phone capture
  const applyDiscount = async (normalizedEmail: string, formattedPhone: string) => {
    try {
      const utmSource = getUtmSource();
      
      // Capture as a user (with both email and phone)
      await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/capture-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          phone: formattedPhone,
          source: `occasion_${occasion}`,
          utm_source: utmSource,
        }),
      });

      // Save to beta_signups
      await supabase.from('beta_signups').upsert({
        phone_number: formattedPhone,
        source: `occasion_${occasion}`,
        utm_source: utmSource,
        subscribed_at: new Date().toISOString(),
        prize_won: '10_OFF'
      }, { onConflict: 'phone_number', ignoreDuplicates: false });

      // Send discount SMS
      try {
        await supabase.functions.invoke('send-sms', {
          body: {
            to: formattedPhone,
            message: `🎁 Here's your 10% off! Use code SAVE10 at checkout: https://shoutout.us/${occasion}?utm=sms&coupon=SAVE10`,
            useUserNumber: true
          }
        });
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
      }

      // Apply discount locally
      localStorage.setItem('auto_apply_coupon', 'SAVE10');
      localStorage.setItem('holiday_promo_submitted', 'true');
      
      // Dispatch events to update prices
      window.dispatchEvent(new Event('couponApplied'));
      window.dispatchEvent(new Event('storage'));

      toast.success('10% discount applied! Check your phone for the code.');
      setDiscountApplied(true);
      setCaptureStep('complete');
      
      // Scroll to banner cards after short delay
      setTimeout(() => {
        if (bannerCardsRef.current) {
          bannerCardsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      
      <div className="min-h-screen overflow-hidden relative">
        {/* Dynamic cursor gradient */}
        <div 
          className="fixed inset-0 pointer-events-none z-0 opacity-30"
          style={{
            background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(239, 68, 68, 0.15), transparent 40%)`
          }}
        />

        {/* Hero Section */}
        <section className="relative pt-8 pb-12 sm:pt-12 sm:pb-16">
          {/* Animated gradient mesh */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-0 -left-40 w-[500px] h-[500px] bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} rounded-full blur-[120px] animate-pulse`} />
            <div className="absolute top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-r from-red-600/20 to-orange-600/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-gradient-to-r from-purple-600/15 to-pink-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
          
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Occasion badge */}
            <div className="inline-flex items-center gap-2 glass px-5 py-2.5 rounded-full border border-white/20 mb-8 hover:scale-105 transition-transform">
              <span className="text-2xl">{config.emoji}</span>
              <span className="font-semibold text-white">{config.label} ShoutOut</span>
            </div>
            
            {/* Main headline - matching /creators style */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
              {config.headline}{' '}
              <span className="relative inline-block">
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${config.highlightGradient}`}>
                  {config.highlightedWord}
                </span>
                <svg className="absolute -bottom-1 sm:-bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M2 6C50 2 150 2 198 6" stroke="url(#underline-gradient)" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                      <stop stopColor="#f87171"/>
                      <stop offset="0.5" stopColor="#fb923c"/>
                      <stop offset="1" stopColor="#fbbf24"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            
            {/* Rotating pain points */}
            <div className="h-8 md:h-10 mb-8 overflow-hidden">
              <p 
                key={currentPainPointIndex}
                className="text-lg md:text-xl text-gray-300 animate-fade-in"
              >
                {config.painPoints[currentPainPointIndex]}
              </p>
            </div>
            
            {/* Email/Phone Capture Form or CTA Button */}
            <div className="max-w-md mx-auto mb-8">
              {captureStep === 'email' && (
                <form onSubmit={handleEmailSubmit} className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition duration-300" />
                  <div className="relative flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        autoComplete="email"
                        className="w-full pl-12 pr-4 py-4 rounded-xl text-base font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none bg-white/95 text-gray-900"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-6 py-4 rounded-xl text-base transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {submitting ? 'Checking...' : 'Get 10% Off Today'}
                    </button>
                  </div>
                </form>
              )}
              
              {captureStep === 'phone' && (
                <form onSubmit={handlePhoneSubmit} className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur-lg opacity-40" />
                  <div className="relative">
                    <p className="text-white/80 text-sm mb-3">One last step - where should we send your code?</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <DevicePhoneMobileIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                          placeholder="(555) 555-5555"
                          autoComplete="tel"
                          autoFocus
                          className="w-full pl-12 pr-4 py-4 rounded-xl text-base font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none bg-white/95 text-gray-900"
                          maxLength={14}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-6 py-4 rounded-xl text-base transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {submitting ? 'Applying...' : 'Get My 10% Off'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
              
              {captureStep === 'complete' && (
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition duration-300" />
                  <button
                    onClick={handleCTAClick}
                    className="relative w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all transform hover:scale-105"
                  >
                    <GiftIcon className="w-6 h-6" />
                    {discountApplied ? 'Find Your Perfect ShoutOut (10% Off Applied!)' : config.ctaText}
                  </button>
                </div>
              )}
            </div>
            
            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              {[
                { icon: StarIcon, label: '4.9 avg rating', color: 'text-yellow-400' },
                { icon: ClockIcon, label: '24hr delivery', color: 'text-cyan-400' },
                { icon: ShieldCheckIcon, label: 'Satisfaction guaranteed', color: 'text-emerald-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Featured Talent Section */}
        {featuredTalent.length > 0 && (
          <section ref={bannerCardsRef} className="relative py-8 md:py-12 scroll-mt-4">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                  Personalities For The Perfect{' '}
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${config.highlightGradient}`}>
                    {config.label} Gift
                  </span>
                </h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                  These personalities have 5 star reviews from people like you!
                </p>
              </div>
              
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
        
        {/* Comedians Carousel - Only show on birthday page */}
        {comedianTalent.length > 0 && (
          <section className="py-6 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent" />
            <div className="relative">
              <TalentCarousel
                talent={comedianTalent}
                title="Say happy birthday with a laugh from free-speech comedians."
              />
            </div>
          </section>
        )}
        
        {/* Middle Banner Card - Between comedians and unforgettable carousel */}
        {middleBannerTalent && (
          <section className="py-6 relative">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <TalentBannerCard
                talent={middleBannerTalent as any}
                videoOnRight={true}
                topCategories={middleBannerTalent.top_categories}
              />
            </div>
          </section>
        )}
        
        {/* More Talent Carousel */}
        {moreTalent.length > 0 && (
          <section className="py-6 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/50 to-transparent" />
            <div className="relative">
              <TalentCarousel
                talent={moreTalent}
                title="Unforgettable personalities for an unforgettable gift."
              />
            </div>
          </section>
        )}
        
        {/* Example Videos Section */}
        {exampleVideos.length > 0 && (
          <section className="py-8 md:py-12 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-red-500/10 via-orange-500/5 to-yellow-500/10 rounded-full blur-[100px]" />
            
            <div className="relative max-w-6xl mx-auto px-4 md:px-8">
              <div className="text-center mb-10">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                  See What Others Received
                </h2>
                <p className="text-gray-400 text-lg">
                  Real ShoutOuts from real personalities
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {exampleVideos.map((item, index) => (
                  <VideoExampleCard
                    key={index}
                    videoUrl={item.video_url}
                    review={item.review}
                    occasionEmoji={config.emoji}
                    talentUsername={item.talent_username}
                    talentName={item.talent_name}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
        
        {/* 24-Hour Express Section */}
        {expressTalent.length > 0 && (
          <section className="py-10 md:py-12 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-900/10 via-orange-900/20 to-red-900/10" />
            
            <div className="relative max-w-7xl mx-auto px-4 md:px-8">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full border border-yellow-500/30 mb-6">
                  <BoltIcon className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold text-yellow-300">Express Delivery</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                  {config.expressHeadline}
                </h2>
                <p className="text-gray-400 text-lg">
                  These personalities deliver within 24 hours
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
        <section className="py-10 md:py-16 relative">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-emerald-600/20 to-teal-600/20 rounded-full blur-[120px]" />
          </div>
          
          <div className="relative max-w-4xl mx-auto px-4 md:px-8 text-center">
            {/* Info box */}
            <div className="relative group mb-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-cyan-500/50 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition duration-500" />
              <div className="relative glass rounded-2xl p-8 border border-white/20">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  {config.subheadline}
                </h2>
                <p className="text-lg text-gray-300 mb-6">
                  {config.painPoints[0]}
                </p>
                
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                  {['Personalized', 'Authentic', 'Memorable'].map((tag) => (
                    <span key={tag} className="flex items-center gap-1.5 text-emerald-400 text-sm">
                      <CheckCircleIcon className="w-4 h-4" />
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="relative inline-block group/btn">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur-lg opacity-50 group-hover/btn:opacity-75 transition duration-300" />
                  <button
                    onClick={handleCTAClick}
                    className="relative inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-10 py-5 rounded-xl text-xl transition-all transform hover:scale-105"
                  >
                    <GiftIcon className="w-7 h-7" />
                    {discountApplied ? 'Find Your Perfect ShoutOut (10% Off!)' : config.ctaText}
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-gray-500 text-sm">
              Satisfaction guaranteed • Secure payment • Fast delivery
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
