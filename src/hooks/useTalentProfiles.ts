import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import toast from 'react-hot-toast';

/**
 * Fetch all active talent profiles
 * Cached for 5 minutes, perfect for homepage
 */
export function useTalentProfiles(category?: string) {
  return useQuery({
    queryKey: ['talents', { category }],
    queryFn: async () => {
      let query = supabase
        .from('talent_profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TalentProfile[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch featured talent profiles
 * Cached for 5 minutes, used on homepage
 */
export function useFeaturedTalents() {
  return useQuery({
    queryKey: ['talents', 'featured'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('featured_order', { ascending: true });

      if (error) throw error;
      return data as TalentProfile[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single talent profile by ID
 * Cached for 10 minutes
 */
export function useTalentProfile(talentId: string | undefined) {
  return useQuery({
    queryKey: ['talent', talentId],
    queryFn: async () => {
      if (!talentId) throw new Error('Talent ID is required');

      const { data, error } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('id', talentId)
        .single();

      if (error) throw error;
      return data as TalentProfile;
    },
    enabled: !!talentId, // Only run if talentId exists
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch talent profile by username
 * Cached for 10 minutes
 */
export function useTalentByUsername(username: string | undefined) {
  return useQuery({
    queryKey: ['talent', 'username', username],
    queryFn: async () => {
      if (!username) throw new Error('Username is required');

      const { data, error } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (error) throw error;
      return data as TalentProfile;
    },
    enabled: !!username,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Mutation to update talent profile
 * Automatically invalidates related queries
 */
export function useUpdateTalentProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TalentProfile> }) => {
      const { data, error } = await supabase
        .from('talent_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TalentProfile;
    },
    onSuccess: (data) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['talent', data.id] });
      queryClient.invalidateQueries({ queryKey: ['talent', 'username', data.username] });
      queryClient.invalidateQueries({ queryKey: ['talents'] });
      
      toast.success('Profile updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    },
  });
}

/**
 * Get talent profile stats (orders, reviews, etc.)
 * Cached for 2 minutes as it changes more frequently
 */
export function useTalentStats(talentId: string | undefined) {
  return useQuery({
    queryKey: ['talent', talentId, 'stats'],
    queryFn: async () => {
      if (!talentId) throw new Error('Talent ID is required');

      // Fetch orders count
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('talent_id', talentId);

      // Fetch completed orders count
      const { count: completedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('talent_id', talentId)
        .eq('status', 'completed');

      // Fetch reviews count and average rating
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('talent_id', talentId);

      const avgRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      return {
        totalOrders: ordersCount || 0,
        completedOrders: completedCount || 0,
        reviewsCount: reviews?.length || 0,
        averageRating: avgRating,
      };
    },
    enabled: !!talentId,
    staleTime: 2 * 60 * 1000, // 2 minutes (stats change more frequently)
  });
}

