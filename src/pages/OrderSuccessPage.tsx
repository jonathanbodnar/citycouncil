import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircleIcon, HomeIcon, UserIcon } from '@heroicons/react/24/solid';
import { Helmet } from 'react-helmet-async';

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

  // Get order details from URL params
  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const talentName = searchParams.get('talent');
  const deliveryHours = searchParams.get('delivery_hours');

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

      <div className="flex items-center justify-center p-4 py-12" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="max-w-md w-full rounded-2xl shadow-2xl p-8 text-center border border-white/10" style={{ background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))' }}>
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <CheckCircleIcon className="h-12 w-12 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Order Confirmed! 🎉
          </h1>

          {/* Subtitle */}
          <p className="text-gray-300 mb-6">
            Thank you for your order! {talentName && `${talentName} has been notified and will create your personalized video soon.`}
          </p>

          {/* Order Details */}
          <div className="rounded-xl p-4 mb-6 text-left border border-white/10" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Order ID:</span>
              <span className="font-mono text-sm text-white">{orderId?.slice(0, 8)}...</span>
            </div>
            {orderAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Amount Paid:</span>
                <span className="font-semibold text-green-400">${orderAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* What's Next */}
          <div className="rounded-xl p-4 mb-6 text-left border border-blue-500/20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
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
              to="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            >
              <UserIcon className="h-5 w-5" />
              My Orders
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderSuccessPage;

