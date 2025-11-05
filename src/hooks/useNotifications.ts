import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'order' | 'review' | 'system' | 'payment';
  is_read: boolean;
  created_at: string;
  related_order_id?: string;
}

/**
 * Fetch user's notifications
 * Cached for 30 seconds (updates frequently)
 */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to recent 50 notifications

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  });
}

/**
 * Fetch unread notifications count
 * Cached for 30 seconds, used for badge
 */
export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId, 'unread-count'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  });
}

/**
 * Mutation to mark notification as read
 * Automatically updates cache
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data as Notification;
    },
    onSuccess: (data) => {
      // Update notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications', data.user_id] });
      // Update unread count
      queryClient.invalidateQueries({ queryKey: ['notifications', data.user_id, 'unread-count'] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark notification as read:', error);
    },
  });
}

/**
 * Mutation to mark all notifications as read
 * Batch operation
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      // Update notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      // Update unread count
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'unread-count'] });
      
      toast.success('All notifications marked as read');
    },
    onError: (error: Error) => {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    },
  });
}

