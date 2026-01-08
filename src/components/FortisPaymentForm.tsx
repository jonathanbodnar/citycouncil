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
  onPaymentSuccess,
  onPaymentError,
}) => {
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
        // Check immediately first (might already be loaded)
        if ((window as any).Commerce?.elements) {
          resolve();
          return;
        }
        
        let attempts = 0;
        const i = setInterval(() => {
          attempts++;
          if ((window as any).Commerce?.elements) {
            clearInterval(i);
            resolve();
          }
          if (attempts > 50) { // Reduced from 100 to 50 (5 seconds max instead of 10)
            clearInterval(i);
            reject(new Error('Fortis Commerce JS failed to load'));
          }
        }, 100);
      });

      await waitForCommerce();

      const ElementsCtor = (window as any).Commerce?.elements;
      if (!ElementsCtor) throw new Error('Commerce elements not available');
      const elements = new ElementsCtor(intention.clientToken);

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
      elements.eventBus.on('ready', () => {
        console.log('Commerce iframe ready');
        setIsLoading(false);
      });
      elements.eventBus.on('payment_success', handleSuccess);
      // Add extra fallbacks in case library emits different event names
      elements.eventBus.on('success', handleSuccess as any);
      elements.eventBus.on('transaction_success', handleSuccess as any);
      elements.eventBus.on('transaction.completed', handleSuccess as any);
      elements.eventBus.on('payment_error', (e: any) => {
        setError(e?.message || 'Payment failed');
        onPaymentError(e?.message || 'Payment failed');
      });
      elements.eventBus.on('error', (e: any) => {
        setError(e?.message || 'Payment error');
      });

      // Create iframe in our container (pass selector string to avoid null ref timing)
      console.log('Creating Commerce iframe');
      elements.create({
        container: '#payment',
        theme: 'dark',
        environment: 'production',
        view: 'default',
        language: 'en-us',
        defaultCountry: 'US',
        floatingLabels: true,
        showReceipt: false,
        showSubmitButton: true,
        showValidationAnimation: true,
        hideAgreementCheckbox: false,
        hideTotal: true,
        digitalWallets: ['ApplePay', 'GooglePay'],
        appearance: {
          colorBackground: 'transparent',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
      });

      setCommerceInstance(elements);

    } catch (err) {
      console.error('Failed to initialize payment:', err);
      setError('Failed to load payment form. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="rounded-2xl px-4 py-5 md:p-6 max-w-3xl mx-auto">
      {/* Fortis Commerce.js Payment Form */}
      {paymentMethod === 'card' && (
        <div className="space-y-4">

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Commerce.js iframe container - handles everything */}
          <div 
            id="payment"
            ref={iframeContainerRef}
            style={{
              background: '#11161f',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              minHeight: '400px'
            }}
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
