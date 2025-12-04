import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircleIcon, HomeIcon, UserIcon } from '@heroicons/react/24/solid';
import { Helmet } from 'react-helmet-async';

// Declare ratag as a global function
declare global {
  interface Window {
    ratag: (event: string, options: { to: number; cid?: string; value?: number }) => void;
    _ratagData: any[];
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

  // Calculate conversion value (25% of order total)
  const orderAmount = amount ? parseFloat(amount) : 0;
  const conversionValue = orderAmount * 0.25;

  // Get Rumble click ID from sessionStorage
  const raclid = typeof window !== 'undefined' ? sessionStorage.getItem('rumble_raclid') : null;

  useEffect(() => {
    // Redirect if no order ID (shouldn't land here directly)
    if (!orderId) {
      navigate('/dashboard');
      return;
    }

    // Fire Rumble conversion on page load (only once)
    if (!conversionFiredRef.current && typeof window !== 'undefined') {
      conversionFiredRef.current = true;
      
      const cid = raclid || `order-${orderId}`;
      
      console.log('🔍 Rumble Ads - Order Success Page Load:', {
        orderId,
        amount: orderAmount,
        conversionValue,
        cid,
        ratagExists: typeof window.ratag,
        ratagDataExists: typeof window._ratagData
      });

      // Method 1: Direct ratag call (if function exists)
      if (typeof window.ratag === 'function') {
        console.log('📤 Calling ratag("conversion", {to: 3320, cid: "' + cid + '", value: ' + conversionValue + '})');
        window.ratag('conversion', {
          to: 3320,
          cid: cid,
          value: conversionValue
        });
        console.log('✅ Rumble ratag() called successfully');
      } 
      // Method 2: Push to _ratagData array (fallback)
      else if (window._ratagData) {
        console.log('📤 Pushing to _ratagData array');
        window._ratagData.push(['conversion', { to: 3320, cid: cid, value: conversionValue }]);
        console.log('✅ Rumble _ratagData.push() called successfully');
      }
      else {
        console.warn('⚠️ Rumble ratag not available - neither ratag() nor _ratagData found');
      }
    }
  }, [orderId, orderAmount, conversionValue, raclid, navigate]);

  if (!orderId) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Order Confirmed! | ShoutOut</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
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
              <li>• You'll receive an email confirmation</li>
              <li>• The talent will create your video within 7 days</li>
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

