import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';
import toast from 'react-hot-toast';

interface ReviewFormData {
  rating: number;
  comment: string;
}

interface OrderWithTalent extends Order {
  talent_profiles: {
    users: {
      full_name: string;
      avatar_url?: string;
    };
  };
}

const ReviewPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithTalent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ReviewFormData>();

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          talent_profiles!orders_talent_id_fkey (
            users!talent_profiles_user_id_fkey (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Order not found or not eligible for review');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ReviewFormData) => {
    // Early validation checks
    if (!order || selectedRating === 0) {
      toast.error('Please select a rating');
      return;
    }

    // Prevent double submissions
    if (submitting) {
      console.log('Review already submitting, ignoring duplicate click');
      return;
    }

    setSubmitting(true);
    console.log('Submitting review:', { orderId: order.id, rating: selectedRating });
    
    try {
      const { error } = await supabase
        .from('reviews')
        .insert([
          {
            order_id: order.id,
            user_id: user?.id,
            talent_id: order.talent_id,
            rating: selectedRating,
            comment: data.comment?.trim() || null,
          },
        ]);

      if (error) {
        console.error('Review submission error:', error);
        throw error;
      }

      // Update talent's average rating
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('talent_id', order.talent_id);
      
      if (allReviews && allReviews.length > 0) {
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await supabase
          .from('talent_profiles')
          .update({ average_rating: Math.round(avgRating * 100) / 100 })
          .eq('id', order.talent_id);
      }

      console.log('Review submitted successfully');
      toast.success('Review submitted successfully!');
      
      // Small delay before navigation to ensure toast is visible
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (error: any) {
      console.error('Review error:', error);
      if (error.code === '23505') {
        toast.error('You have already reviewed this order');
      } else {
        toast.error('Failed to submit review. Please try again.');
      }
      setSubmitting(false); // Only reset on error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Order Not Found</h1>
          <p className="text-gray-600">This order is not eligible for review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leave a Review</h1>
        <p className="text-gray-600">
          Share your experience with {order.talent_profiles.users.full_name}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Order Summary */}
        <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-gray-200">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            {order.talent_profiles.users.avatar_url ? (
              <img
                src={order.talent_profiles.users.avatar_url}
                alt={order.talent_profiles.users.full_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-primary-600">
                {order.talent_profiles.users.full_name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {order.talent_profiles.users.full_name}
            </h3>
            <p className="text-sm text-gray-600">
              Order completed on {new Date(order.updated_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500">
              ${order.amount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Review Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How would you rate your ShoutOut? *
            </label>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  {star <= (hoverRating || selectedRating) ? (
                    <StarIcon className="h-8 w-8 text-yellow-400" />
                  ) : (
                    <StarOutline className="h-8 w-8 text-gray-300" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {selectedRating === 0 && 'Click to rate'}
              {selectedRating === 1 && 'Poor'}
              {selectedRating === 2 && 'Fair'}
              {selectedRating === 3 && 'Good'}
              {selectedRating === 4 && 'Very Good'}
              {selectedRating === 5 && 'Excellent'}
            </p>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Write a review (optional)
            </label>
            <textarea
              id="comment"
              rows={4}
              {...register('comment')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Tell others about your experience with this ShoutOut..."
            />
          </div>

          {/* Submit */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-300"
            >
              Skip Review
            </button>
            <button
              type="submit"
              disabled={submitting || selectedRating === 0}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewPage;
