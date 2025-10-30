import React, { useEffect, useRef, useState } from 'react';
import { CreditCardIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { createFortisIntention, verifyFortisTransaction } from '../services/fortisCommerceService';

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
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [commerceInstance, setCommerceInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'google'>('card');
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const successHandledRef = useRef(false);

  useEffect(() => {
    initializeFortis();
    // Listen for postMessage from Fortis iframe as a final fallback
    const onMessage = (event: MessageEvent) => {
      try {
        const origin = String(event.origin || '');
        if (!origin.includes('fortis.tech')) return;
        const data: any = event.data;
        console.log('iframe message from fortis', data);
        const hasId = !!(data?.transaction?.id || data?.data?.id || data?.id || data?.value?.id);
        const hasStatus = !!(data?.data?.status_code || data?.status_code || data?.reason_code_id || data?.value?.status_code || data?.value?.reason_code_id);
        if (hasId || hasStatus) handleMessageSuccess(data);
      } catch {
        // ignore malformed messages
      }
    };
    const handleMessageSuccess = (payload: any) => {
      if (successHandledRef.current) return;
      successHandledRef.current = true;
      console.log('iframe message transaction payload', payload);
      const txId = payload?.transaction?.id || payload?.data?.id || payload?.id || payload?.value?.id;
      if (txId) {
        verifyFortisTransaction(txId)
          .then((verify) => {
            setTimeout(() => onPaymentSuccess({ id: txId, statusCode: verify.statusCode, payload }), 0);
          })
          .catch((e) => {
            const msg = (e as any)?.message || 'Verification failed';
            setError(msg);
            onPaymentError(msg);
          });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const initializeFortis = async () => {
    try {
      setIsLoading(true);
      // Step 1: Create transaction intention via Supabase Edge Function
      const cents = Math.round(amount * 100);
      const intention = await createFortisIntention(cents);
      setOrderReference(intention.orderReference);

      // Step 2: Ensure Commerce is loaded (added in index.html as async script)
      const waitForCommerce = () => new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const i = setInterval(() => {
          attempts++;
          if ((window as any).Commerce?.elements) {
            clearInterval(i);
            resolve();
          }
          if (attempts > 100) {
            clearInterval(i);
            reject(new Error('Fortis Commerce JS failed to load'));
          }
        }, 100);
      });

      await waitForCommerce();

      const CommerceElements = (window as any).Commerce.elements;
      const instance = new CommerceElements(intention.clientToken, {
        params: {
          amount: cents / 100,
          currency_code: 'USD',
          order_reference: intention.orderReference,
          location_id: intention.locationId,
        },
      });

      // Helper to normalize success payloads
      const handleSuccess = async (payload: any) => {
        if (successHandledRef.current) return;
        successHandledRef.current = true;
        console.log('payment_success payload', payload);
        try {
          const txId = payload?.transaction?.id || payload?.data?.id || payload?.id;
          if (!txId) throw new Error('Missing transaction id');
          const verify = await verifyFortisTransaction(txId);
          setTimeout(() => onPaymentSuccess({ id: txId, statusCode: verify.statusCode, payload }), 0);
        } catch (e: any) {
          setError(e.message || 'Verification failed');
          onPaymentError(e.message || 'Verification failed');
        }
      };

      // Events (attach BEFORE create to avoid missing early events)
      console.log('Attaching Commerce JS handlers');
      instance.eventBus.on('ready', () => {
        console.log('Commerce iframe ready');
        setIsLoading(false);
      });
      instance.eventBus.on('payment_success', handleSuccess);
      // Add extra fallbacks in case library emits different event names
      instance.eventBus.on('success', handleSuccess as any);
      instance.eventBus.on('transaction_success', handleSuccess as any);
      instance.eventBus.on('transaction.completed', handleSuccess as any);
      instance.eventBus.on('payment_error', (e: any) => {
        setError(e?.message || 'Payment failed');
        onPaymentError(e?.message || 'Payment failed');
      });
      instance.eventBus.on('error', (e: any) => {
        setError(e?.message || 'Payment error');
      });

      // Create iframe in our container (pass selector string to avoid null ref timing)
      console.log('Creating Commerce iframe');
      // Render Fortis labels (Payment Info, Total) as white via dark theme
      instance.create({ container: '#fortis-card-element', theme: 'dark' });

      setCommerceInstance(instance);

    } catch (err) {
      console.error('Failed to initialize payment:', err);
      setError('Failed to load payment form. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commerceInstance) return;
    commerceInstance.submit();
  };

  // Apple Pay / Google Pay buttons are not needed here since Commerce JS iframe handles wallets

  // Always render container; show loading states within the form instead of returning early

  return (
    <div className="rounded-2xl px-4 py-5  md:p-6 bg-gradient-to-br from-slate-900/40 to-slate-800/20 border border-white/10 shadow-xl max-w-3xl mx-auto">
      <h3 className="text-xl font-semibold text-white mb-2">Payment Information</h3>
      <p className="text-sm text-slate-300 mb-6">Complete your payment securely. Your card information is encrypted and never stored on our servers.</p>
      
      {/* Payment Method Selection */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`flex items-center justify-center px-4 py-2 rounded-xl transition-all duration-200 border ${
              paymentMethod === 'card'
                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100 shadow'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            <CreditCardIcon className="h-5 w-5 mr-2" />
            Card
          </button>
          
          <button
            type="button"
            onClick={() => setPaymentMethod('apple')}
            className={`flex items-center justify-center px-4 py-2 rounded-xl transition-all duration-200 border ${
              paymentMethod === 'apple'
                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100 shadow'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
            Apple Pay
          </button>
          
          <button
            type="button"
            onClick={() => setPaymentMethod('google')}
            className={`flex items-center justify-center px-4 py-2 rounded-xl transition-all duration-200 border ${
              paymentMethod === 'google'
                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100 shadow'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
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
            <label className="block text-sm font-medium text-white mb-2">Payment Info</label>
            <p className="text-xs text-slate-300 mb-4">All major cards, Apple Pay, and Google Pay are supported.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Commerce.js iframe container - handles everything */}
          <div 
            id="fortis-card-element"
            ref={iframeContainerRef}
            className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-[#0F121A] p-10 max-w-2xl mx-auto"
            style={{ minHeight: '380px' }}
          />
          
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading payment form...</span>
            </div>
          )}
        </div>
      )}

      {/* Wallet buttons are rendered inside the Commerce iframe when available */}

      {/* Security Info */}
      <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-slate-300 text-center">
          🔒 Payments are processed securely in the embedded Fortis form.
        </p>
      </div>
    </div>
  );
};

export default FortisPaymentForm;
