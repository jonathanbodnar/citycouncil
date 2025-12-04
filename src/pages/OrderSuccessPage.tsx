import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircleIcon, HomeIcon, UserIcon } from '@heroicons/react/24/solid';
import { Helmet } from 'react-helmet-async';

const OrderSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversionFired, setConversionFired] = useState(false);

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
    if (!conversionFired && typeof window !== 'undefined') {
      console.log('🔍 Rumble Ads - Order Success Page Load:', {
        orderId,
        amount: orderAmount,
        conversionValue,
        raclid,
        ratagExists: typeof (window as any).ratag
      });

      if (typeof (window as any).ratag === 'function') {
        (window as any).ratag('conversion', {
          to: 3320,
          cid: raclid || `order-${orderId}`,
          value: conversionValue,
          callback: function() {
            console.log('✅ Rumble Ads conversion callback fired!');
          }
        });
        console.log('✅ Rumble Ads conversion triggered on page load');
      }
      setConversionFired(true);
    }
  }, [orderId, orderAmount, conversionValue, raclid, conversionFired, navigate]);

  if (!orderId) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Order Confirmed! | ShoutOut</title>
        {/* Rumble Ads conversion script - fires on page load */}
        <script>
          {`
            (function() {
              var raclid = sessionStorage.getItem('rumble_raclid');
              var conversionValue = ${conversionValue};
              var orderId = '${orderId}';
              
              console.log('🔍 Rumble inline script:', { raclid: raclid, value: conversionValue, orderId: orderId });
              
              if (typeof ratag === 'function') {
                ratag('conversion', {
                  to: 3320,
                  cid: raclid || ('order-' + orderId),
                  value: conversionValue
                });
                console.log('✅ Rumble conversion fired from inline script');
              } else {
                console.warn('⚠️ ratag function not available');
              }
            })();
          `}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="h-12 w-12 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Order Confirmed! 🎉
          </h1>

          {/* Subtitle */}
          <p className="text-gray-600 mb-6">
            Thank you for your order! {talentName && `${talentName} has been notified and will create your personalized video soon.`}
          </p>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-mono text-sm text-gray-900">{orderId?.slice(0, 8)}...</span>
            </div>
            {orderAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-semibold text-gray-900">${orderAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* What's Next */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• You'll receive an email confirmation</li>
              <li>• The talent will create your video within 7 days</li>
              <li>• We'll notify you when it's ready!</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              <HomeIcon className="h-5 w-5" />
              Home
            </Link>
            <Link
              to="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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

