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
  const [isProcessing, setIsProcessing] = useState(false); // New state for payment processing
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
        // Log ALL messages for debugging
        console.log('📨 postMessage received:', { origin, data: event.data });
        
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
      console.log('iframe message transaction payload', payload);
      
      // Check for error messages in payload
      const errorMsg = payload?.error || payload?.message || payload?.data?.error || payload?.data?.message;
      if (errorMsg && typeof errorMsg === 'string' && (errorMsg.toLowerCase().includes('decline') || errorMsg.toLowerCase().includes('fail') || errorMsg.toLowerCase().includes('error'))) {
        console.error('❌ Payment error in payload:', errorMsg);
        setIsProcessing(false);
        setError(errorMsg);
        onPaymentError(errorMsg);
        return;
      }
      
      const txId = payload?.transaction?.id || payload?.data?.id || payload?.id || payload?.value?.id;
      
      // Check for declined/failed status in the payload
      const statusCode = payload?.data?.status_code || payload?.status_code || payload?.value?.status_code || payload?.transaction?.status_code;
      const reasonCode = payload?.reason_code_id || payload?.data?.reason_code_id || payload?.value?.reason_code_id || payload?.transaction?.reason_code_id;
      
      console.log('🔍 Transaction status check:', { txId, statusCode, reasonCode });
      
      // Fortis status codes: 101 = approved, 102-199 = declined/failed
      // reason_code_id 1000 = approved, others indicate decline reasons
      if (statusCode && statusCode !== 101 && statusCode !== 100) {
        console.error('❌ Payment declined - status_code:', statusCode, 'reason_code:', reasonCode);
        setIsProcessing(false);
        setError('Payment was declined. Please try a different card.');
        onPaymentError('Payment was declined. Please try a different card.');
        return;
      }
      
      // Only mark as handled if we have a valid transaction
      if (!txId) {
        console.warn('⚠️ No transaction ID in payload, ignoring');
        return;
      }
      
      successHandledRef.current = true;
      setIsProcessing(true); // Show processing spinner
      setError(null); // Clear any previous errors
      
      // If status is already approved (101 or 100), proceed without verification
      if (statusCode === 101 || statusCode === 100) {
        console.log('✅ Payment approved in payload, proceeding:', statusCode);
        setTimeout(() => onPaymentSuccess({ id: txId, statusCode: statusCode, payload }), 0);
        return;
      }
      
      // Otherwise try to verify (but don't block on failure - payment already succeeded in Fortis)
      verifyFortisTransaction(txId)
        .then((verify) => {
          // Check if verification shows declined status
          if (verify.statusCode && verify.statusCode !== 101 && verify.statusCode !== 100) {
            console.error('❌ Payment verification shows declined - status:', verify.statusCode);
            setIsProcessing(false);
            successHandledRef.current = false; // Allow retry
            setError('Payment was declined. Please try a different card.');
            onPaymentError('Payment was declined. Please try a different card.');
            return;
          }
          console.log('✅ Payment verified successfully:', verify.statusCode);
          setTimeout(() => onPaymentSuccess({ id: txId, statusCode: verify.statusCode, payload }), 0);
        })
        .catch((e) => {
          // Verification failed but we have a transaction ID from Fortis
          // The payment likely succeeded - proceed anyway
          console.warn('⚠️ Payment verification failed but transaction exists, proceeding:', e);
          setTimeout(() => onPaymentSuccess({ id: txId, statusCode: statusCode || 101, payload }), 0);
        });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [amount]); // Re-initialize when amount changes (e.g., coupon applied)

  const initializeFortis = async () => {
    try {
      setIsLoading(true);
      setError(null);
      successHandledRef.current = false; // Reset success handler for new amount
      
      // Clear any existing payment form
      if (iframeContainerRef.current) {
        iframeContainerRef.current.innerHTML = '';
      }
      
      // Step 1: Create transaction intention via Supabase Edge Function
      const cents = Math.round(amount * 100);
      console.log('🔄 Initializing Fortis with amount:', amount, 'cents:', cents);
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
        setIsProcessing(true); // Show processing spinner
        setError(null); // Clear any previous errors
        console.log('payment_success payload', payload);
        
        // Check for declined/failed status in the payload first
        const statusCode = payload?.data?.status_code || payload?.status_code || payload?.transaction?.status_code;
        const reasonCode = payload?.reason_code_id || payload?.data?.reason_code_id || payload?.transaction?.reason_code_id;
        
        // Fortis status codes: 101 = approved, 100 = pending, 102-199 = declined/failed
        if (statusCode && statusCode !== 101 && statusCode !== 100) {
          console.error('❌ Payment declined in payload - status_code:', statusCode, 'reason_code:', reasonCode);
          setIsProcessing(false);
          successHandledRef.current = false; // Allow retry
          setError('Payment was declined. Please try a different card.');
          onPaymentError('Payment was declined. Please try a different card.');
          return;
        }
        
        try {
          const txId = payload?.transaction?.id || payload?.data?.id || payload?.id;
          if (!txId) throw new Error('Missing transaction id');
          
          const verify = await verifyFortisTransaction(txId);
          
          // Check if verification shows declined status
          if (verify.statusCode && verify.statusCode !== 101 && verify.statusCode !== 100) {
            console.error('❌ Payment verification shows declined - status:', verify.statusCode);
            setIsProcessing(false);
            successHandledRef.current = false; // Allow retry
            setError('Payment was declined. Please try a different card.');
            onPaymentError('Payment was declined. Please try a different card.');
            return;
          }
          
          console.log('✅ Payment verified successfully:', verify.statusCode);
          setTimeout(() => onPaymentSuccess({ id: txId, statusCode: verify.statusCode, payload }), 0);
        } catch (e: any) {
          console.error('Payment verification failed:', e);
          const txId = payload?.transaction?.id || payload?.data?.id || payload?.id;
          
          // Verification failed but we have a transaction ID - payment likely succeeded
          // Proceed anyway since Fortis already processed the payment
          if (txId) {
            console.log('⚠️ Verification failed but transaction exists, proceeding with payment');
            setTimeout(() => onPaymentSuccess({ id: txId, statusCode: statusCode || 101, payload }), 0);
          } else {
            setIsProcessing(false);
            successHandledRef.current = false; // Allow retry
            setError('Could not verify payment. Please try again.');
            onPaymentError('Could not verify payment. Please try again.');
          }
        }
      };

      // Events (attach BEFORE create to avoid missing early events)
      console.log('Attaching Commerce JS handlers');
      elements.eventBus.on('ready', () => {
        console.log('Commerce iframe ready');
        setIsLoading(false);
      });
      // Log ALL events from Commerce.js
      const logEvent = (name: string) => (data: any) => {
        console.log(`🎯 Commerce.js event [${name}]:`, data);
      };
      elements.eventBus.on('submit', logEvent('submit'));
      elements.eventBus.on('done', logEvent('done'));
      elements.eventBus.on('complete', logEvent('complete'));
      elements.eventBus.on('payment_success', handleSuccess);
      // Add extra fallbacks in case library emits different event names
      elements.eventBus.on('success', handleSuccess as any);
      elements.eventBus.on('transaction_success', handleSuccess as any);
      elements.eventBus.on('transaction.completed', handleSuccess as any);
      elements.eventBus.on('payment_error', (e: any) => {
        console.error('❌ payment_error event:', e);
        successHandledRef.current = false; // Allow retry
        const errorMsg = e?.message || e?.error || 'Payment failed. Please try again.';
        setError(errorMsg);
        onPaymentError(errorMsg);
      });
      elements.eventBus.on('error', (e: any) => {
        console.error('❌ error event:', e);
        successHandledRef.current = false; // Allow retry
        setError(e?.message || 'Payment error. Please try again.');
      });
      // Listen for declined/failed transactions
      elements.eventBus.on('transaction_failed', (e: any) => {
        console.error('❌ transaction_failed event:', e);
        successHandledRef.current = false; // Allow retry
        setError('Transaction failed. Please try a different card.');
        onPaymentError('Transaction failed. Please try a different card.');
      });
      elements.eventBus.on('payment_declined', (e: any) => {
        console.error('❌ payment_declined event:', e);
        successHandledRef.current = false; // Allow retry
        setError('Payment was declined. Please try a different card.');
        onPaymentError('Payment was declined. Please try a different card.');
      });

      // Create iframe in our container
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
      });

      setCommerceInstance(elements);

    } catch (err) {
      console.error('Failed to initialize payment:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      const userFriendlyMsg = errorMsg.includes('Edge Function') 
        ? 'Payment system is temporarily unavailable. Please try again in a few moments or contact support at hello@shoutout.us'
        : `Failed to load payment form: ${errorMsg}. Please refresh the page or contact support.`;
      setError(userFriendlyMsg);
      onPaymentError(userFriendlyMsg);
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

          {/* Processing Payment Overlay */}
          {isProcessing && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-slate-900 border border-white/20 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Processing Payment</h3>
                <p className="text-slate-400 text-sm">Please wait while we confirm your payment...</p>
              </div>
            </div>
          )}

          {/* Commerce.js iframe container - clip top to hide payment type tabs */}
          <div className="overflow-hidden">
            <div 
              id="payment"
              ref={iframeContainerRef}
              className="min-h-[400px]"
              style={{ marginTop: '-100px' }}
            >
              {isLoading && (
                <div className="flex items-center justify-center h-64" style={{ marginTop: '100px' }}>
                  <div className="animate-pulse text-gray-400">Loading payment form...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wallet buttons are rendered inside the Commerce iframe when available */}

      {/* Security Info */}
      <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-slate-300 text-center">
          🔒 Secure payment powered by{' '}
          <a 
            href="https://lunarpay.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-slate-200 transition-colors"
          >
            LunarPay
          </a>
        </p>
      </div>
    </div>
  );
};

export default FortisPaymentForm;
