import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  HeartIcon, 
  ClockIcon, 
  ShieldCheckIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import FortisPaymentForm from '../components/FortisPaymentForm';
import { lunarPayService } from '../services/lunarPayService';
import { emailService } from '../services/emailService';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';

interface OrderFormData {
  requestDetails: string;
  isForBusiness: boolean;
  recipientName?: string;
  businessName?: string;
  occasion?: string;
  specialInstructions?: string;
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
  const [talent, setTalent] = useState<TalentWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OrderFormData>({
    defaultValues: {
      isForBusiness: false // Default to personal order
    }
  });

  const watchedValue = watch('isForBusiness');
  const isForBusiness = watchedValue === true || (typeof watchedValue === 'string' && watchedValue === 'true');
  
  // Debug pricing updates
  useEffect(() => {
    console.log('isForBusiness changed:', isForBusiness);
    console.log('Watch value:', watchedValue);
    console.log('Watch type:', typeof watchedValue);
  }, [isForBusiness, watchedValue]);

  useEffect(() => {
    if (talentId) {
      fetchTalent();
    }
  }, [talentId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (error) {
      console.error('Error fetching talent:', error);
      toast.error('Failed to load talent information');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculatePricing = () => {
    if (!talent) return { subtotal: 0, adminFee: 0, charityAmount: 0, total: 0 };

    // Use corporate pricing if it's a business order, otherwise use regular pricing
    const basePrice = isForBusiness 
      ? (talent.corporate_pricing || talent.pricing * 1.5) 
      : talent.pricing;
      
    console.log('Pricing calculation:', {
      isForBusiness,
      personalPrice: talent.pricing,
      corporatePrice: talent.corporate_pricing,
      basePrice
    });
    
    const subtotal = basePrice;
    const adminFeePercentage = talent.admin_fee_percentage || parseInt(process.env.REACT_APP_ADMIN_FEE_PERCENTAGE || '15');
    const adminFee = subtotal * (adminFeePercentage / 100);
    const charityAmount = talent.charity_percentage 
      ? subtotal * (talent.charity_percentage / 100) 
      : 0;
    const total = subtotal + adminFee;

    return { subtotal, adminFee, charityAmount, total };
  };

  const [showPayment, setShowPayment] = useState(false);
  const [orderData, setOrderData] = useState<OrderFormData | null>(null);

  const onSubmit = async (data: OrderFormData) => {
    if (!talent || !user) return;

    // Store order data and show payment form
    setOrderData(data);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentResult: any) => {
    if (!talent || !user || !orderData) return;

    setSubmitting(true);
    try {
      const pricing = calculatePricing();
      
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
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            talent_id: talent.id,
            request_details: orderData.requestDetails,
            amount: pricing.total,
            admin_fee: pricing.adminFee,
            charity_amount: pricing.charityAmount,
            fulfillment_deadline: fulfillmentDeadline.toISOString(),
            payment_transaction_id: paymentResult.id || paymentResult.transaction_id || `TEST_${Date.now()}`,
            is_corporate: orderData.isForBusiness,
            is_corporate_order: orderData.isForBusiness,
            company_name: orderData.businessName,
            event_description: orderData.eventDescription,
            event_audience: orderData.eventAudience,
            video_setting_request: orderData.videoSettingRequest,
            approval_status: orderData.isForBusiness ? 'pending' : 'approved',
            approved_at: orderData.isForBusiness ? null : new Date().toISOString(),
            status: 'pending',
            allow_promotional_use: orderData.allowPromotionalUse ?? true
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      // Send notifications and emails
      try {
        // Notify talent of new order (email + in-app)
        if (talent.users?.email && talent.users?.full_name) {
          await emailService.sendNewOrderNotification(
            talent.users.email,
            talent.users.full_name,
            {
              userName: user.full_name,
              amount: pricing.total,
              requestDetails: orderData.requestDetails,
              deadline: new Date(fulfillmentDeadline).toLocaleDateString()
            }
          );
        }

        if (talent.user_id) {
          await notificationService.notifyNewOrder(
            talent.user_id,
            order.id,
            user.full_name,
            pricing.total
          );
        }

        // Send user order confirmation email with receipt
        if (user.email) {
          await emailService.sendOrderConfirmation(
            user.email,
            user.full_name,
            {
              talentName: talent.temp_full_name || talent.users.full_name,
              amount: pricing.subtotal,
              adminFee: pricing.adminFee,
              charityAmount: pricing.charityAmount,
              total: pricing.total,
              requestDetails: orderData.requestDetails,
              estimatedDelivery: new Date(fulfillmentDeadline).toLocaleDateString()
            }
          );
        }

        // Create in-app notification for user
        await notificationService.notifyOrderConfirmed(
          user.id,
          order.id,
          talent.temp_full_name || talent.users.full_name
        );
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
        // Don't fail the order if notifications fail
      }

      // Process talent payout (admin fee is already deducted)
      await processTalentPayout(order, pricing.subtotal - pricing.adminFee);

      toast.success('Payment successful! Your order has been placed.');
      navigate('/dashboard');

    } catch (error) {
      console.error('Error processing order:', error);
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

  const processTalentPayout = async (order: any, talentAmount: number) => {
    if (!talent) {
      console.error('Talent not found for payout processing');
      return;
    }

    try {
      // Check if talent has vendor setup, if not create one
      let vendorId = talent.fortis_vendor_id;
      
      if (!vendorId) {
        const vendorResult = await lunarPayService.createVendor({
          talentId: talent.id,
          businessName: talent.users.full_name,
          contactName: talent.users.full_name,
          email: talent.users.email || `talent${talent.id}@shoutout.com`,
        });
        
        vendorId = vendorResult.id;
        
        // Update talent profile with vendor ID
        await supabase
          .from('talent_profiles')
          .update({ fortis_vendor_id: vendorId })
          .eq('id', talent.id);
      }

      // Ensure we have a valid vendor ID before processing payout
      if (!vendorId) {
        throw new Error('Failed to create or retrieve vendor ID');
      }

      // Schedule payout through LunarPay (this would typically be done via a background job)
      await lunarPayService.processVendorPayout({
        vendorId,
        amount: talentAmount,
        description: `ShoutOut payout for order ${order.id}`,
        orderId: order.id,
      });

      // Log the payout
      await supabase
        .from('payouts')
        .insert([
          {
            talent_id: talent.id,
            order_id: order.id,
            amount: talentAmount,
            vendor_id: vendorId,
            status: 'processed',
            processed_at: new Date().toISOString(),
          },
        ]);

    } catch (error: any) {
      console.error('Error processing talent payout:', error);
      // Don't fail the order, but log the error for manual processing
      await supabase
        .from('payout_errors')
        .insert([
          {
            talent_id: talent.id,
            order_id: order.id,
            amount: talentAmount,
            error_message: error?.message || 'Unknown payout error',
            created_at: new Date().toISOString(),
          },
        ]);
    }
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
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Order Type */}
            <div className="glass rounded-2xl shadow-modern p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Order Type
              </h2>
              
              <div className="space-y-4">
                <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="false"
                    defaultChecked={true}
                    {...register('isForBusiness', { 
                      setValueAs: (value) => value === 'true'
                    })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <div className="ml-3 flex items-center">
                    <UserIcon className="h-6 w-6 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Personal ShoutOut
                      </div>
                      <div className="text-sm text-gray-600">
                        For yourself, family, or friends
                      </div>
                    </div>
                  </div>
                </label>

                {talent.allow_corporate_pricing && (
                  <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="true"
                      {...register('isForBusiness', { 
                        setValueAs: (value) => value === 'true'
                      })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <div className="ml-3 flex items-center">
                      <BuildingOfficeIcon className="h-6 w-6 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Business ShoutOut
                        </div>
                        <div className="text-sm text-gray-600">
                          For corporate events, promotions, or team building
                        </div>
                      </div>
                    </div>
                  </label>
                )}
              </div>
              {errors.isForBusiness && (
                <p className="mt-2 text-sm text-red-600">Please select an order type</p>
              )}
            </div>

            {/* Step 2: Order Details */}
            <div className="glass rounded-2xl shadow-modern p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Order Details
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

                <div>
                  <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Name {!isForBusiness && '(Optional)'}
                  </label>
                  <input
                    type="text"
                    id="recipientName"
                    {...register('recipientName')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Who is this ShoutOut for?"
                  />
                </div>

                {!isForBusiness && (
                  <div>
                    <label htmlFor="occasion" className="block text-sm font-medium text-gray-700 mb-2">
                      Occasion (Optional)
                    </label>
                    <select
                      id="occasion"
                      {...register('occasion')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select an occasion</option>
                      <option value="birthday">Birthday</option>
                      <option value="anniversary">Anniversary</option>
                      <option value="graduation">Graduation</option>
                      <option value="promotion">Job Promotion</option>
                      <option value="retirement">Retirement</option>
                      <option value="wedding">Wedding</option>
                      <option value="holiday">Holiday</option>
                      <option value="encouragement">Encouragement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="requestDetails" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Message Request *
                  </label>
                  <textarea
                    id="requestDetails"
                    rows={6}
                    {...register('requestDetails', { 
                      required: 'Please describe what you want in your ShoutOut',
                      minLength: { value: 20, message: 'Please provide more details (at least 20 characters)' },
                      maxLength: { value: 500, message: 'Please keep your request under 500 characters' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Tell us what you'd like included in your ShoutOut. Be specific about names, details, and the tone you want. The more information you provide, the better your video will be!"
                  />
                  {errors.requestDetails && (
                    <p className="mt-1 text-sm text-red-600">{errors.requestDetails.message}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Characters: {watch('requestDetails')?.length || 0}/500
                  </p>
                </div>

                <div>
                  <label htmlFor="specialInstructions" className="block text-sm font-medium text-gray-700 mb-2">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    id="specialInstructions"
                    rows={3}
                    {...register('specialInstructions')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Any specific requests about delivery, style, or content?"
                  />
                </div>
              </div>
            </div>

            {/* Terms and Submit */}
            <div className="glass rounded-2xl shadow-modern p-6">
              <div className="flex items-center mb-4">
                <input
                  id="agreedToTerms"
                  type="checkbox"
                  {...register('agreedToTerms', { required: 'You must agree to the terms' })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="agreedToTerms" className="ml-2 block text-sm text-gray-900">
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

              <div className="flex items-center mb-4">
                <input
                  id="allowPromotionalUse"
                  type="checkbox"
                  defaultChecked={true}
                  {...register('allowPromotionalUse')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="allowPromotionalUse" className="ml-2 block text-sm text-gray-900">
                  Allow this video to be used by the personality in promotional materials
                </label>
              </div>

              {!showPayment ? (
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-red-600 text-white py-4 px-8 rounded-2xl font-bold hover:from-blue-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-modern hover:shadow-modern-lg glow-blue"
                  >
                    {submitting ? 'Processing...' : `Continue to Payment - $${pricing.total.toFixed(2)}`}
                  </button>
                  
                  {/* Testing: Skip Payment Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (orderData) {
                        handleSkipPayment();
                      } else {
                        // Store order data first
                        handleSubmit((data) => {
                          setOrderData(data);
                          setTimeout(() => handleSkipPayment(), 100);
                        })();
                      }
                    }}
                    disabled={submitting}
                    className="w-full bg-yellow-500 text-gray-900 py-3 px-8 rounded-2xl font-semibold hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 border-2 border-yellow-600"
                  >
                    ⚠️ Skip Payment (Testing Only)
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowPayment(false)}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    ← Back to order details
                  </button>
                </div>
              )}
            </div>

            {/* Payment Form */}
            {showPayment && orderData && (
              <FortisPaymentForm
                amount={pricing.total}
                orderId={`order_${Date.now()}_${talent.id}`}
                customerEmail={user?.email || ''}
                customerName={user?.full_name || ''}
                description={`ShoutOut from ${talent.users.full_name}`}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                loading={submitting}
              />
            )}
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
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
                  Delivers in {talent.fulfillment_time_hours}h
                </div>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-600">ShoutOut Price</span>
                <span className="font-medium">${pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service Fee</span>
                <span className="font-medium">${pricing.adminFee.toFixed(2)}</span>
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
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${pricing.total.toFixed(2)}
                  </span>
                </div>
              </div>
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
                Delivered within {talent.fulfillment_time_hours} hours
              </div>
            </div>

            {/* Charity Info */}
            {talent.charity_name && (
              <div className="mt-6 p-4 bg-red-50 rounded-lg">
                <div className="flex items-center text-red-800">
                  <HeartIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">
                    {talent.charity_percentage}% goes to {talent.charity_name}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPage;
