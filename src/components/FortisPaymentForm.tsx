import React, { useEffect, useRef, useState } from 'react';
import { CreditCardIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { lunarPayService } from '../services/lunarPayService';
import { useAuth } from '../context/AuthContext';

interface FortisPaymentFormProps {
  amount: number;
  orderId: string;
  customerEmail: string;
  customerName: string;
  description: string;
  onPaymentSuccess: (paymentResult: any) => void;
  onPaymentError: (error: string) => void;
  loading?: boolean;
}

const FortisPaymentForm: React.FC<FortisPaymentFormProps> = ({
  amount,
  orderId,
  customerEmail,
  customerName,
  description,
  onPaymentSuccess,
  onPaymentError,
  loading = false
}) => {
  const { user } = useAuth();
  const cardElementRef = useRef<any>(null);
  const [fortisElements, setFortisElements] = useState<{ elements: any; cardElement: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'google'>('card');
  const [paymentIntention, setPaymentIntention] = useState<any>(null);

  useEffect(() => {
    initializeFortis();
  }, []);

  const initializeFortis = async () => {
    try {
      setIsLoading(true);
      
      // Step 1: Create transaction intention from LunarPay for Fortis Commerce.js
      const intentionResult = await lunarPayService.createTransactionIntention({
        amount,
        currency: 'USD',
        orderId,
        customerEmail,
        customerName,
        description,
        metadata: {
          user_id: user?.id,
        }
      });

      if (!intentionResult.success) {
        throw new Error(intentionResult.error || 'Failed to create payment intention');
      }

      setPaymentIntention(intentionResult);

      // Step 2: Initialize Fortis Commerce.js with client_token
      const { elements } = await lunarPayService.initializeFortisCommerce(
        'fortis-card-element', 
        intentionResult.clientSecret // This is the client_token from LunarPay
      );

      setFortisElements({ elements, cardElement: null });
      cardElementRef.current = elements;

      // Commerce.js handles validation and events internally

    } catch (err) {
      console.error('Failed to initialize payment:', err);
      setError('Failed to load payment form. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Commerce.js handles payment processing automatically through the iframe
    // Payment success/error will be handled through Commerce.js events
    console.log('Commerce.js will handle payment processing automatically');
  };

  const handleApplePay = async () => {
    if (!fortisElements || !paymentIntention) return;

    try {
      setIsLoading(true);
      
      // Create Apple Pay payment method
      const { error: paymentError, paymentMethod } = await fortisElements!.elements.createPaymentMethod({
        type: 'apple_pay',
        amount: Math.round(amount * 100),
        currency: 'usd',
        country: 'US',
      });

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      // Confirm payment with Fortis Elements
      const { error: confirmError, paymentIntent } = await fortisElements!.elements.confirmPayment({
        clientSecret: paymentIntention.clientSecret,
        paymentMethod,
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      // Send result back to LunarPay
      const confirmationResult = await lunarPayService.confirmPayment({
        intentionId: paymentIntention.intentionId,
        paymentResult: paymentIntent,
        orderId,
      });

      if (!confirmationResult.success) {
        throw new Error(confirmationResult.error || 'Payment confirmation failed');
      }

      onPaymentSuccess(confirmationResult);
    } catch (err: any) {
      setError(err.message);
      onPaymentError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGooglePay = async () => {
    if (!fortisElements || !paymentIntention) return;

    try {
      setIsLoading(true);
      
      // Create Google Pay payment method
      const { error: paymentError, paymentMethod } = await fortisElements!.elements.createPaymentMethod({
        type: 'google_pay',
        amount: Math.round(amount * 100),
        currency: 'usd',
        country: 'US',
      });

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      // Confirm payment with Fortis Elements
      const { error: confirmError, paymentIntent } = await fortisElements!.elements.confirmPayment({
        clientSecret: paymentIntention.clientSecret,
        paymentMethod,
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      // Send result back to LunarPay
      const confirmationResult = await lunarPayService.confirmPayment({
        intentionId: paymentIntention.intentionId,
        paymentResult: paymentIntent,
        orderId,
      });

      if (!confirmationResult.success) {
        throw new Error(confirmationResult.error || 'Payment confirmation failed');
      }

      onPaymentSuccess(confirmationResult);
    } catch (err: any) {
      setError(err.message);
      onPaymentError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
      
      {/* Payment Method Selection */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`flex items-center justify-center p-3 border rounded-lg transition-colors ${
              paymentMethod === 'card'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <CreditCardIcon className="h-5 w-5 mr-2" />
            Card
          </button>
          
          <button
            type="button"
            onClick={() => setPaymentMethod('apple')}
            className={`flex items-center justify-center p-3 border rounded-lg transition-colors ${
              paymentMethod === 'apple'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
            Apple Pay
          </button>
          
          <button
            type="button"
            onClick={() => setPaymentMethod('google')}
            className={`flex items-center justify-center p-3 border rounded-lg transition-colors ${
              paymentMethod === 'google'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
            Google Pay
          </button>
        </div>
      </div>

      {/* Fortis Commerce.js Payment Form */}
      {paymentMethod === 'card' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Information
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Complete your payment securely. Your card information is encrypted and never stored on our servers.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Commerce.js iframe container - handles everything */}
          <div 
            id="fortis-card-element"
            className="border border-gray-300 rounded-lg overflow-hidden"
            style={{ minHeight: '400px' }}
          />
          
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading payment form...</span>
            </div>
          )}
        </div>
      )}

      {/* Apple Pay */}
      {paymentMethod === 'apple' && (
        <div>
          <button
            onClick={handleApplePay}
            disabled={loading || isLoading}
            className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading || isLoading ? 'Processing...' : '🍎 Pay with Apple Pay'}
          </button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Google Pay */}
      {paymentMethod === 'google' && (
        <div>
          <button
            onClick={handleGooglePay}
            disabled={loading || isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading || isLoading ? 'Processing...' : 'G Pay with Google Pay'}
          </button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Security Info */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600 text-center">
          🔒 Your payment information is secure and encrypted. Powered by Fortis.
        </p>
      </div>
    </div>
  );
};

export default FortisPaymentForm;
