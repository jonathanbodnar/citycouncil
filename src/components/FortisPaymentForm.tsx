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
  // Optional styling props to match page theme
  backgroundColor?: string;
  buttonColor?: string;
  buttonText?: string;
}

const FortisPaymentForm: React.FC<FortisPaymentFormProps> = ({
  amount,
  onPaymentSuccess,
  onPaymentError,
  backgroundColor = '#0f172a', // Default dark slate
  buttonColor = '#3b82f6', // Default blue
  buttonText,
}) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [commerceInstance, setCommerceInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
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
      elements.eventBus.on('done', handleSuccess as any); // Key event for custom submit
      elements.eventBus.on('transaction_success', handleSuccess as any);
      elements.eventBus.on('transaction.completed', handleSuccess as any);
      elements.eventBus.on('payment_error', (e: any) => {
        setError(e?.message || 'Payment failed');
        setIsProcessing(false);
        onPaymentError(e?.message || 'Payment failed');
      });
      elements.eventBus.on('error', (e: any) => {
        setError(e?.message || 'Payment error');
        setIsProcessing(false);
      });

      // Create iframe in our container (pass selector string to avoid null ref timing)
      // Using showSubmitButton: false so we can use our own custom styled button
      console.log('Creating Commerce iframe with appearance:', { backgroundColor, buttonColor });
      elements.create({
        container: '#payment',
        theme: 'dark',
        environment: 'production',
        view: 'default',
        language: 'en-us',
        defaultCountry: 'US',
        floatingLabels: true,
        showReceipt: false,
        showSubmitButton: false, // Hide Fortis's button, we'll use our own
        showValidationAnimation: true,
        hideAgreementCheckbox: false,
        hideTotal: true,
        digitalWallets: ['ApplePay', 'GooglePay'],
        appearance: {
          colorBackground: backgroundColor,
          colorButtonSelectedBackground: buttonColor,
          colorButtonSelectedText: '#ffffff',
          borderRadius: '8px',
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

  // Custom submit handler - triggers Fortis elements.submit()
  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!commerceInstance) {
      setError('Payment form not ready. Please wait or refresh the page.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // This triggers Fortis to validate and process the payment
      // The 'done' or 'payment_success' event will fire on completion
      commerceInstance.submit();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err?.message || 'Failed to submit payment');
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl">
      {/* Fortis Commerce.js Payment Form */}
      {paymentMethod === 'card' && (
        <div className="space-y-4">

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Commerce.js iframe container - handles everything */}
          {/* Wrapper with overflow hidden to clip the negative margin content */}
          <div style={{ 
            overflow: 'hidden', 
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
            <div 
              id="payment"
              ref={iframeContainerRef}
              className="fortis-payment-container"
              style={{
                background: backgroundColor,
                padding: '30px',
                paddingTop: '30px',
              }}
            />
            <style>{`
              .fortis-payment-container {
                margin-top: -135px;
                min-height: 400px;
              }
              @media (min-width: 1024px) {
                .fortis-payment-container {
                  margin-top: -220px;
                  min-height: 450px;
                }
              }
              @media (max-width: 680px) and (min-width: 516px) {
                .fortis-payment-container {
                  margin-top: -135px;
                  min-height: 400px;
                }
              }
              @media (max-width: 515px) {
                .fortis-payment-container {
                  margin-top: -230px;
                  min-height: 480px;
                }
              }
            `}</style>
          </div>
          
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading payment form...</span>
            </div>
          )}

          {/* Custom Submit Button */}
          {!isLoading && (
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={isProcessing || !commerceInstance}
              style={{
                backgroundColor: buttonColor,
                color: '#ffffff',
              }}
              className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Processing...
                </>
              ) : (
                buttonText || `Pay $${amount.toFixed(2)}`
              )}
            </button>
          )}
        </div>
      )}

      {/* Wallet buttons are rendered inside the Commerce iframe when available */}

      {/* Security Info */}
      <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-slate-300 text-center">
          🔒 Secure payment powered by <a href="https://lunarpay.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">LunarPay</a>
        </p>
      </div>
    </div>
  );
};

export default FortisPaymentForm;
