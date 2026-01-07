import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarIcon } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  users: {
    full_name: string;
  };
  talent_profiles?: {
    temp_full_name: string;
    username: string;
    id: string;
  };
}

interface FOMONotificationProps {
  /** Interval in ms between notifications (default: 8000ms = 8 seconds) */
  interval?: number;
}

const FOMONotification: React.FC<FOMONotificationProps> = ({ interval = 8000 }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const [usedReviewIds, setUsedReviewIds] = useState<Set<string>>(new Set());

  // Fetch real reviews on mount
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at,
            users!reviews_user_id_fkey (
              full_name
            ),
            talent_profiles!reviews_talent_id_fkey (
              id,
              temp_full_name,
              username
            )
          `)
          .gte('rating', 4) // Only show 4-5 star reviews
          .not('comment', 'is', null) // Only reviews with comments
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        
        // Filter reviews with actual comment content
        const validReviews = (data || []).filter(
          (r: any) => r.comment && r.comment.trim().length > 10
        ) as unknown as Review[];
        
        setReviews(validReviews);
      } catch (error) {
        console.error('Error fetching reviews for FOMO:', error);
      }
    };

    fetchReviews();
  }, []);

  useEffect(() => {
    if (reviews.length === 0) return;

    let recurringTimer: NodeJS.Timeout | null = null;

    // Get a random review that hasn't been shown yet
    const getRandomUnusedReview = (): Review | null => {
      const availableReviews = reviews.filter(r => !usedReviewIds.has(r.id));
      
      // If all reviews have been shown, reset
      if (availableReviews.length === 0) {
        setUsedReviewIds(new Set());
        return reviews[Math.floor(Math.random() * reviews.length)];
      }
      
      return availableReviews[Math.floor(Math.random() * availableReviews.length)];
    };

    const showReview = () => {
      const review = getRandomUnusedReview();
      if (review) {
        setCurrentReview(review);
        setUsedReviewIds(prev => new Set(Array.from(prev).concat(review.id)));
        setVisible(true);

        // Hide after 5 seconds
        setTimeout(() => {
          setVisible(false);
        }, 5000);
      }
    };

    // Show first notification after a short delay (3-5 seconds after page load)
    const initialDelay = 3000 + Math.random() * 2000;
    
    const initialTimer = setTimeout(() => {
      showReview();
      
      // Start recurring timer AFTER the first one shows
      recurringTimer = setInterval(showReview, interval);
    }, initialDelay);

    return () => {
      clearTimeout(initialTimer);
      if (recurringTimer) {
        clearInterval(recurringTimer);
      }
    };
  }, [interval, reviews]);

  // Truncate comment to first ~80 characters
  const truncateComment = (comment: string): string => {
    if (comment.length <= 80) return comment;
    return comment.substring(0, 80).trim() + '...';
  };

  // Get first name only for privacy
  const getFirstName = (fullName: string): string => {
    return fullName?.split(' ')[0] || 'Customer';
  };

  // Handle click to navigate to talent profile
  const handleClick = () => {
    if (!currentReview?.talent_profiles) return;
    
    const talent = currentReview.talent_profiles as any;
    const profileUrl = talent.username ? `/${talent.username}` : `/talent/${talent.id}`;
    navigate(profileUrl);
    setVisible(false);
  };

  if (!currentReview) return null;

  return (
    <div
      className={`fixed right-4 left-4 sm:left-auto sm:right-6 z-[60] transition-all duration-500 ease-in-out transform ${
        visible 
          ? 'translate-y-0 opacity-100' 
          : 'translate-y-4 opacity-0 pointer-events-none'
      }`}
      style={{
        bottom: window.innerWidth < 768 ? '100px' : '24px',
        maxWidth: '320px'
      }}
    >
      <div 
        className="glass-strong rounded-xl px-4 py-3 shadow-modern-lg border border-white/30 backdrop-blur-xl cursor-pointer hover:border-white/50 transition-colors"
        onClick={handleClick}
      >
        {/* Header with stars and name */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <StarIcon
                key={i}
                className={`h-4 w-4 ${
                  i < currentReview.rating ? 'text-yellow-400' : 'text-gray-500'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {getFirstName((currentReview.users as any)?.full_name || 'Customer')}
          </span>
        </div>
        
        {/* Review comment */}
        <p className="text-sm text-white/90 leading-snug">
          "{truncateComment(currentReview.comment)}"
        </p>
        
        {/* Talent name if available */}
        {(currentReview.talent_profiles as any)?.temp_full_name && (
          <p className="text-xs text-blue-400 mt-2 hover:text-blue-300">
            Review for {(currentReview.talent_profiles as any).temp_full_name} →
          </p>
        )}
      </div>
    </div>
  );
};

export default FOMONotification;
