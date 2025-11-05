import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

export interface Order {
  id: string;
  user_id: string;
  talent_id: string;
  recipient_name: string;
  recipient_email: string;
  occasion: string;
  message: string;
  video_url?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  pricing: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch user's orders (customer view)
 * Cached for 2 minutes
 */
export function useUserOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          talent_profiles (
            temp_full_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch talent's orders (talent dashboard)
 * Cached for 1 minute (updates frequently)
 */
export function useTalentOrders(talentId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['orders', 'talent', talentId, { status }],
    queryFn: async () => {
      if (!talentId) throw new Error('Talent ID is required');

      let query = supabase
        .from('orders')
        .select('*')
        .eq('talent_id', talentId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!talentId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Fetch single order by ID
 * Cached for 2 minutes
 */
export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          talent_profiles (
            temp_full_name,
            username,
            avatar_url,
            pricing
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation to create new order
 * Automatically invalidates user orders cache
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: Partial<Order>) => {
      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;
      return data as Order;
    },
    onSuccess: (data) => {
      // Invalidate user's orders
      queryClient.invalidateQueries({ queryKey: ['orders', 'user', data.user_id] });
      // Invalidate talent's orders
      queryClient.invalidateQueries({ queryKey: ['orders', 'talent', data.talent_id] });
      
      toast.success('Order created successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order');
    },
  });
}

/**
 * Mutation to update order status
 * Used by talent to mark orders as complete
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      orderId, 
      status, 
      videoUrl 
    }: { 
      orderId: string; 
      status: string; 
      videoUrl?: string;
    }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (videoUrl) updates.video_url = videoUrl;

      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data as Order;
    },
    onSuccess: (data) => {
      // Invalidate specific order
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      // Invalidate user's orders
      queryClient.invalidateQueries({ queryKey: ['orders', 'user', data.user_id] });
      // Invalidate talent's orders
      queryClient.invalidateQueries({ queryKey: ['orders', 'talent', data.talent_id] });
      
      toast.success('Order updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order');
    },
  });
}

