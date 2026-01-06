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
  platforms: string[]; // Which platforms are included
  is_active: boolean;
}

// Platform info for display
const PLATFORM_INFO: Record<string, { name: string; icon: React.ReactNode; placeholder: string }> = {
  instagram: { 
    name: 'Instagram', 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    placeholder: '@yourusername'
  },
  tiktok: { 
    name: 'TikTok', 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>,
    placeholder: '@yourusername'
  },
  youtube: { 
    name: 'YouTube', 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    placeholder: '@channelname'
  },
  twitter: { 
    name: 'X (Twitter)', 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    placeholder: '@yourusername'
  },
  facebook: { 
    name: 'Facebook', 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    placeholder: 'facebook.com/yourpage'
  },
};

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
  customerSocials: Record<string, string>; // platform -> handle
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
    customerSocials: {},
  });
  
  // Payment
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [, setCommerceInstance] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const successHandledRef = useRef(false);
  
  // Login mode
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

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
    // First check for Supabase session (logged in on shoutout.us)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // User is logged in via Supabase, fetch their profile
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (existingUser) {
          setUser(existingUser);
          localStorage.setItem('collab_user', JSON.stringify(existingUser));
          setStep('details');
          return;
        }
      }
    } catch (error) {
      console.log('No active session:', error);
    }
    
    // Fallback to localStorage
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail.toLowerCase(),
        password: loginPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (existingUser) {
          setUser(existingUser);
          localStorage.setItem('collab_user', JSON.stringify(existingUser));
          setStep('details');
          toast.success('Welcome back!');
        } else {
          throw new Error('User profile not found');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Check your email and password.');
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
      
      let intentionData;
      let intentionError;
      
      try {
        const response = await supabase.functions.invoke('fortis-intention', {
          body: { amount_cents: amountCents },
        });
        intentionData = response.data;
        intentionError = response.error;
        console.log('Fortis intention response:', { data: intentionData, error: intentionError });
      } catch (fetchError: any) {
        console.error('Network error calling fortis-intention:', fetchError);
        throw new Error(`Network error: ${fetchError.message || 'Failed to connect to payment service'}`);
      }

      if (intentionError) {
        console.error('Fortis intention error:', intentionError);
        throw new Error(intentionError.message || 'Failed to create payment intention');
      }
      
      if (!intentionData) {
        throw new Error('No response from payment service');
      }

      const { clientToken } = intentionData;
      
      if (!clientToken) {
        console.error('No client token in response:', intentionData);
        throw new Error('Payment service did not return a valid token');
      }

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
              customer_socials: orderDetails.customerSocials,
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
      
      // Get theme color - use bio button color or default pink
      const themeButtonColor = bioSettings?.button_color || '#ec4899';
      
      // Fortis Commerce.js v1.0.0 - use dark theme which has proper dark inputs
      // fontFamily MUST be: Roboto, Montserrat, OpenSans, Raleway, SourceCode, or SourceSans
      elements.create({
        container: '#fortis-payment-container',
        theme: 'dark',  // Use dark theme for dark input fields
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
        appearance: {
          // Override button colors to match theme
          colorButtonSelectedBackground: themeButtonColor,
          colorButtonSelectedText: '#ffffff',
          fontFamily: 'Montserrat',
          borderRadius: '8px',
        },
      });
      
      console.log('Commerce iframe created with theme color:', themeButtonColor);

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
  // Always use pink for collab buttons - don't use bio button color as it might be white/light
  const buttonColor = '#ec4899'; // Pink for collab
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
              <div className="space-y-4">
                {showLoginForm ? (
                  /* Login Form */
                  <form onSubmit={handleLogin} className="space-y-4">
                    <h2 className="text-xl font-semibold text-white mb-4">Login to ShoutOut</h2>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                        style={{ borderRadius: getButtonRadius() }}
                        placeholder="you@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Password</label>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                        style={{ borderRadius: getButtonRadius() }}
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                    >
                      {submitting ? 'Logging in...' : 'Login'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLoginForm(false)}
                      className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      Don't have an account? Create one
                    </button>
                  </form>
                ) : (
                  /* Registration Form */
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

                    {/* Divider */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 text-gray-500" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>or</span>
                      </div>
                    </div>

                    {/* Login with ShoutOut */}
                    <button
                      type="button"
                      onClick={() => setShowLoginForm(true)}
                      className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 border border-red-500/30 text-white font-semibold transition-all hover:from-red-500 hover:to-red-600 flex items-center justify-center gap-3 shadow-lg"
                      style={{ borderRadius: getButtonRadius() }}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2s2-.9 2-2V4c0-1.1-.9-2-2-2zm6.5 9c0 1.93-.63 3.71-1.68 5.15l1.42 1.42C19.45 15.84 20.5 13.52 20.5 11s-1.05-4.84-2.26-6.57l-1.42 1.42C18.37 7.29 18.5 9.07 18.5 11zm-2-5.15l-1.42 1.42C15.63 7.71 16 9.27 16 11s-.37 3.29-.92 3.73l1.42 1.42c.9-1.05 1.5-2.38 1.5-3.85s-.6-2.8-1.5-3.85zM3.5 9v6h3l3.5 2.5V6.5L6.5 9h-3z"/>
                      </svg>
                      Login with ShoutOut
                    </button>
                  </form>
                )}

                {/* ShoutOut Logo at bottom */}
                <div className="pt-6 flex flex-col items-center">
                  <p className="text-gray-500 text-xs mb-2">Powered by</p>
                  <div className="flex items-center gap-2 opacity-60">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2s2-.9 2-2V4c0-1.1-.9-2-2-2zm6.5 9c0 1.93-.63 3.71-1.68 5.15l1.42 1.42C19.45 15.84 20.5 13.52 20.5 11s-1.05-4.84-2.26-6.57l-1.42 1.42C18.37 7.29 18.5 9.07 18.5 11zm-2-5.15l-1.42 1.42C15.63 7.71 16 9.27 16 11s-.37 3.29-.92 3.73l1.42 1.42c.9-1.05 1.5-2.38 1.5-3.85s-.6-2.8-1.5-3.85zM3.5 9v6h3l3.5 2.5V6.5L6.5 9h-3z"/>
                    </svg>
                    <span className="text-white font-semibold text-sm">ShoutOut</span>
                  </div>
                </div>
              </div>
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

                {/* Social Handles - only show for platforms in the service */}
                {service.platforms && service.platforms.length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Your Social Handles *</label>
                    <p className="text-xs text-gray-500 mb-3">Enter your username for each platform included in this collab</p>
                    <div className="space-y-3">
                      {service.platforms.map((platform) => {
                        const info = PLATFORM_INFO[platform];
                        if (!info) return null;
                        return (
                          <div key={platform} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-gray-400">
                              {info.icon}
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={orderDetails.customerSocials[platform] || ''}
                                onChange={(e) => setOrderDetails({
                                  ...orderDetails,
                                  customerSocials: {
                                    ...orderDetails.customerSocials,
                                    [platform]: e.target.value
                                  }
                                })}
                                required
                                className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                                style={{ borderRadius: getButtonRadius() }}
                                placeholder={info.placeholder}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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

                {/* Payment Form Container - clean styling */}
                <div 
                  id="fortis-payment-container" 
                  ref={iframeContainerRef}
                  className="min-h-[400px] -mx-2"
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

                <p className="text-center text-gray-500 text-xs mt-2">
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
