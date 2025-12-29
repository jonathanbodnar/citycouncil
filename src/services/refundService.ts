import { supabase } from './supabase';
import { emailService } from './emailService';
import { notificationService } from './notificationService';
import { logger } from '../utils/logger';

export interface RefundRequest {
  orderId: string;
  transactionId: string;
  amount?: number; // Optional - full refund if not provided
  reason: string;
  deniedBy: 'admin' | 'talent';
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

class RefundService {
  /**
   * Process a refund through Fortis and update order status
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      // Step 1: Validate reason is provided
      if (!request.reason || request.reason.trim().length === 0) {
        throw new Error('Denial reason is required');
      }

      // Step 1.5: Check if this is a demo order (no real payment, skip refund)
      const isDemoOrder = request.transactionId?.startsWith('DEMO_ORDER_');
      let refundData = null;

      if (isDemoOrder) {
        logger.log('Skipping refund for demo order:', request.orderId);
        refundData = {
          success: true,
          refund_id: null,
          refund_amount: 0,
          is_demo: true,
        };
      } else {
        // Step 2: Process refund via Fortis Edge Function (real orders only)
        logger.log('Processing Fortis refund:', request);
        const { data: fortisData, error: refundError } = await supabase.functions.invoke('fortis-refund', {
          body: {
            transaction_id: request.transactionId,
            amount: request.amount,
            reason: request.reason,
          },
        });

        if (refundError || !fortisData?.success) {
          throw new Error(refundError?.message || fortisData?.error || 'Refund failed');
        }

        refundData = fortisData;
        logger.log('Fortis refund successful:', refundData);
      }

      // Step 3: Update order status to 'denied'
      logger.log('Updating order status to denied for order:', request.orderId);
      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'denied',
          denial_reason: request.reason,
          denied_by: request.deniedBy,
          denied_at: new Date().toISOString(),
          refund_id: refundData.refund_id,
          refund_amount: refundData.refund_amount,
        })
        .eq('id', request.orderId)
        .select();

      logger.log('Order update result:', { updateData, updateError });

      if (updateError) {
        logger.error('Failed to update order status:', updateError);
        throw new Error('Refund processed but failed to update order status');
      }

      if (!updateData || updateData.length === 0) {
        logger.error('Order not found or not updated:', request.orderId);
        throw new Error('Order not found or update failed');
      }

      logger.log('Order status updated successfully to denied');

      // Step 4: Get order details for notifications
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          users!orders_user_id_fkey (
            id,
            email,
            full_name
          ),
          talent_profiles!orders_talent_id_fkey (
            users!talent_profiles_user_id_fkey (
              full_name
            )
          )
        `)
        .eq('id', request.orderId)
        .single();

      if (orderError || !order) {
        logger.warn('Could not fetch order for notifications:', orderError);
        // Don't fail the refund if notification fails
        return {
          success: true,
          refundId: refundData.refund_id,
        };
      }

      // Step 5: Send notifications to customer
      await this.sendDenialNotifications(order, request.reason, request.deniedBy);

      return {
        success: true,
        refundId: refundData.refund_id,
      };
    } catch (error: any) {
      logger.error('Refund service error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process refund',
      };
    }
  }

  /**
   * Send denial notifications (in-app + email)
   */
  private async sendDenialNotifications(order: any, reason: string, deniedBy: 'admin' | 'talent') {
    try {
      const customerUserId = order.users.id;
      const customerEmail = order.users.email;
      const customerName = order.users.full_name;
      const talentName = order.talent_profiles?.users?.full_name || 'the talent';
      const refundAmount = (order.refund_amount || order.amount) / 100;

      // Create in-app notification
      await notificationService.createNotification(
        customerUserId,
        'order_denied',
        'Order Denied & Refunded',
        `Your order for ${talentName} has been denied. ${reason}. A refund of $${refundAmount.toFixed(2)} has been processed to your original payment method.`,
        { order_id: order.id }
      );

      // Send email notification
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Order Denied</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi ${customerName},
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Unfortunately, your order for <strong>${talentName}</strong> has been denied by ${deniedBy === 'admin' ? 'ShoutOut administration' : 'the talent'}.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
              <p style="margin: 0; color: #374151;"><strong>Reason:</strong></p>
              <p style="margin: 10px 0 0 0; color: #6b7280;">${reason}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
              <p style="margin: 0; color: #374151;"><strong>Refund Information:</strong></p>
              <p style="margin: 10px 0 0 0; color: #6b7280;">
                A refund of <strong>$${refundAmount.toFixed(2)}</strong> has been processed to your original payment method.
                Please allow 5-10 business days for the refund to appear on your statement.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              If you have any questions, please contact our support team.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://shoutout.us/dashboard?tab=orders" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        display: inline-block;
                        font-weight: bold;">
                View Order History
              </a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>© ${new Date().getFullYear()} ShoutOut. All rights reserved.</p>
          </div>
        </div>
      `;

      await emailService.sendEmail({
        to: customerEmail,
        subject: 'Order Denied - Refund Processed',
        html: emailHtml
      });

      logger.log('Denial notifications sent successfully');
    } catch (error) {
      logger.error('Failed to send denial notifications:', error);
      // Don't throw - notifications are not critical
    }
  }
}

export const refundService = new RefundService();

