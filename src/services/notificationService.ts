// Notification Service for in-app notifications

import { supabase } from './supabase';
import { Notification } from '../types';
import { logger } from '../utils/logger';
import { magicAuthService } from './magicAuthService';

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
      logger.error('Error creating notification:', error);
      return false;
    }
  },

  // Talent notifications
  async notifyNewOrder(talentUserId: string, orderId: string, userName: string, amount: number): Promise<void> {
    logger.log('📢 Creating new order notification for talent:', { talentUserId, orderId, userName, amount });
    const result = await this.createNotification(
      talentUserId,
      'order_placed',
      '🎬 New Order Received!',
      `${userName} ordered a ShoutOut for $${amount.toFixed(2)}`,
      { order_id: orderId }
    );
    logger.log('📢 New order notification result:', result);

    // Check if SMS is enabled for this notification type
    await this.sendSMSIfEnabled('talent_new_order', talentUserId, orderId, {
      user_name: userName,
      amount: amount.toFixed(2)
    });
  },

  // Send SMS if enabled in settings
  async sendSMSIfEnabled(
    notificationType: string,
    userId: string,
    orderId: string,
    variables: Record<string, string>
  ): Promise<void> {
    try {
      // Check if SMS is enabled for this notification type
      const { data: setting } = await supabase
        .from('notification_settings')
        .select('sms_enabled, sms_template')
        .eq('notification_type', notificationType)
        .single();

      if (!setting || !setting.sms_enabled || !setting.sms_template) {
        logger.log(`SMS not enabled for ${notificationType}`);
        return;
      }

      // Get user details
      const { data: user } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', userId)
        .single();

      if (!user || !user.phone) {
        logger.log('User phone not found for SMS');
        return;
      }

      // Get order details and short link
      const { data: order } = await supabase
        .from('orders')
        .select('fulfillment_token')
        .eq('id', orderId)
        .single();

      // Build template variables
      const firstName = user.full_name?.split(' ')[0] || 'there';
      
      // Get short link for SMS (much shorter URLs!)
      let orderLink = `${window.location.origin}/dashboard?order=${orderId}`;
      if (order?.fulfillment_token) {
        try {
          // Check if a short link exists for this order
          const { data: shortLink } = await supabase
            .from('short_links')
            .select('short_code')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (shortLink?.short_code) {
            // Use short link: shoutout.us/s/ABC123
            orderLink = `${window.location.origin}/s/${shortLink.short_code}`;
            logger.log('✅ Using short link:', orderLink);
          } else {
            // Fallback to full URL with magic auth
            orderLink = await magicAuthService.generateFulfillmentUrl(orderId, order.fulfillment_token);
            logger.log('⚠️ No short link found, using full URL');
          }
        } catch (error) {
          logger.error('Error getting short link, using fallback:', error);
          orderLink = `${window.location.origin}/fulfill/${order.fulfillment_token}`;
        }
      }

      // Replace template variables
      let message = setting.sms_template;
      message = message.replace(/\{\{first_name\}\}/g, firstName);
      message = message.replace(/\{\{order_link\}\}/g, orderLink);
      message = message.replace(/\{\{user_name\}\}/g, variables.user_name || '');
      message = message.replace(/\{\{amount\}\}/g, variables.amount || '');
      message = message.replace(/\{\{talent_name\}\}/g, variables.talent_name || '');
      message = message.replace(/\{\{hours\}\}/g, variables.hours || '');

      // Determine recipient type based on notification type
      // talent_* notifications go to talent (217 number), user_* notifications go to users (659 number)
      const isTalentNotification = notificationType.startsWith('talent_');
      const recipientType = isTalentNotification ? 'talent' : 'user';

      // Send SMS via Twilio Edge Function
      const maskedPhone = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      logger.log('📱 Sending SMS to:', maskedPhone, 'recipientType:', recipientType);
      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: user.phone,
          message: message,
          recipientType: recipientType  // 'talent' uses 217, 'user' uses 659
        }
      });

      if (error) {
        logger.error('Error sending SMS:', error);
      } else {
        logger.log('✅ SMS sent successfully to:', maskedPhone);
      }
    } catch (error) {
      logger.error('Error in sendSMSIfEnabled:', error);
    }
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
    logger.log('📢 Creating order confirmed notification for user:', { userId, orderId, talentName });
    const result = await this.createNotification(
      userId,
      'order_placed',
      '✅ Order Confirmed',
      `Your ShoutOut from ${talentName} is confirmed and being created!`,
      { order_id: orderId }
    );
    logger.log('📢 Order confirmed notification result:', result);

    // Send SMS notification to user
    await this.sendSMSIfEnabled('user_order_placed', userId, orderId, {
      talent_name: talentName
    });
  },

  async notifyOrderApproved(userId: string, orderId: string, talentName: string): Promise<void> {
    logger.log('📢 Creating order approved notification for user:', { userId, orderId, talentName });
    
    // In-app notification
    const result = await this.createNotification(
      userId,
      'order_placed',
      '👍 Order Approved!',
      `Great news! ${talentName} approved your ShoutOut order and will start working on it soon.`,
      { order_id: orderId }
    );
    logger.log('📢 Order approved notification result:', result);

    // SMS notification
    await this.sendSMSIfEnabled('user_order_approved', userId, orderId, {
      talent_name: talentName
    });
  },

  async notifyOrderDelivered(userId: string, orderId: string, talentName: string): Promise<void> {
    logger.log('📢 Creating order delivered notification for user:', { userId, orderId, talentName });
    
    // In-app notification
    const result = await this.createNotification(
      userId,
      'order_fulfilled',
      '🎉 Your ShoutOut is Ready!',
      `${talentName} has completed your personalized video. Watch it now!`,
      { order_id: orderId }
    );
    logger.log('📢 Order delivered notification result:', result);

    // SMS notification
    await this.sendSMSIfEnabled('user_order_completed', userId, orderId, {
      talent_name: talentName
    });
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
      logger.error('Error marking notification as read:', error);
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
      logger.error('Error marking all as read:', error);
      return false;
    }
  }
};

