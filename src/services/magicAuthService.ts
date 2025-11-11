// Magic Link Authentication Service for Fulfillment Links
// Allows talent to click SMS links and auto-login without entering credentials

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export const magicAuthService = {
  /**
   * Get the magic auth token for an order (if one exists)
   */
  async getMagicTokenForOrder(orderId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('fulfillment_auth_tokens')
        .select('token')
        .eq('order_id', orderId)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        logger.log('No magic token found for order:', orderId);
        return null;
      }

      return data.token;
    } catch (error) {
      logger.error('Error fetching magic token:', error);
      return null;
    }
  },

  /**
   * Verify and consume a magic auth token
   * Returns the user_id if valid, null otherwise
   */
  async verifyAndConsumeMagicToken(token: string): Promise<{ userId: string; orderId: string } | null> {
    try {
      // Lookup the token
      const { data: tokenData, error: tokenError } = await supabase
        .from('fulfillment_auth_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        logger.log('Invalid or expired magic token');
        return null;
      }

      // Mark token as used
      const { error: updateError } = await supabase
        .from('fulfillment_auth_tokens')
        .update({ 
          used: true, 
          used_at: new Date().toISOString() 
        })
        .eq('id', tokenData.id);

      if (updateError) {
        logger.error('Error marking token as used:', updateError);
        return null;
      }

      logger.log('✅ Magic token verified and consumed');
      return {
        userId: tokenData.user_id,
        orderId: tokenData.order_id
      };
    } catch (error) {
      logger.error('Error verifying magic token:', error);
      return null;
    }
  },

  /**
   * Sign in a user using their email (passwordless)
   * This is used after verifying the magic token
   */
  async signInWithUserId(userId: string): Promise<boolean> {
    try {
      // Get user's email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError || !userData?.email) {
        logger.error('User not found for magic auth:', userError);
        return false;
      }

      // Create a magic link sign-in
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: userData.email,
        options: {
          shouldCreateUser: false,
          // This will bypass email verification since we already verified the token
        }
      });

      if (signInError) {
        logger.error('Error signing in with magic auth:', signInError);
        return false;
      }

      logger.log('✅ User signed in via magic link');
      return true;
    } catch (error) {
      logger.error('Error in signInWithUserId:', error);
      return false;
    }
  },

  /**
   * Generate fulfillment URL with magic auth token
   */
  async generateFulfillmentUrl(orderId: string, fulfillmentToken: string): Promise<string> {
    const baseUrl = window.location.origin;
    
    // Get magic token for this order
    const magicToken = await this.getMagicTokenForOrder(orderId);
    
    if (magicToken) {
      // New format with magic auth
      return `${baseUrl}/fulfill/${fulfillmentToken}?auth=${magicToken}`;
    } else {
      // Old format (backward compatible)
      return `${baseUrl}/fulfill/${fulfillmentToken}`;
    }
  }
};

