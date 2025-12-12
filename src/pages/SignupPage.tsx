import React, { useState } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import Logo from '../components/Logo';
import PhoneInput from '../components/PhoneInput';
import toast from 'react-hot-toast';

const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get('returnTo') || '/';
  
  // Capture UTM source from URL or localStorage
  // Supports both simple utm= and Facebook's detailed utm_source=
  const getPromoSource = (): string | null => {
    // Check simple utm param first
    const simpleUtm = searchParams.get('utm');
    if (simpleUtm) return simpleUtm;
    
    // Check for Facebook-style utm_source
    const utmSource = searchParams.get('utm_source');
    if (utmSource) {
      // Normalize Facebook sources to 'fb'
      const fbSources = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'audience_network', 'messenger', 'an'];
      const normalizedSource = utmSource.toLowerCase();
      return fbSources.some(s => normalizedSource.includes(s)) ? 'fb' : utmSource;
    }
    
    // Check localStorage for stored promo source
    try {
      return localStorage.getItem('promo_source_global') || localStorage.getItem('promo_source') || null;
    } catch {
      return null;
    }
  };
  
  const promoSource = getPromoSource();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    userType: 'user' as 'user' | 'talent', // Always 'user' - talent accounts created by admin only
    agreeToTerms: true,
  });
  const [loading, setLoading] = useState(false);
  const { user, signUp } = useAuth();

  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phoneNumber || formData.phoneNumber.trim() === '') {
      toast.error('Phone number is required');
      return;
    }

    if (!formData.agreeToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    console.log('📝 Form data before signup:', formData);

    setLoading(true);

    try {
      await signUp(formData.email, formData.password, formData.fullName, formData.userType, formData.phoneNumber, promoSource);
      toast.success('Account created successfully! Redirecting...');
      
      // Fire tracking events directly on successful signup (like popup does for Lead)
      console.log('📊 SignupPage: Firing tracking events after successful signup...', {
        hasFbq: typeof (window as any).fbq === 'function',
        hasRatag: typeof (window as any).ratag === 'function'
      });
      
      // Facebook Pixel CompleteRegistration event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'CompleteRegistration', {
          content_name: 'User Registration',
          status: 'complete'
        });
        console.log('📊 SignupPage: Facebook Pixel CompleteRegistration fired');
      } else {
        console.warn('⚠️ SignupPage: Facebook Pixel (fbq) not found');
      }
      
      // Rumble Ads User conversion
      if (typeof window !== 'undefined' && (window as any).ratag) {
        (window as any).ratag('conversion', { to: 3337 });
        console.log('📊 SignupPage: Rumble Ads User conversion fired (3337)');
      } else {
        console.warn('⚠️ SignupPage: Rumble Ads (ratag) not found');
      }
      
      // Send user registration to Zapier webhook via Edge Function (users only, not talent)
      if (formData.userType === 'user') {
        const webhookPayload = {
          name: formData.fullName,
          email: formData.email,
          registered_at: new Date().toISOString()
        };
        
        console.log('📤 SignupPage: Sending user registration to Zapier via Edge Function...', webhookPayload);
        
        supabase.functions.invoke('send-user-webhook', {
          body: webhookPayload
        }).then((result) => {
          if (result.error) {
            console.error('❌ SignupPage: Edge Function error:', result.error);
          } else {
            console.log('✅ SignupPage: User registration sent to Zapier via Edge Function:', result.data);
          }
        }).catch((err) => {
          console.error('❌ SignupPage: Error calling Edge Function:', err);
        });
      }
      
      // Navigate to returnTo URL after successful signup
      setTimeout(() => {
        navigate(returnTo);
      }, 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link to="/" className="flex justify-center">
            <Logo size="lg" theme="dark" />
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to={`/login${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <PhoneInput
                value={formData.phoneNumber}
                onChange={(value) => setFormData(prev => ({ ...prev, phoneNumber: value }))}
                label="Phone Number"
                placeholder="(555) 123-4567"
                required={true}
              />
              <p className="mt-1 text-xs text-gray-500">
                Required for SMS notifications when your video is ready
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

          </div>

          <div className="flex items-center">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              className="h-5 w-5 rounded border-2 border-gray-400 transition-colors mt-0.5"
              style={{ accentColor: '#3b82f6' }}
              checked={formData.agreeToTerms}
              onChange={handleChange}
            />
            <label htmlFor="agreeToTerms" className="ml-2 block text-sm text-white">
              I agree to the{' '}
              <button type="button" className="text-primary-600 hover:text-primary-500 underline">
                Terms and Conditions
              </button>{' '}
              and{' '}
              <button type="button" className="text-primary-600 hover:text-primary-500 underline">
                Privacy Policy
              </button>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;
