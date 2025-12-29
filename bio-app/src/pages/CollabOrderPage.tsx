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

const CollabOrderPage: React.FC = () => {
  const { username, serviceId } = useParams<{ username: string; serviceId: string }>();
  const navigate = useNavigate();
  
  const [talent, setTalent] = useState<TalentProfile | null>(null);
  const [service, setService] = useState<ServiceOffering | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('register');
  const [submitting, setSubmitting] = useState(false);
  
  // Registration form
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Order details form
  const [companyName, setCompanyName] = useState('');
  const [suggestedScript, setSuggestedScript] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  // Payment
  const [orderId, setOrderId] = useState<string | null>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [commerceInstance, setCommerceInstance] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const successHandledRef = useRef(false);

  useEffect(() => {
    fetchData();
    checkExistingUser();
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
        toast.error('Creator not found');
        navigate('/');
        return;
      }

      setTalent(profile);

      // Get service offering
      const { data: serviceData } = await supabase
        .from('service_offerings')
        .select('*')
        .eq('id', serviceId)
        .eq('talent_id', profile.id)
        .eq('is_active', true)
        .single();

      if (!serviceData) {
        toast.error('Service not found');
        navigate(`/bio/${username}`);
        return;
      }

      setService({
        ...serviceData,
        benefits: Array.isArray(serviceData.benefits) 
          ? serviceData.benefits 
          : JSON.parse(serviceData.benefits || '[]'),
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (userData) {
        setUser(userData);
        setEmail(userData.email);
        setFullName(userData.full_name);
        setPhone(userData.phone || '');
        setStep('details');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Check if user exists by email
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        // User exists - sign them in with magic link or proceed
        setUser(existingUser);
        setStep('details');
        toast.success('Welcome back!');
      } else {
        // Create new user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password: crypto.randomUUID(), // Generate random password - they can reset later
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (authError) throw authError;

        // Create user record
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
    
    setSubmitting(true);

    try {
      // Calculate pricing
      const adminFeePercent = talent.admin_fee_percentage ?? 15;
      const adminFee = Math.round(service.pricing * (adminFeePercent / 100));
      const fulfillmentDeadline = new Date();
      fulfillmentDeadline.setDate(fulfillmentDeadline.getDate() + 7); // 7 day deadline

      // Create the order
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
          approval_status: 'pending', // Collabs need approval
          is_corporate: true, // Treat as corporate order
          is_corporate_order: true,
          company_name: companyName,
          suggested_script: suggestedScript,
          target_audience: targetAudience,
          request_details: additionalNotes || `Instagram Collab: ${service.title}`,
          fulfillment_deadline: fulfillmentDeadline.toISOString(),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      setOrderId(order.id);
      setStep('payment');
      
      // Initialize Fortis payment
      setTimeout(() => initializeFortis(order.id, service.pricing / 100), 100);

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const initializeFortis = async (orderIdParam: string, amount: number) => {
    try {
      // Create payment intention via API
      const response = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/fortis/create-intention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          orderId: orderIdParam,
          customerEmail: user?.email,
          customerName: user?.full_name,
          description: `Social Collab with ${talent?.full_name}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intention');
      }

      const { clientToken, orderReference } = await response.json();

      // Load Fortis Commerce.js
      if (!(window as any).Commerce) {
        const script = document.createElement('script');
        script.src = 'https://js.fortis.tech/commercejs-v1.0.0.min.js';
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const Commerce = (window as any).Commerce;
      const commerce = new Commerce(clientToken, {
        environment: process.env.REACT_APP_FORTIS_ENV || 'production',
      });

      setCommerceInstance(commerce);

      // Mount the payment form
      if (iframeContainerRef.current) {
        const elements = commerce.elements();
        const transaction = elements.create('transaction', {
          container: '#fortis-payment-container',
          showReceipt: false,
          showSubmitButton: true,
          submitButtonText: 'Pay Now',
          fields: {
            additional: [
              { name: 'description', value: `Social Collab - ${service?.title}` },
              { name: 'order_id', value: orderIdParam },
            ],
          },
        });

        transaction.on('done', async (result: any) => {
          if (successHandledRef.current) return;
          successHandledRef.current = true;
          setIsProcessing(true);

          try {
            // Update order with payment info
            await supabase
              .from('orders')
              .update({
                payment_transaction_id: result.id || result.transaction?.id,
                payment_transaction_payload: result,
              })
              .eq('id', orderIdParam);

            setStep('success');
            toast.success('Payment successful!');
          } catch (error) {
            console.error('Error updating order:', error);
            toast.error('Payment received but order update failed. Please contact support.');
          } finally {
            setIsProcessing(false);
          }
        });

        transaction.on('error', (error: any) => {
          console.error('Payment error:', error);
          toast.error(error.message || 'Payment failed');
          setIsProcessing(false);
        });

        transaction.mount();
      }
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      toast.error('Failed to load payment form');
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
            className="px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const displayName = talent.full_name || 'Creator';
  const price = service.pricing / 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-b border-pink-500/30">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {talent.temp_avatar_url && (
              <img
                src={talent.temp_avatar_url}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/50"
              />
            )}
            <div>
              <p className="text-pink-400 text-sm font-medium">Instagram Collab</p>
              <h1 className="text-xl font-bold text-white">{service.title}</h1>
              <p className="text-gray-400 text-sm">with {displayName}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-white">${price}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          {['register', 'details', 'payment', 'success'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-pink-500 text-white' :
                ['register', 'details', 'payment', 'success'].indexOf(step) > i 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white/10 text-gray-500'
              }`}>
                {['register', 'details', 'payment', 'success'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 3 && (
                <div className={`w-12 h-0.5 ${
                  ['register', 'details', 'payment', 'success'].indexOf(step) > i 
                    ? 'bg-green-500' 
                    : 'bg-white/10'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-center gap-8 mt-2 text-xs text-gray-500">
          <span>Account</span>
          <span>Details</span>
          <span>Payment</span>
          <span>Done</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {step === 'register' && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Create your account</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone (optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating account...' : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {step === 'details' && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Collaboration Details</h2>
            <form onSubmit={handleSubmitDetails} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company / Brand Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company or brand"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Suggested Script / Talking Points *</label>
                <textarea
                  value={suggestedScript}
                  onChange={(e) => setSuggestedScript(e.target.value)}
                  placeholder="What would you like the creator to say or showcase? Include key messages, product features, or specific phrases..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience *</label>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Who is this content for? Describe demographics, interests, or customer type..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes (optional)</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any other details, deadlines, or special requests..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Processing...' : `Continue to Payment - $${price}`}
              </button>
            </form>
          </div>
        )}

        {step === 'payment' && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Payment</h2>
            
            {/* Order Summary */}
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">{service.title}</span>
                <span className="text-white">${price.toFixed(2)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-white font-bold text-xl">${price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Fortis Payment Form */}
            <div 
              id="fortis-payment-container" 
              ref={iframeContainerRef}
              className="min-h-[300px] bg-white/5 rounded-xl p-4"
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mb-4"></div>
                  <p className="text-gray-400">Processing payment...</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
                  <span className="ml-3 text-gray-400">Loading payment form...</span>
                </div>
              )}
            </div>

            <p className="text-gray-500 text-xs text-center mt-4">
              Secure payment powered by Fortis
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Request Submitted!</h2>
            <p className="text-gray-400 mb-6">
              Your collaboration request has been sent to {displayName}. 
              They'll review your request and get back to you soon.
            </p>
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <p className="text-gray-500 text-sm">Order ID</p>
              <p className="text-white font-mono">{orderId}</p>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              You'll receive an email confirmation shortly. Check your inbox for updates on your request.
            </p>
            <button
              onClick={() => navigate(`/bio/${talent.username || talent.id}`)}
              className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors"
            >
              Back to Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollabOrderPage;

