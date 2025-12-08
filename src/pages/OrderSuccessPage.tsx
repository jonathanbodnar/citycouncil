import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircleIcon, HomeIcon, UserIcon } from '@heroicons/react/24/solid';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

// Declare global tracking functions
declare global {
  interface Window {
    ratag: (event: string, options: { to: number; cid?: string; value?: number }) => void;
    _ratagData: any[];
    fbq: (action: string, event: string, params?: any) => void;
  }
}

const OrderSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const conversionFiredRef = useRef(false);

  // Form state for order details
  const [recipientName, setRecipientName] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailsSubmitted, setDetailsSubmitted] = useState(false);

  // Get order details from URL params
  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const talentName = searchParams.get('talent');
  const deliveryHours = searchParams.get('delivery_hours');
  const occasion = searchParams.get('occasion');

  // Calculate order amount for display and FB pixel
  const orderAmount = amount ? parseFloat(amount) : 0;

  // Format delivery time for display
  const getDeliveryTimeText = () => {
    if (!deliveryHours) return 'soon';
    const hours = parseInt(deliveryHours);
    if (hours <= 24) return '24 hours';
    if (hours <= 48) return '48 hours';
    if (hours <= 72) return '3 days';
    if (hours <= 168) return '7 days';
    return `${Math.ceil(hours / 24)} days`;
  };

  // Submit order details
  const handleSubmitDetails = async () => {
    if (!recipientName.trim()) {
      toast.error('Please enter who this video is for');
      return;
    }
    if (!requestDetails.trim() || requestDetails.trim().length < 25) {
      toast.error('Please provide more details about your request (at least 25 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          recipient_name: recipientName.trim(),
          request_details: requestDetails.trim(),
          special_instructions: specialInstructions.trim() || null,
          details_submitted: true
        })
        .eq('id', orderId);

      if (error) throw error;

      setDetailsSubmitted(true);
      toast.success('Order details submitted! The talent will start working on your video.');
    } catch (err) {
      console.error('Error submitting details:', err);
      toast.error('Failed to submit details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle "Do this later"
  const handleDoLater = () => {
    toast.success('You can add details later from your Orders page');
    navigate('/dashboard?tab=orders');
  };

  // Fire conversion immediately when component mounts
  useEffect(() => {
    console.log('🔍 OrderSuccessPage mounted, orderId:', orderId);
    
    // Redirect if no order ID (shouldn't land here directly)
    if (!orderId) {
      console.log('❌ No orderId, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }

    // Fire conversions on page load (only once)
    if (!conversionFiredRef.current) {
      conversionFiredRef.current = true;
      
      // === RUMBLE ADS CONVERSION ===
      // Simple call exactly as per Rumble docs: ratag('conversion', {to: 3320})
      console.log('🔍 Rumble Ads - Firing conversion');
      console.log('🔍 window.ratag exists:', typeof (window as any).ratag);
      console.log('🔍 window._ratagData exists:', typeof (window as any)._ratagData);
      
      try {
        // ratag is defined in index.html and pushes to _ratagData
        (window as any).ratag('conversion', {to: 3320});
        console.log('✅ Rumble ratag("conversion", {to: 3320}) called');
        console.log('✅ _ratagData now:', (window as any)._ratagData);
      } catch (e) {
        console.error('❌ Rumble ratag error:', e);
      }

      // === FACEBOOK PIXEL CONVERSION ===
      console.log('🔍 Facebook Pixel check:', {
        fbqExists: typeof (window as any).fbq,
        fbqType: (window as any).fbq ? 'exists' : 'undefined'
      });
      
      try {
        const fbq = (window as any).fbq;
        if (fbq) {
          const purchaseData = {
            value: orderAmount,
            currency: 'USD',
            content_type: 'product',
            content_name: `ShoutOut from ${talentName || 'Talent'}`,
            content_ids: [orderId],
            num_items: 1
          };
          console.log('📤 Calling fbq("track", "Purchase", ...)', purchaseData);
          fbq('track', 'Purchase', purchaseData);
          console.log('✅ Facebook Pixel Purchase event tracked successfully');
        } else {
          console.warn('⚠️ Facebook Pixel (fbq) not available on window');
        }
      } catch (fbError) {
        console.error('❌ Facebook Pixel error:', fbError);
      }
    }
  }, [orderId, orderAmount, talentName, navigate]);

  if (!orderId) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Order Confirmed! | ShoutOut</title>
      </Helmet>

      <div className="flex items-center justify-center p-4 py-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="max-w-lg w-full rounded-2xl shadow-2xl p-6 md:p-8 border border-white/10" style={{ background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))' }}>
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <CheckCircleIcon className="h-10 w-10 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-xl md:text-2xl font-bold text-white mb-2 text-center">
            {detailsSubmitted ? 'All Set! 🎉' : 'Payment Successful! 🎉'}
          </h1>

          {/* Order Info */}
          <div className="rounded-xl p-3 mb-4 text-center border border-white/10" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div className="flex justify-center gap-4 text-sm">
              <span className="text-gray-400">Order: <span className="font-mono text-white">{orderId?.slice(0, 8)}...</span></span>
              {orderAmount > 0 && (
                <span className="text-gray-400">Paid: <span className="font-semibold text-green-400">${orderAmount.toFixed(2)}</span></span>
              )}
            </div>
          </div>

          {!detailsSubmitted ? (
            <>
              {/* Details Form */}
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white mb-3 text-center">
                  Now tell {talentName || 'the talent'} what you want!
                </h2>
                
                <div className="space-y-4">
                  {/* Recipient Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Who is this video for? <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Enter the recipient's name"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Request Details */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Your Message Request <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={requestDetails}
                      onChange={(e) => setRequestDetails(e.target.value)}
                      rows={4}
                      placeholder="Tell them what you'd like included in your ShoutOut. Be specific about names, details, and the tone you want!"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {requestDetails.length}/1000 characters (min 25)
                    </p>
                  </div>

                  {/* Special Instructions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Special Instructions (Optional)
                    </label>
                    <textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      rows={2}
                      placeholder="Any specific requests about delivery, style, or content?"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitDetails}
                disabled={submitting}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
              >
                {submitting ? 'Submitting...' : 'Submit Details'}
              </button>

              {/* Do This Later */}
              <button
                onClick={handleDoLater}
                className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Do this later →
              </button>
            </>
          ) : (
            <>
              {/* Success State */}
              <p className="text-gray-300 mb-4 text-center">
                {talentName || 'The talent'} has been notified and will create your personalized video within {getDeliveryTimeText()}.
              </p>

              {/* What's Next */}
              <div className="rounded-xl p-4 mb-4 text-left border border-blue-500/20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <h3 className="font-semibold text-blue-400 mb-2">What happens next?</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• You'll receive a text confirmation</li>
                  <li>• {talentName || 'The talent'} will create your video within {getDeliveryTimeText()}</li>
                  <li>• We'll notify you when it's ready!</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Link
                  to="/"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors border border-white/20 text-white hover:bg-white/10"
                >
                  <HomeIcon className="h-5 w-5" />
                  Home
                </Link>
                <Link
                  to="/dashboard?tab=orders"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors text-white"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                >
                  <UserIcon className="h-5 w-5" />
                  My Orders
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderSuccessPage;

