import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  HeartIcon, 
  ClockIcon, 
  ShieldCheckIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  UserIcon,
  TagIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { FireIcon } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import FortisPaymentForm from '../components/FortisPaymentForm';
import { lunarPayService } from '../services/lunarPayService';
import { emailService } from '../services/emailService';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { verifyFortisTransaction } from '../services/fortisCommerceService';

interface OrderFormData {
  isForBusiness: boolean;
  businessName?: string;
  occasion?: string;
  // Corporate-specific fields
  eventDescription?: string;
  eventAudience?: string;
  videoSettingRequest?: string;
  agreedToTerms: boolean;
  allowPromotionalUse: boolean;
}

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
    email?: string;
  };
}

const OrderPage: React.FC = () => {
  const { talentId } = useParams<{ talentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [talent, setTalent] = useState<TalentWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ordersRemaining, setOrdersRemaining] = useState<number>(10);
  const [christmasModeEnabled, setChristmasModeEnabled] = useState(false);

  // Fetch Christmas mode setting
  useEffect(() => {
    const fetchChristmasMode = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'christmas_mode_enabled')
        .single();
      setChristmasModeEnabled(data?.setting_value === 'true');
    };
    fetchChristmasMode();
  }, []);
  
  // Check for UTM tracking - check URL param first, then localStorage
  // utm=1 = "self_promo" (talent-specific, only tracks for the talent they landed on)
  // Other UTMs (rumble, twitter, etc.) = global (tracks for ANY talent)
  const getPromoSource = (loadedTalent?: TalentWithUser | null): string | null => {
    // First check URL param
    const utmParam = searchParams.get('utm');
    if (utmParam) {
      return utmParam === '1' ? 'self_promo' : utmParam;
    }
    
    // Check for talent-specific self_promo (utm=1 on their profile)
    // This only applies if ordering from the SAME talent they landed on
    if (talentId) {
      const storedByTalentId = localStorage.getItem(`promo_source_${talentId}`);
      if (storedByTalentId === 'self_promo') return 'self_promo';
    }
    const talentToCheck = loadedTalent || talent;
    if (talentToCheck?.username) {
      const storedByUsername = localStorage.getItem(`promo_source_${talentToCheck.username}`);
      if (storedByUsername === 'self_promo') return 'self_promo';
    }
    
    // Check for global UTM (e.g., shoutout.us/?utm=rumble)
    // This applies to ANY talent they order from
    const globalPromo = localStorage.getItem('promo_source_global');
    if (globalPromo) return globalPromo;
    
    return null;
  };
  
  // Get occasion from URL params (passed from profile page order ideas)
  const occasionParam = searchParams.get('occasion');
  
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<OrderFormData>({
    defaultValues: {
      isForBusiness: false, // Default to personal order
      occasion: occasionParam || '' // Pre-fill from URL if provided
    }
  });

  const watchedValue = watch('isForBusiness');
  const watchedOccasion = watch('occasion');
  const isForBusiness = watchedValue === true || (typeof watchedValue === 'string' && watchedValue === 'true');
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  // Credits state
  const [userCredits, setUserCredits] = useState<number>(0);
  
  // Debug pricing updates
  useEffect(() => {
    logger.log('isForBusiness changed:', isForBusiness);
    logger.log('Watch value:', watchedValue);
    logger.log('Watch type:', typeof watchedValue);
  }, [isForBusiness, watchedValue]);

  useEffect(() => {
    if (talentId) {
      fetchTalent();
    }
  }, [talentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      fetchUserCredits();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply coupon from localStorage (set by giveaway popup)
  useEffect(() => {
    const autoApplyCoupon = localStorage.getItem('auto_apply_coupon');
    if (autoApplyCoupon && user && talent && !appliedCoupon && !couponCode) {
      setCouponCode(autoApplyCoupon);
      // Trigger validation after setting the code
      setTimeout(() => {
        const validateBtn = document.querySelector('[data-coupon-apply]') as HTMLButtonElement;
        if (validateBtn) {
          validateBtn.click();
        }
      }, 500);
    }
  }, [user, talent, appliedCoupon, couponCode]);

  const fetchUserCredits = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserCredits(data?.credits || 0);
    } catch (error) {
      logger.error('Error fetching user credits:', error);
      // Don't show error to user, just default to 0 credits
    }
  };

  const fetchTalent = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('id', talentId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      setTalent(data);

      // Fetch pricing urgency data
      const { data: urgencyData, error: urgencyError } = await supabase
        .from('talent_pricing_urgency')
        .select('orders_remaining_at_price')
        .eq('id', talentId)
        .single();

      if (!urgencyError && urgencyData) {
        setOrdersRemaining(urgencyData.orders_remaining_at_price);
      }
    } catch (error) {
      logger.error('Error fetching talent:', error);
      toast.error('Failed to load talent information');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculatePricing = () => {
    if (!talent) return { subtotal: 0, adminFee: 0, charityAmount: 0, discount: 0, processingFee: 0, total: 0, creditsApplied: 0, amountDue: 0 };

    // Use corporate pricing if it's a business order, otherwise use regular pricing
    const basePrice = isForBusiness 
      ? (talent.corporate_pricing || talent.pricing * 1.5) 
      : talent.pricing;
      
    
    const subtotal = basePrice;
    
    // Check if talent is in promotional period (first 10 orders get 0% admin fee)
    const isPromoActive = talent.first_orders_promo_active === true && (talent.fulfilled_orders || 0) < 10;
    
    let adminFeePercentage = 0;
    if (isPromoActive) {
      // First 10 orders: 0% admin fee
      adminFeePercentage = 0;
    } else {
      // After 10 orders: use configured or default admin fee
      adminFeePercentage = talent.admin_fee_percentage || parseInt(process.env.REACT_APP_ADMIN_FEE_PERCENTAGE || '25');
    }
    
    // Admin fee is deducted from talent earnings, NOT added to customer total
    const adminFee = subtotal * (adminFeePercentage / 100);
    
    // Only calculate charity if charity is actually active (percentage > 0 and has name)
    const charityAmount = (talent.charity_percentage && Number(talent.charity_percentage) > 0 && talent.charity_name)
      ? subtotal * (talent.charity_percentage / 100) 
      : 0;
    
    // Customer total starts with subtotal
    let total = subtotal;
    let discount = 0;

    // Apply coupon if valid
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'percentage') {
        discount = (total * appliedCoupon.discount_value / 100);
        if (appliedCoupon.max_discount_amount && discount > appliedCoupon.max_discount_amount) {
          discount = appliedCoupon.max_discount_amount;
        }
      } else {
        discount = appliedCoupon.discount_value;
      }
      
      if (discount > total) discount = total;
      total = total - discount;
    }

    // Add 2.9% processing fee to final total
    const processingFee = total * 0.029;
    total = total + processingFee;

    // Apply user credits (reduce payment amount)
    const creditsApplied = Math.min(userCredits, total);
    const amountDue = Math.max(0, total - creditsApplied);

    return { subtotal, adminFee, charityAmount, discount, processingFee, total, isPromoActive, creditsApplied, amountDue };
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    if (!user) {
      setCouponError('Please log in to use coupons');
      return;
    }

    setCouponLoading(true);
    setCouponError('');

    try {
      const pricing = calculatePricing();
      
      // Call validation function
      const { data, error } = await supabase
        .rpc('validate_and_apply_coupon', {
          p_coupon_code: couponCode.trim(),
          p_user_id: user.id,
          p_order_amount: pricing.total + (appliedCoupon ? pricing.discount : 0) // Use pre-discount total
        });

      if (error) {
        logger.error('RPC Error:', error);
        throw new Error(error.message || 'Database function error');
      }

      if (!data || data.length === 0) {
        throw new Error('No response from validation');
      }

      const result = data[0];
      logger.log('Coupon validation result:', result);
      
      if (!result.valid) {
        setCouponError(result.message);
        setAppliedCoupon(null);
        return;
      }

      // Get full coupon details
      const { data: couponData, error: couponFetchError } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', result.coupon_id)
        .single();

      if (couponFetchError) {
        logger.error('Coupon fetch error:', couponFetchError);
        throw new Error('Failed to fetch coupon details');
      }

      setAppliedCoupon(couponData);
      toast.success(result.message);
    } catch (error: any) {
      logger.error('Error validating coupon:', error);
      const errorMessage = error?.message || 'Failed to validate coupon';
      setCouponError(errorMessage);
      setAppliedCoupon(null);
      toast.error(errorMessage);
    } finally {
      setCouponLoading(false);
    }
  };

  const [showPayment, setShowPayment] = useState(true);
  // Initialize orderData with defaults since payment form shows immediately
  const [orderData, setOrderData] = useState<OrderFormData>({
    isForBusiness: false,
    occasion: occasionParam || '',
    agreedToTerms: true,
    allowPromotionalUse: true
  });

  const onSubmit = async (data: OrderFormData) => {
    if (!talent || !user) return;

    // Store order data and show payment form
    setOrderData(data);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentResult: any) => {
    logger.log('handlePaymentSuccess called with', paymentResult);
    if (!talent || !user) return;

    setSubmitting(true);
    try {
      const pricing = calculatePricing();
      logger.log('pricing for order', pricing);
      // Verify Fortis transaction server-side before recording order
      const transactionId = paymentResult?.id || paymentResult?.transaction_id;
      logger.log('transactionId', transactionId);
      if (transactionId) {
        try {
          const verify = await verifyFortisTransaction(transactionId);
          logger.log('✅ Fortis verify status:', verify.statusCode);
        } catch (e) {
          // Verification is optional - payment already succeeded via Commerce.js
          // Log the error but don't block the order
          logger.warn('⚠️ Fortis verification failed (non-blocking):', e);
          logger.log('📝 Continuing with order creation - payment already captured');
        }
      }
      
      // For corporate orders, don't set deadline until approved
      // For personal orders, set deadline immediately
      let fulfillmentDeadline: Date;
      if (orderData.isForBusiness) {
        // Corporate orders: deadline will be set when approved
        fulfillmentDeadline = new Date();
        fulfillmentDeadline.setFullYear(2099); // Far future placeholder
      } else {
        // Personal orders: deadline starts immediately
        fulfillmentDeadline = new Date();
        fulfillmentDeadline.setHours(fulfillmentDeadline.getHours() + talent.fulfillment_time_hours);
      }

      // Create order in database with payment info
      // For fully discounted orders (like giveaway), store the original price as the amount
      // so payouts can be calculated correctly
      const orderAmount = pricing.total > 0 
        ? Math.round(pricing.total * 100) 
        : Math.round((pricing.subtotal) * 100); // Use subtotal if total is 0 (fully discounted)
      
      logger.log('🔄 Inserting order…', {
        userId: user.id,
        userEmail: user.email,
        talentId: talent.id,
        talentName: talent.temp_full_name || talent.users.full_name,
        transactionId: paymentResult?.id || paymentResult?.transaction_id,
        amount: pricing.total,
        orderAmount: orderAmount,
        isFullyDiscounted: pricing.total === 0,
      });
      const { data: order, error: orderError} = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            talent_id: talent.id,
            // Details will be filled in after payment on success page
            request_details: null,
            recipient_name: null,
            details_submitted: false,
            occasion: getValues('occasion') || watchedOccasion || orderData.occasion || null,
            amount: orderAmount, // Store original price for fully discounted orders
            original_amount: appliedCoupon ? Math.round((pricing.subtotal) * 100) : null,
            discount_amount: appliedCoupon ? Math.round(pricing.discount * 100) : null,
            coupon_id: appliedCoupon?.id || null,
            coupon_code: appliedCoupon?.code || null,
            admin_fee: Math.round(pricing.adminFee * 100), // Store in cents
            charity_amount: Math.round(pricing.charityAmount * 100), // Store in cents
            fulfillment_deadline: fulfillmentDeadline.toISOString(),
            payment_transaction_id: (paymentResult.id === 'CREDITS_ONLY' || paymentResult.transaction_id === 'CREDITS_ONLY' || paymentResult.id === 'FREE_ORDER' || paymentResult.transaction_id === 'FREE_ORDER') 
              ? null 
              : (paymentResult.id || paymentResult.transaction_id || null),
            payment_transaction_payload: paymentResult?.payload ?? null,
            is_corporate: getValues('isForBusiness') || orderData.isForBusiness,
            is_corporate_order: getValues('isForBusiness') || orderData.isForBusiness,
            company_name: getValues('businessName') || orderData.businessName,
            event_description: getValues('eventDescription') || orderData.eventDescription,
            event_audience: getValues('eventAudience') || orderData.eventAudience,
            video_setting_request: getValues('videoSettingRequest') || orderData.videoSettingRequest,
            approval_status: (getValues('isForBusiness') || orderData.isForBusiness) ? 'pending' : 'approved',
            approved_at: (getValues('isForBusiness') || orderData.isForBusiness) ? null : new Date().toISOString(),
            status: 'pending',
            allow_promotional_use: getValues('allowPromotionalUse') ?? orderData.allowPromotionalUse ?? true,
            promo_source: getPromoSource(talent),
            did_holiday_popup: localStorage.getItem('holiday_popup_submitted') === 'true'
          },
        ])
        .select()
        .single();

      logger.log('✅ Order insert result:', { 
        success: !orderError,
        orderId: order?.id,
        error: orderError,
        orderData: order
      });

      if (orderError) throw orderError;

      // Apply user credits if applicable
      if (pricing.creditsApplied > 0) {
        try {
          const { data: creditResult, error: creditError } = await supabase.rpc('use_credits_for_order', {
            p_user_id: user.id,
            p_order_id: order.id,
            p_order_amount_cents: Math.round(pricing.total * 100)
          });

          if (creditError) {
            logger.error('Error applying credits:', creditError);
            // Don't fail the order if credit tracking fails - order already created
            toast.error('Credits could not be applied, but order was placed successfully');
          } else if (creditResult?.success) {
            logger.log('✅ Credits applied:', creditResult);
            // Refresh user credits in state
            fetchUserCredits();
          }
        } catch (creditErr) {
          logger.error('Exception applying credits:', creditErr);
          // Don't fail the order
        }
      }

      // NOTE: Meta Pixel and Rumble Ads conversion tracking moved to OrderSuccessPage
      // to ensure they only fire once after successful order confirmation

      // Send Zapier webhook for new orders via Edge Function (exclude test/admin orders)
      try {
        const excludedEmails = ['helloshoutout@shoutout.us'];
        const isAdminOrder = user.email && excludedEmails.includes(user.email.toLowerCase());
        
        logger.log('🔍 Zapier webhook check:', { 
          userEmail: user.email, 
          isAdminOrder, 
          excludedEmails 
        });
        
        if (!isAdminOrder) {
          const talentName = talent.temp_full_name || talent.users.full_name;
          const customerName = user.full_name || user.email;
          
          const webhookPayload = {
            order_id: order.id,
            customer_name: customerName,
            customer_email: user.email,
            talent_name: talentName,
            amount: pricing.total,
            order_date: new Date().toISOString()
          };
          
          logger.log('📤 Sending Zapier webhook via Edge Function:', webhookPayload);
          
          // Use Edge Function to send webhook (avoids CORS issues)
          supabase.functions.invoke('send-order-webhook', {
            body: webhookPayload
          }).then((result) => {
            if (result.error) {
              logger.error('❌ Edge Function error:', result.error);
            } else {
              logger.log('✅ Zapier webhook sent via Edge Function:', result.data);
            }
          }).catch((err) => {
            logger.error('❌ Error calling Edge Function:', err);
          });
        } else {
          logger.log('⏭️ Skipping Zapier webhook - admin/test order');
        }
      } catch (zapierError) {
        logger.error('❌ Exception with Zapier webhook:', zapierError);
        // Don't fail the order if webhook fails
      }

      // Track coupon usage if coupon was applied
      if (appliedCoupon) {
        try {
          // Track coupon usage
          await supabase.from('coupon_usage').insert({
            coupon_id: appliedCoupon.id,
            user_id: user.id,
            order_id: order.id
          });

          // Increment used count
          await supabase.from('coupons')
            .update({ used_count: appliedCoupon.used_count + 1 })
            .eq('id', appliedCoupon.id);
          
          logger.log('✅ Coupon usage tracked');
        } catch (couponError) {
          logger.error('Error tracking coupon usage:', couponError);
          // Don't fail the order if coupon tracking fails
        }
      }

      // Send notifications and emails asynchronously (don't block redirect)
      // Fire and forget - these will complete in the background
      Promise.all([
        // Notify talent of new order (email + in-app)
        (async () => {
          if (talent.users?.email && talent.users?.full_name) {
            try {
              await emailService.sendNewOrderNotification(
                talent.users.email,
                talent.users.full_name,
                {
                  userName: user.full_name || user.email?.split('@')[0] || 'Customer',
                  amount: pricing.total,
                  requestDetails: 'Details pending from customer',
                  deadline: new Date(fulfillmentDeadline).toLocaleDateString()
                }
              );
            } catch (e) {
              logger.error('Error sending talent email:', e);
            }
          }
        })(),
        
        (async () => {
          if (talent.user_id) {
            try {
              await notificationService.notifyNewOrder(
                talent.user_id,
                order.id,
                user.full_name || user.email?.split('@')[0] || 'Customer',
                pricing.total
              );
            } catch (e) {
              logger.error('Error notifying talent:', e);
            }
          }
        })(),

        // Send user order confirmation email with receipt
        (async () => {
          if (user.email) {
            try {
              await emailService.sendOrderConfirmation(
                user.email,
                user.full_name || user.email?.split('@')[0] || 'there',
                {
                  talentName: talent.temp_full_name || talent.users.full_name,
                  amount: pricing.subtotal,
                  adminFee: pricing.adminFee,
                  charityAmount: pricing.charityAmount,
                  total: pricing.total,
                  requestDetails: 'You will add details on the next page',
                  estimatedDelivery: new Date(fulfillmentDeadline).toLocaleDateString()
                }
              );
            } catch (e) {
              logger.error('Error sending user email:', e);
            }
          }
        })(),

        // Create in-app notification for user
        (async () => {
          try {
            await notificationService.notifyOrderConfirmed(
              user.id,
              order.id,
              talent.temp_full_name || talent.users.full_name
            );
          } catch (e) {
            logger.error('Error notifying user:', e);
          }
        })()
      ]).catch(error => {
        logger.error('Error in notification batch:', error);
        // Don't fail the order if notifications fail
      });

      // Note: Payouts are now handled through Moov/Plaid integration
      // Talent will receive payouts directly to their connected bank account
      // No immediate payout processing needed here

      toast.success('Payment successful! Your order has been placed.');
      
      // Fire tracking events on successful order (click-based, like popup Lead)
      console.log('📊 OrderPage: Firing conversion tracking events...', {
        hasFbq: typeof (window as any).fbq === 'function',
        hasRatag: typeof (window as any).ratag === 'function'
      });
      
      // Rumble Ads Order conversion
      if (typeof window !== 'undefined' && (window as any).ratag) {
        (window as any).ratag('conversion', { to: 3320 });
        console.log('📊 OrderPage: Rumble Ads Order conversion fired (3320)');
      } else {
        console.warn('⚠️ OrderPage: Rumble Ads (ratag) not found');
      }
      
      // Facebook Pixel Purchase event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Purchase', {
          value: pricing.total,
          currency: 'USD',
          content_type: 'product',
          content_name: `ShoutOut from ${talent.temp_full_name || talent.users.full_name}`,
          content_ids: [order.id],
          num_items: 1
        });
        console.log('📊 OrderPage: Facebook Pixel Purchase event fired');
      } else {
        console.warn('⚠️ OrderPage: Facebook Pixel (fbq) not found');
      }
      
      // Navigate to success page with order details
      const successParams = new URLSearchParams({
        order_id: order.id,
        amount: pricing.total.toString(),
        talent: talent.temp_full_name || talent.users.full_name,
        delivery_hours: talent.fulfillment_time_hours.toString()
      });
      navigate(`/order-success?${successParams.toString()}`);

    } catch (error) {
      logger.error('Error processing order:', error);
      toast.error('Failed to process order. Please contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setSubmitting(false);
  };

  const handleSkipPayment = async () => {
    if (!talent || !user || !orderData) return;

    // Mock payment result for testing - just process as if payment succeeded
    const mockPaymentResult = {
      transaction_id: `TEST_${Date.now()}`,
      amount: calculatePricing().total,
      status: 'test_skipped'
    };

    // Reuse the same payment success handler
    await handlePaymentSuccess(mockPaymentResult);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Talent Not Found</h1>
          <p className="text-gray-600">The talent you're trying to order from doesn't exist.</p>
        </div>
      </div>
    );
  }

  const pricing = calculatePricing();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Order a ShoutOut
        </h1>
        <p className="text-gray-600">
          Get a personalized video message from {talent.temp_full_name || talent.users.full_name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Form */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* What to Expect */}
            <div className="glass rounded-2xl shadow-modern p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                What to Expect
              </h2>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-blue-500">✓</span>
                  <p className="text-sm text-gray-700">Add order details after checkout</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-500">✓</span>
                  <p className="text-sm text-gray-700">Get your video within {talent.fulfillment_time_hours && talent.fulfillment_time_hours > 0 ? talent.fulfillment_time_hours : 48}h</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-500">✓</span>
                  <p className="text-sm text-gray-700">Download & share</p>
                </div>
              </div>
            </div>

            {/* Occasion Selection */}
            <div className="glass rounded-2xl shadow-modern p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Occasion
              </h2>
              <select
                id="occasion"
                {...register('occasion')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select an occasion</option>
                <option value="pep-talk">💝 Surprise a loved one</option>
                <option value="new-year">🎆 New Years ShoutOut</option>
                <option value="birthday">🎂 Happy Birthday</option>
                <option value="roast">🔥 Friendly roast</option>
                <option value="advice">💡 Get advice</option>
                <option value="other">✨ Other</option>
              </select>
            </div>

            {/* Hidden field for isForBusiness - default to personal */}
            <input type="hidden" {...register('isForBusiness')} value="false" />

            {/* Business Order Details - only show if somehow business is selected */}
            {isForBusiness && (
            <div className="glass rounded-2xl shadow-modern p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Business Details
              </h2>

              <div className="space-y-4">
                {isForBusiness && (
                  <div>
                    <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      {...register('businessName', { 
                        required: isForBusiness ? 'Business name is required' : false 
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter your business name"
                    />
                    {errors.businessName && (
                      <p className="mt-1 text-sm text-red-600">{errors.businessName.message}</p>
                    )}
                  </div>
                )}

                {isForBusiness && (
                  <>
                    <div>
                      <label htmlFor="eventDescription" className="block text-sm font-medium text-gray-700 mb-2">
                        Event Description (Optional)
                      </label>
                      <textarea
                        id="eventDescription"
                        {...register('eventDescription')}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Describe the event or occasion (e.g., company retreat, product launch, team celebration)"
                      />
                    </div>

                    <div>
                      <label htmlFor="eventAudience" className="block text-sm font-medium text-gray-700 mb-2">
                        Target Audience (Optional)
                      </label>
                      <input
                        type="text"
                        id="eventAudience"
                        {...register('eventAudience')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Who will see this video? (e.g., employees, customers, investors)"
                      />
                    </div>

                    <div>
                      <label htmlFor="videoSettingRequest" className="block text-sm font-medium text-gray-700 mb-2">
                        Setting Request (Optional)
                      </label>
                      <textarea
                        id="videoSettingRequest"
                        {...register('videoSettingRequest')}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Any specific setting or environment requests? (e.g., office background, outdoor setting, formal attire)"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            )}

            {/* Terms and Submit */}
            <div className="glass rounded-2xl shadow-modern p-6">
              <div className="flex items-start mb-4">
                <input
                  id="agreedToTerms"
                  type="checkbox"
                  defaultChecked={true}
                  {...register('agreedToTerms', { required: 'You must agree to the terms' })}
                  className="h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-400 rounded mt-0.5"
                  style={{ accentColor: '#3b82f6' }}
                />
                <label htmlFor="agreedToTerms" className="ml-3 block text-sm text-gray-900">
                  I agree to the{' '}
                  <button type="button" className="text-primary-600 hover:text-primary-500 underline">
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" className="text-primary-600 hover:text-primary-500 underline">
                    Privacy Policy
                  </button>
                </label>
              </div>
              {errors.agreedToTerms && (
                <p className="mb-4 text-sm text-red-600">{errors.agreedToTerms.message}</p>
              )}

              <div className="flex items-start mb-4">
                <input
                  id="allowPromotionalUse"
                  type="checkbox"
                  defaultChecked={true}
                  {...register('allowPromotionalUse')}
                  className="h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-400 rounded mt-0.5"
                  style={{ accentColor: '#3b82f6' }}
                />
                <label htmlFor="allowPromotionalUse" className="ml-3 block text-sm text-gray-900">
                  Allow this video to be used by the personality in promotional materials
                </label>
              </div>

            </div>

            {/* Payment Form - Only show if amount due > 0 */}
            {pricing.amountDue > 0 && (
              <FortisPaymentForm
                amount={pricing.amountDue}
                orderId={`order_${Date.now()}_${talent.id}`}
                customerEmail={user?.email || ''}
                customerName={user?.full_name || ''}
                description={`ShoutOut from ${talent.users.full_name}`}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                loading={submitting}
              />
            )}

            {/* Free order - show confirmation (coupon or credits fully cover the order) */}
            {pricing.amountDue === 0 && (
              <div className="light-theme rounded-2xl px-6 py-8 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 max-w-3xl mx-auto text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CurrencyDollarIcon className="h-10 w-10 text-green-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#111827' }}>
                  {pricing.creditsApplied > 0 ? 'Order Covered by Credits!' : 'Order Fully Discounted!'}
                </h3>
                <p className="mb-6" style={{ color: '#4b5563' }}>
                  {pricing.creditsApplied > 0 
                    ? 'Your account credits will cover the full cost of this order.'
                    : 'Your coupon covers the full cost of this order.'
                  }
                  {' '}No payment needed!
                </p>
                <button
                  onClick={() => handlePaymentSuccess({ id: 'FREE_ORDER', transaction_id: 'FREE_ORDER' })}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white py-3 px-8 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Placing Order...' : 'Confirm Order'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <div className="glass rounded-2xl shadow-modern p-6 sticky top-8">
            {/* Talent Info */}
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 flex-shrink-0">
                {(talent.temp_avatar_url || talent.users.avatar_url) ? (
                  <img
                    src={talent.temp_avatar_url || talent.users.avatar_url}
                    alt={talent.temp_full_name || talent.users.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl font-bold text-primary-600">
                      {(talent.temp_full_name || talent.users.full_name).charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">
                  {talent.temp_full_name || talent.users.full_name}
                </h3>
                <div className="flex items-center text-sm text-gray-600">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  Delivers in {talent.fulfillment_time_hours && talent.fulfillment_time_hours > 0 ? talent.fulfillment_time_hours : 48}h
                </div>
              </div>
            </div>

            {/* Christmas Deadline Warning - Only show when Christmas mode is enabled */}
            {christmasModeEnabled && talent.christmas_deadline && (() => {
              const deadline = new Date(talent.christmas_deadline + 'T23:59:59');
              const now = new Date();
              const isPastDeadline = now > deadline;
              const diffMs = deadline.getTime() - now.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              
              return isPastDeadline ? (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-sm text-orange-800 font-medium flex items-center gap-2">
                    <span>⚠️</span>
                    <span>This order may not be delivered before Christmas.</span>
                  </p>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                    <span>🎄</span>
                    <span>Order in the next {diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`} to get before Christmas!</span>
                  </p>
                </div>
              );
            })()}

            {/* Pricing Urgency Indicator */}
            {ordersRemaining <= 10 && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/50 rounded-xl px-3 py-2.5 animate-pulse">
                <FireIcon className="h-4 w-4 text-orange-400 flex-shrink-0" />
                <span className="text-xs font-bold text-orange-100 text-center">
                  Only {ordersRemaining} more {ordersRemaining === 1 ? 'order' : 'orders'} at this price!
                </span>
              </div>
            )}

            {/* Pricing Breakdown */}
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-600">ShoutOut Price</span>
                <span className="font-medium">${pricing.subtotal.toFixed(2)}</span>
              </div>
              {pricing.charityAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span className="flex items-center">
                    <HeartIcon className="h-4 w-4 mr-1" />
                    Charity Donation
                  </span>
                  <span className="font-medium">
                    ${pricing.charityAmount.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* Coupon Code Input */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Have a coupon code?
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  disabled={!!appliedCoupon}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-100"
                />
                {!appliedCoupon ? (
                  <button
                    type="button"
                    onClick={validateCoupon}
                    data-coupon-apply="true"
                    disabled={couponLoading || !couponCode.trim()}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {couponLoading ? 'Checking...' : 'Apply'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponCode('');
                      setCouponError('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
                
                {couponError && (
                  <p className="text-xs text-red-600">{couponError}</p>
                )}
                
                {appliedCoupon && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <TagIcon className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-800 font-medium">
                      Coupon "{appliedCoupon.code}" applied!
                    </span>
                  </div>
                )}
              </div>

              {/* Show discount if coupon applied */}
              {pricing.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center">
                    <TagIcon className="h-4 w-4 mr-1" />
                    Coupon Discount
                  </span>
                  <span className="font-medium">
                    -${pricing.discount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Processing Fee */}
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Processing Fee (2.9%)</span>
                <span>${pricing.processingFee.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${pricing.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Account Credits - Only show if user has credits */}
              {userCredits > 0 && (
                <>
                  <div className="border-t border-green-100 pt-3 bg-green-50 -mx-6 px-6 py-3">
                    <div className="flex justify-between text-green-700">
                      <span className="font-medium flex items-center">
                        <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                        Account Credits Applied
                      </span>
                      <span className="font-semibold">
                        -${pricing.creditsApplied.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      Balance after order: ${(userCredits - pricing.creditsApplied).toFixed(2)}
                    </p>
                  </div>

                  {/* Amount Due - Only show when credits are applied */}
                  <div className="border-t border-gray-300 pt-3 bg-blue-50 -mx-6 px-6 py-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-900">Amount Due</span>
                      <span className="text-2xl font-bold text-blue-600">
                        ${pricing.amountDue.toFixed(2)}
                      </span>
                    </div>
                    {pricing.amountDue === 0 && (
                      <p className="text-sm text-green-600 mt-2 font-medium">
                        ✓ Fully covered by credits - no payment needed!
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="mt-6 space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-5 w-5 text-green-500 mr-2" />
                100% Money-Back Guarantee
              </div>
              <div className="flex items-center">
                <CreditCardIcon className="h-5 w-5 text-blue-500 mr-2" />
                Secure Payment Processing
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-orange-500 mr-2" />
                Delivered within {talent.fulfillment_time_hours && talent.fulfillment_time_hours > 0 ? talent.fulfillment_time_hours : 48} hours
              </div>
            </div>

            {/* Charity Info */}
            {talent.charity_name && Number(talent.charity_percentage) > 0 ? (
              <div className="mt-6 p-4 bg-red-50 rounded-lg">
                <div className="flex items-center text-red-800">
                  <HeartIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">
                    {talent.charity_percentage}% goes to {talent.charity_name}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPage;
