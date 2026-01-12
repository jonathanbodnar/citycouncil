import React, { useEffect, useState } from 'react';
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

  // Form state for order details
  const [recipientName, setRecipientName] = useState('');
  const [mention1, setMention1] = useState('');
  const [mention2, setMention2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailsSubmitted, setDetailsSubmitted] = useState(false);
  
  // Corporate event form state
  const [eventName, setEventName] = useState('');
  const [siteLink, setSiteLink] = useState('');
  const [keyPoint1, setKeyPoint1] = useState('');
  const [keyPoint2, setKeyPoint2] = useState('');
  const [keyPoint3, setKeyPoint3] = useState('');
  const [keyPoint4, setKeyPoint4] = useState('');
  const [keyPoint5, setKeyPoint5] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Get order details from URL params
  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const talentName = searchParams.get('talent');
  const deliveryHours = searchParams.get('delivery_hours');
  const occasion = searchParams.get('occasion');
  
  // Check if this is a corporate order
  const isCorporateOrder = occasion === 'corporate';

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
    if (isCorporateOrder) {
      // Validate corporate fields
      if (!eventName.trim()) {
        toast.error('Please enter the event name');
        return;
      }
      if (!keyPoint1.trim()) {
        toast.error('Please add at least one key point to mention');
        return;
      }
      
      setSubmitting(true);
      try {
        // Combine key points and notes into request_details
        const keyPoints = [keyPoint1, keyPoint2, keyPoint3, keyPoint4, keyPoint5]
          .map(kp => kp.trim())
          .filter(Boolean)
          .map((kp, i) => `${i + 1}. ${kp}`)
          .join('\n');
        
        const requestDetails = [
          `Event: ${eventName.trim()}`,
          siteLink.trim() ? `Website: ${siteLink.trim()}` : '',
          '',
          'Key Points:',
          keyPoints,
          additionalNotes.trim() ? `\nAdditional Notes:\n${additionalNotes.trim()}` : ''
        ].filter(Boolean).join('\n');

        const { error } = await supabase
          .from('orders')
          .update({
            recipient_name: `Corporate Event: ${eventName.trim()}`,
            request_details: requestDetails,
            special_instructions: additionalNotes.trim() || null,
            details_submitted: true
          })
          .eq('id', orderId);

        if (error) throw error;

        setDetailsSubmitted(true);
        toast.success('Event details submitted! The talent will start working on your video.');
      } catch (err) {
        console.error('Error submitting details:', err);
        toast.error('Failed to submit details. Please try again.');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Regular order validation
      if (!recipientName.trim()) {
        toast.error('Please enter who this video is for');
        return;
      }
      if (!mention1.trim()) {
        toast.error('Please add at least one thing to mention');
        return;
      }

      setSubmitting(true);
      try {
        // Combine mentions into request_details for storage
        const mentions = [mention1.trim(), mention2.trim()].filter(Boolean);
        const requestDetails = mentions.join('\n');

        const { error } = await supabase
          .from('orders')
          .update({
            recipient_name: recipientName.trim(),
            request_details: requestDetails,
            special_instructions: null,
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
    }
  };

  // Handle "Do this later"
  const handleDoLater = () => {
    toast.success('You can add details later from your Orders page');
    navigate('/dashboard?tab=orders');
  };

  // Redirect if no order ID (shouldn't land here directly)
  useEffect(() => {
    console.log('🔍 OrderSuccessPage mounted, orderId:', orderId);
    
    if (!orderId) {
      console.log('❌ No orderId, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }
    
    // Note: Conversion tracking (Rumble, Facebook) is now fired in OrderPage
    // on successful payment (click-based) to ensure reliable tracking
  }, [orderId, navigate]);

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
                  {isCorporateOrder 
                    ? `Now tell ${talentName || 'the talent'} about your event!`
                    : `Now tell ${talentName || 'the talent'} what you want!`
                  }
                </h2>
                
                {isCorporateOrder ? (
                  /* Corporate Event Form */
                  <div className="space-y-4">
                    {/* Event Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        What's the event? <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="e.g., Annual Company Retreat, Product Launch"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Site Link */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Website or Event Link
                      </label>
                      <input
                        type="url"
                        value={siteLink}
                        onChange={(e) => setSiteLink(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* 5 Key Things to Say */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        5 Key Things to Mention <span className="text-red-400">* (at least 1)</span>
                      </label>
                      <p className="text-xs text-gray-400 mb-2">
                        What should {talentName || 'they'} highlight in the video?
                      </p>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((num) => {
                          const value = num === 1 ? keyPoint1 : num === 2 ? keyPoint2 : num === 3 ? keyPoint3 : num === 4 ? keyPoint4 : keyPoint5;
                          const setValue = num === 1 ? setKeyPoint1 : num === 2 ? setKeyPoint2 : num === 3 ? setKeyPoint3 : num === 4 ? setKeyPoint4 : setKeyPoint5;
                          return (
                            <div key={num} className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{num}.</span>
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value.slice(0, 160))}
                                placeholder={num === 1 ? "e.g., Announce new product launch" : `Key point ${num}`}
                                className="w-full pl-8 pr-16 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                maxLength={160}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{value.length}/160</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Additional Information
                      </label>
                      <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        placeholder="Any other details or context..."
                        rows={3}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* Regular Order Form */
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

                    {/* Things to Mention */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        What would you like {talentName || 'them'} to mention? <span className="text-red-400">*</span>
                      </label>
                      <p className="text-xs text-gray-400 mb-2">
                        Add 1-2 things you'd like included in your ShoutOut
                      </p>
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">1.</span>
                          <input
                            type="text"
                            value={mention1}
                            onChange={(e) => setMention1(e.target.value.slice(0, 160))}
                            placeholder="e.g., Wish them a happy birthday"
                            className="w-full pl-8 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={160}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{mention1.length}/160</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">2.</span>
                          <input
                            type="text"
                            value={mention2}
                            onChange={(e) => setMention2(e.target.value.slice(0, 160))}
                            placeholder="e.g., They're a huge fan of your podcast (optional)"
                            className="w-full pl-8 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={160}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{mention2.length}/160</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

