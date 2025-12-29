import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface TalentProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  temp_avatar_url?: string;
  admin_fee_percentage?: number;
  fortis_vendor_id?: string;
  fulfillment_time_hours?: number;
}

interface BioSettings {
  gradient_start?: string;
  gradient_end?: string;
  gradient_direction?: string;
  button_color?: string;
  button_style?: string;
  text_color?: string;
  display_name?: string;
  profile_image_url?: string;
}

interface ServiceOffering {
  id: string;
  talent_id: string;
  service_type: string;
  pricing: number;
  title: string;
  description?: string;
  video_length_seconds: number;
  benefits: string[];
  is_active: boolean;
}

interface User {
  id: string;
  email: string;
  full_name: string;
}

type Step = 'register' | 'details' | 'payment' | 'success';

interface OrderDetails {
  companyName: string;
  suggestedScript: string;
  targetAudience: string;
  additionalNotes: string;
}

const CollabOrderPage: React.FC = () => {
  const { username, serviceId } = useParams<{ username: string; serviceId: string }>();
  const navigate = useNavigate();
  
  const [talent, setTalent] = useState<TalentProfile | null>(null);
  const [bioSettings, setBioSettings] = useState<BioSettings | null>(null);
  const [service, setService] = useState<ServiceOffering | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('register');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  
  // Registration form
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Order details form
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({
    companyName: '',
    suggestedScript: '',
    targetAudience: '',
    additionalNotes: '',
  });
  
  // Payment
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [, setCommerceInstance] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const successHandledRef = useRef(false);

  useEffect(() => {
    fetchData();
    checkExistingUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, serviceId]);

  const fetchData = async () => {
    if (!username || !serviceId) {
      setLoading(false);
      return;
    }

    try {
      // Get talent profile
      let { data: profile } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!profile) {
        const { data: profileById } = await supabase
          .from('talent_profiles')
          .select('*')
          .eq('id', username)
          .single();
        profile = profileById;
      }

      if (!profile) {
        toast.error('Talent not found');
        navigate('/');
        return;
      }

      setTalent(profile);

      // Get bio settings for styling
      const { data: settings } = await supabase
        .from('bio_settings')
        .select('*')
        .eq('talent_id', profile.id)
        .single();

      if (settings) {
        setBioSettings(settings);
      }

      // Get service offering
      const { data: serviceData, error: serviceError } = await supabase
        .from('service_offerings')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (serviceError || !serviceData) {
        toast.error('Service not found');
        navigate(`/${username}`);
        return;
      }

      setService(serviceData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingUser = async () => {
    const savedUser = localStorage.getItem('collab_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setStep('details');
      } catch {
        localStorage.removeItem('collab_user');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        setUser(existingUser);
        localStorage.setItem('collab_user', JSON.stringify(existingUser));
        setStep('details');
        toast.success('Welcome back!');
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password: crypto.randomUUID(),
          options: {
            data: { full_name: fullName },
          },
        });

        if (authError) throw authError;

        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user?.id,
            email: email.toLowerCase(),
            full_name: fullName,
            phone: phone || null,
            user_type: 'user',
          })
          .select()
          .single();

        if (userError) throw userError;

        setUser(newUser);
        localStorage.setItem('collab_user', JSON.stringify(newUser));
        setStep('details');
        toast.success('Account created!');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !talent || !service) return;
    
    setStep('payment');
    setTimeout(() => initializeFortis(service.pricing / 100), 100);
  };

  const initializeFortis = async (amount: number) => {
    try {
      const amountCents = Math.round(amount * 100);
      console.log('🔄 Initializing Fortis with amount:', amount, 'cents:', amountCents);
      
      const { data: intentionData, error: intentionError } = await supabase.functions.invoke('fortis-intention', {
        body: { amount_cents: amountCents },
      });

      if (intentionError) {
        throw new Error(intentionError.message || 'Failed to create payment intention');
      }

      const { clientToken } = intentionData;

      const waitForCommerce = () => new Promise<void>((resolve, reject) => {
        if ((window as any).Commerce?.elements) {
          resolve();
          return;
        }
        
        if (!document.querySelector('script[src*="commercejs"]')) {
          const script = document.createElement('script');
          script.src = 'https://js.fortis.tech/commercejs-v1.0.0.min.js';
          script.async = true;
          document.body.appendChild(script);
        }
        
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if ((window as any).Commerce?.elements) {
            clearInterval(interval);
            resolve();
          }
          if (attempts > 50) {
            clearInterval(interval);
            reject(new Error('Fortis Commerce JS failed to load'));
          }
        }, 100);
      });

      await waitForCommerce();

      const ElementsCtor = (window as any).Commerce?.elements;
      if (!ElementsCtor) throw new Error('Commerce elements not available');
      
      const elements = new ElementsCtor(clientToken);

      const handlePaymentSuccess = async (payload: any) => {
        if (successHandledRef.current) return;
        successHandledRef.current = true;
        setIsProcessing(true);

        console.log('payment_success payload', payload);
        const txId = payload?.transaction?.id || payload?.data?.id || payload?.id;

        try {
          if (!user || !talent || !service) {
            throw new Error('Missing required data');
          }

          const adminFeePercent = talent.admin_fee_percentage ?? 15;
          const adminFee = Math.round(service.pricing * (adminFeePercent / 100));
          
          const fulfillmentDeadline = new Date();
          const fulfillmentHours = talent.fulfillment_time_hours || 168;
          fulfillmentDeadline.setHours(fulfillmentDeadline.getHours() + fulfillmentHours);

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              user_id: user.id,
              talent_id: talent.id,
              service_offering_id: service.id,
              service_type: 'social_collab',
              amount: service.pricing,
              admin_fee: adminFee,
              status: 'pending',
              approval_status: 'approved',
              approved_at: new Date().toISOString(),
              is_corporate: true,
              is_corporate_order: true,
              company_name: orderDetails.companyName,
              suggested_script: orderDetails.suggestedScript,
              target_audience: orderDetails.targetAudience,
              request_details: orderDetails.additionalNotes || `Social Collab: ${service.title}`,
              details_submitted: true,
              fulfillment_deadline: fulfillmentDeadline.toISOString(),
              payment_transaction_id: txId,
              payment_transaction_payload: payload,
            })
            .select()
            .single();

          if (orderError) throw orderError;

          console.log('✅ Order created:', order.id);
          setCreatedOrderId(order.id);
          setStep('success');
          toast.success('Order placed successfully!');
          
        } catch (error) {
          console.error('Error creating order:', error);
          toast.error('Payment received but order creation failed. Please contact support.');
        } finally {
          setIsProcessing(false);
        }
      };

      console.log('Attaching Commerce JS handlers');
      elements.eventBus.on('ready', () => console.log('Commerce iframe ready'));
      elements.eventBus.on('payment_success', handlePaymentSuccess);
      elements.eventBus.on('success', handlePaymentSuccess);
      elements.eventBus.on('done', handlePaymentSuccess);
      elements.eventBus.on('payment_error', (e: any) => {
        console.error('Payment error:', e);
        successHandledRef.current = false;
        toast.error(e?.message || 'Payment failed. Please try again.');
      });
      elements.eventBus.on('error', (e: any) => {
        console.error('Error:', e);
        successHandledRef.current = false;
        toast.error(e?.message || 'Payment error. Please try again.');
      });

      console.log('Creating Commerce iframe');
      elements.create({
        container: '#fortis-payment-container',
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
        hideTotal: false,
      });

      setCommerceInstance(elements);
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      toast.error('Failed to load payment form');
    }
  };

  // Get styling from bio settings
  const gradientDirection = bioSettings?.gradient_direction === 'to-b' ? '180deg' : '135deg';
  const gradientStart = bioSettings?.gradient_start || '#0a0a0a';
  const gradientEnd = bioSettings?.gradient_end || '#1a1a2e';
  const buttonColor = bioSettings?.button_color || '#ec4899'; // Pink default for collab
  const displayName = bioSettings?.display_name || talent?.full_name || 'Creator';
  const profileImage = bioSettings?.profile_image_url || talent?.temp_avatar_url;

  // Button style helper
  const getButtonRadius = () => {
    switch (bioSettings?.button_style) {
      case 'pill': return '9999px';
      case 'square': return '0.5rem';
      default: return '0.75rem';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!talent || !service) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Service Not Found</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const price = service.pricing / 100;

  return (
    <div 
      className="min-h-screen"
      style={{
        background: `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Header - matches bio page style */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-white/20 shadow-xl">
            {profileImage ? (
              <img src={profileImage} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-2xl text-white font-bold">
                {displayName[0]}
              </div>
            )}
          </div>
          <p className="text-pink-400 text-sm font-medium">Instagram Collab</p>
          <h1 className="text-2xl font-bold text-white">{service.title}</h1>
          <p className="text-gray-400">with {displayName}</p>
          <p className="text-3xl font-bold text-white mt-2">${price.toFixed(0)}</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Account', 'Details', 'Payment', 'Done'].map((label, idx) => {
            const stepNum = idx + 1;
            const currentStepNum = step === 'register' ? 1 : step === 'details' ? 2 : step === 'payment' ? 3 : 4;
            const isComplete = stepNum < currentStepNum;
            const isCurrent = stepNum === currentStepNum;
            
            return (
              <React.Fragment key={label}>
                {idx > 0 && (
                  <div className={`h-0.5 w-8 ${isComplete ? 'bg-white/60' : 'bg-white/20'}`} style={isComplete ? { backgroundColor: buttonColor } : {}} />
                )}
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      isComplete || isCurrent ? 'text-white' : 'bg-white/10 text-gray-500'
                    }`}
                    style={(isComplete || isCurrent) ? { backgroundColor: buttonColor } : {}}
                  >
                    {isComplete ? '✓' : stepNum}
                  </div>
                  <span className={`text-xs mt-1 ${isCurrent ? 'text-white' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content - glass card style */}
        <div className="flex-1">
          <div 
            className="backdrop-blur-md border border-white/20 p-6"
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: getButtonRadius(),
            }}
          >
            {/* Registration Step */}
            {step === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <h2 className="text-xl font-semibold text-white mb-4">Create Account</h2>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="you@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                >
                  {submitting ? 'Creating Account...' : 'Continue'}
                </button>
              </form>
            )}

            {/* Details Step */}
            {step === 'details' && (
              <form onSubmit={handleSubmitDetails} className="space-y-4">
                <h2 className="text-xl font-semibold text-white mb-4">Collab Details</h2>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Brand/Company Name *</label>
                  <input
                    type="text"
                    value={orderDetails.companyName}
                    onChange={(e) => setOrderDetails({ ...orderDetails, companyName: e.target.value })}
                    required
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="Your brand or company"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target Audience *</label>
                  <input
                    type="text"
                    value={orderDetails.targetAudience}
                    onChange={(e) => setOrderDetails({ ...orderDetails, targetAudience: e.target.value })}
                    required
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="Who is this content for?"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Suggested Script/Talking Points</label>
                  <textarea
                    value={orderDetails.suggestedScript}
                    onChange={(e) => setOrderDetails({ ...orderDetails, suggestedScript: e.target.value })}
                    rows={4}
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 resize-none"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="What would you like them to say or cover?"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Additional Notes</label>
                  <textarea
                    value={orderDetails.additionalNotes}
                    onChange={(e) => setOrderDetails({ ...orderDetails, additionalNotes: e.target.value })}
                    rows={2}
                    className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 resize-none"
                    style={{ borderRadius: getButtonRadius() }}
                    placeholder="Any other details..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                >
                  Continue to Payment
                </button>
              </form>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Payment</h2>
                
                {/* Order Summary */}
                <div 
                  className="bg-white/5 p-4 mb-6"
                  style={{ borderRadius: getButtonRadius() }}
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">{service.title}</span>
                    <span className="text-white">${price.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-white font-semibold">${price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Form Container */}
                <div 
                  id="fortis-payment-container" 
                  ref={iframeContainerRef}
                  className="min-h-[300px] bg-white/5 p-4"
                  style={{ borderRadius: getButtonRadius() }}
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: buttonColor }}></div>
                      <p className="text-gray-400">Processing payment...</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-pulse text-gray-400">Loading payment form...</div>
                    </div>
                  )}
                </div>

                <p className="text-center text-gray-500 text-xs mt-4">
                  Secure payment powered by Fortis
                </p>
              </div>
            )}

            {/* Success Step */}
            {step === 'success' && (
              <div className="text-center py-8">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: `${buttonColor}20` }}
                >
                  <svg className="w-10 h-10" style={{ color: buttonColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Order Placed!</h2>
                <p className="text-gray-400 mb-6">
                  {displayName} has been notified and will start working on your collab soon.
                </p>

                <div 
                  className="bg-white/5 p-4 mb-6 text-left"
                  style={{ borderRadius: getButtonRadius() }}
                >
                  <h3 className="text-white font-semibold mb-2">What's Next?</h3>
                  <ul className="space-y-2 text-gray-400 text-sm">
                    <li>• {displayName} will review your request</li>
                    <li>• You'll receive an email when your content is ready</li>
                    <li>• Track your order status in your dashboard</li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    // Clear saved user and redirect to ShoutOut dashboard
                    localStorage.removeItem('collab_user');
                    window.location.href = `https://shoutout.us/dashboard${createdOrderId ? `?order=${createdOrderId}` : ''}`;
                  }}
                  className="w-full py-4 text-white font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                >
                  View Order
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a 
            href={`/${username}`}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            ← Back to {displayName}'s profile
          </a>
        </div>
      </div>
    </div>
  );
};

export default CollabOrderPage;
