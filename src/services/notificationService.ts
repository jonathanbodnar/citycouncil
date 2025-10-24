// Notification Service for in-app notifications

import { supabase } from './supabase';
import { Notification } from '../types';

export const notificationService = {
  // Create a new notification
  async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    metadata?: {
      order_id?: string;
      review_id?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type,
          title,
          message,
          is_read: false,
          ...metadata
        }]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  },

  // Talent notifications
  async notifyNewOrder(talentUserId: string, orderId: string, userName: string, amount: number): Promise<void> {
    await this.createNotification(
      talentUserId,
      'order_placed',
      '🎬 New Order Received!',
      `${userName} ordered a ShoutOut for $${amount.toFixed(2)}`,
      { order_id: orderId }
    );
  },

  async notifyOrderDeadlineApproaching(talentUserId: string, orderId: string, hoursLeft: number): Promise<void> {
    await this.createNotification(
      talentUserId,
      'order_late',
      '⏰ Order Deadline Approaching',
      `You have ${hoursLeft} hours left to complete this order`,
      { order_id: orderId }
    );
  },

  async notifyPromotionClaimed(talentUserId: string): Promise<void> {
    await this.createNotification(
      talentUserId,
      'profile_incomplete',
      '🎁 Promotion Package Claimed!',
      'You\'re now receiving $200/month in ad spend. Keep posting and tagging @shoutoutforus!'
    );
  },

  // User notifications
  async notifyOrderConfirmed(userId: string, orderId: string, talentName: string): Promise<void> {
    await this.createNotification(
      userId,
      'order_placed',
      '✅ Order Confirmed',
      `Your ShoutOut from ${talentName} is confirmed and being created!`,
      { order_id: orderId }
    );
  },

  async notifyOrderDelivered(userId: string, orderId: string, talentName: string): Promise<void> {
    await this.createNotification(
      userId,
      'order_fulfilled',
      '🎉 Your ShoutOut is Ready!',
      `${talentName} has completed your personalized video. Watch it now!`,
      { order_id: orderId }
    );
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  // Mark all as read for a user
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return false;
    }
  }
};

