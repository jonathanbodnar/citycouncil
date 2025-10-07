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
import toast from 'react-hot-toast';

interface OrderFormData {
  requestDetails: string;
  isForBusiness: boolean;
  recipientName?: string;
  businessName?: string;
  occasion?: string;
  specialInstructions?: string;
  agreedToTerms: boolean;
}

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

const OrderPage: React.FC = () => {
  const { talentId } = useParams<{ talentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [talent, setTalent] = useState<TalentWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OrderFormData>();

  const isForBusiness = watch('isForBusiness');

  useEffect(() => {
    if (talentId) {
      fetchTalent();
    }
  }, [talentId]);

  const fetchTalent = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            id,
            full_name,
            avatar_url
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

    const subtotal = talent.pricing;
    const adminFeePercentage = talent.admin_fee_percentage || parseInt(process.env.REACT_APP_ADMIN_FEE_PERCENTAGE || '15');
    const adminFee = subtotal * (adminFeePercentage / 100);
    const charityAmount = talent.charity_percentage 
      ? subtotal * (talent.charity_percentage / 100) 
      : 0;
    const total = subtotal + adminFee;

    return { subtotal, adminFee, charityAmount, total };
  };

  const onSubmit = async (data: OrderFormData) => {
    if (!talent || !user) return;

    setSubmitting(true);
    try {
      const pricing = calculatePricing();
      const fulfillmentDeadline = new Date();
      fulfillmentDeadline.setHours(fulfillmentDeadline.getHours() + talent.fulfillment_time_hours);

      // Create order in database
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            talent_id: talent.id,
            request_details: data.requestDetails,
            amount: pricing.total,
            admin_fee: pricing.adminFee,
            charity_amount: pricing.charityAmount,
            fulfillment_deadline: fulfillmentDeadline.toISOString(),
            stripe_payment_intent_id: 'pending', // Will be updated after payment
            is_corporate: data.isForBusiness,
            company_name: data.businessName,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      // In a real implementation, this would redirect to Stripe Checkout
      // For now, we'll simulate the payment process
      toast.success('Order created successfully! Redirecting to payment...');
      
      // Simulate payment processing
      setTimeout(() => {
        toast.success('Payment successful! Your order has been placed.');
        navigate('/dashboard');
      }, 2000);

    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setSubmitting(false);
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
          Get a personalized video message from {talent.users.full_name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Order Type */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Order Type
              </h2>
              
              <div className="space-y-4">
                <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="false"
                    {...register('isForBusiness', { required: true })}
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

                <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="true"
                    {...register('isForBusiness', { required: true })}
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
              </div>
              {errors.isForBusiness && (
                <p className="mt-2 text-sm text-red-600">Please select an order type</p>
              )}
            </div>

            {/* Step 2: Order Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
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
                    <option value="business">Business Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>

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
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center mb-4">
                <input
                  id="agreedToTerms"
                  type="checkbox"
                  {...register('agreedToTerms', { required: 'You must agree to the terms' })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="agreedToTerms" className="ml-2 block text-sm text-gray-900">
                  I agree to the{' '}
                  <a href="#" className="text-primary-600 hover:text-primary-500">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-primary-600 hover:text-primary-500">
                    Privacy Policy
                  </a>
                </label>
              </div>
              {errors.agreedToTerms && (
                <p className="mb-4 text-sm text-red-600">{errors.agreedToTerms.message}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Processing...' : `Continue to Payment - $${pricing.total.toFixed(2)}`}
              </button>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
            {/* Talent Info */}
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 flex-shrink-0">
                {talent.users.avatar_url ? (
                  <img
                    src={talent.users.avatar_url}
                    alt={talent.users.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl font-bold text-primary-600">
                      {talent.users.full_name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">
                  {talent.users.full_name}
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
