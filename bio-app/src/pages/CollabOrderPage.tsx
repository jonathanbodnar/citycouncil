import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface TalentProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  temp_full_name?: string; // Name stored before onboarding completion
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
  service_type: 'instagram_collab' | 'tiktok_collab' | 'youtube_collab' | 'sponsorship';
  pricing: number;
  title: string;
  description?: string;
  video_length_seconds: number;
  benefits: string[];
  platforms: string[]; // Which platforms are included
  is_active: boolean;
  // Coupon and recurring payment fields
  coupon_code?: string | null;
  coupon_discount_amount?: number | null;
  coupon_discount_type?: 'percentage' | 'fixed';
  is_recurring?: boolean;
  recurring_interval?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | null;
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
  phone?: string;
}

type Step = 'register' | 'details' | 'payment' | 'success';
type AuthStep = 'email' | 'phone' | 'otp'; // New auth flow steps

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
  
  // Registration/Login form - email → phone → OTP flow
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [authStep, setAuthStep] = useState<AuthStep>('email');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [phoneHint, setPhoneHint] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
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
  const [commerceInstance, setCommerceInstance] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const successHandledRef = useRef(false);
  
  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    discountType: 'percentage' | 'fixed';
    finalPrice: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // Recurring subscription state (user chooses frequency)
  const [wantsRecurring, setWantsRecurring] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  
  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

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
      // Get talent profile with user data for fallback name
      let { data: profile } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users!talent_profiles_user_id_fkey (
            full_name
          )
        `)
        .eq('username', username)
        .single();

      if (!profile) {
        const { data: profileById } = await supabase
          .from('talent_profiles')
          .select(`
            *,
            users!talent_profiles_user_id_fkey (
              full_name
            )
          `)
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
      console.log('Checking existing session:', session?.user?.id);
      
      if (session?.user) {
        // User is logged in via Supabase, fetch their profile
        const { data: existingUser, error } = await supabase
          .from('users')
          .select('id, email, full_name, phone, user_type')
          .eq('id', session.user.id)
          .single();
        
        if (existingUser && !error) {
          console.log('Found logged-in user:', existingUser.email);
          setUser(existingUser);
          localStorage.setItem('collab_user', JSON.stringify(existingUser));
          setStep('details');
          toast.success('Welcome back!');
          return;
        }
      }
    } catch (error) {
      console.log('No active session:', error);
    }
    
    // Fallback to localStorage (for users who registered via collab page before)
    const savedUser = localStorage.getItem('collab_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Verify the saved user still exists in the database
        const { data: verifiedUser, error } = await supabase
          .from('users')
          .select('id, email, full_name, phone, user_type')
          .eq('id', parsed.id)
          .single();
        
        if (verifiedUser && !error) {
          setUser(verifiedUser);
          setStep('details');
          return;
        } else {
          // User no longer valid, clear localStorage
          localStorage.removeItem('collab_user');
        }
      } catch {
        localStorage.removeItem('collab_user');
      }
    }
  };

  // Format phone number display
  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  // Handle email submission - check if user exists with phone
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setSubmitting(true);
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Check if user exists and has a phone on file
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ 
            email: normalizedEmail,
            checkEmailOnly: true
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.sentToExistingPhone) {
        // User exists with phone - OTP was sent
        console.log('Existing user with phone, OTP sent');
        setPhone(data.phone || '');
        setPhoneHint(data.phoneHint);
        setAuthStep('otp');
        setOtpCooldown(60);
        toast.success('Welcome back! Code sent to your phone.');
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
        return;
      }
      
      if (data.rateLimited) {
        toast.error(data.error || 'Please wait before requesting another code');
        setOtpCooldown(60);
        if (data.phoneHint) {
          setPhoneHint(data.phoneHint);
          setAuthStep('otp');
        }
        return;
      }
      
      // No existing user with phone - need to collect phone
      setAuthStep('phone');
      
    } catch (error: any) {
      console.log('Email check error:', error.message);
      // On error, proceed to phone step
      setAuthStep('phone');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle phone submission - send OTP
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone, email: email.toLowerCase().trim() }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        if (data.rateLimited) {
          toast.error(data.error || 'Please wait before requesting another code');
          setOtpCooldown(60);
          return;
        }
        throw new Error(data.error);
      }
      
      setPhoneHint(data.phoneHint);
      setAuthStep('otp');
      setOtpCooldown(60);
      toast.success(data.isExistingUser ? 'Welcome back! Code sent.' : 'Verification code sent!');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when complete
    if (value && index === 5) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        handleOtpSubmit(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtpCode(newOtp);
      handleOtpSubmit(pastedData);
    }
  };

  // Verify OTP and login/register
  const handleOtpSubmit = async (code?: string) => {
    const otpCodeStr = code || otpCode.join('');
    
    if (otpCodeStr.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/verify-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone, code: otpCodeStr, email: email.toLowerCase().trim() }),
        }
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      // Set session if tokens provided
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      
      // Get user data
      const userData: User = {
        id: data.user?.id || data.userId,
        email: data.user?.email || email.toLowerCase().trim(),
        full_name: data.user?.full_name || email.split('@')[0],
        phone: data.user?.phone || phone,
      };
      
      setUser(userData);
      localStorage.setItem('collab_user', JSON.stringify(userData));
      setStep('details');
      toast.success(data.isLogin ? 'Welcome back!' : 'Account created!');
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify code');
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-registration-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone, email: email.toLowerCase().trim() }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('New code sent!');
        setOtpCooldown(60);
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        toast.error(data.error || 'Failed to resend code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code');
    } finally {
      setSubmitting(false);
    }
  };

  // Apply coupon code
  const applyCoupon = async () => {
    if (!service || !couponInput.trim()) return;
    
    setCouponError(null);
    setSubmitting(true);
    
    const inputCode = couponInput.trim().toUpperCase();
    const originalPrice = service.pricing / 100;
    
    // First check if service has a configured coupon that matches
    if (service.coupon_code && service.coupon_code.toUpperCase() === inputCode) {
      const discountAmount = service.coupon_discount_amount || 0;
      const discountType = service.coupon_discount_type || 'percentage';
      
      let finalPrice: number;
      if (discountType === 'percentage') {
        finalPrice = originalPrice * (1 - discountAmount / 100);
      } else {
        finalPrice = Math.max(0, originalPrice - discountAmount);
      }
      
      setAppliedCoupon({
        code: service.coupon_code,
        discountAmount,
        discountType,
        finalPrice: Math.round(finalPrice * 100) / 100,
      });
      toast.success(`Coupon applied! ${discountType === 'percentage' ? `${discountAmount}% off` : `$${discountAmount} off`}`);
      setSubmitting(false);
      return;
    }
    
    // Look up global coupon in database
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', inputCode)
        .eq('is_active', true)
        .single();
      
      if (error || !coupon) {
        setCouponError('Invalid coupon code');
        setAppliedCoupon(null);
        setSubmitting(false);
        return;
      }
      
      // Check if coupon is expired
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        setCouponError('This coupon has expired');
        setAppliedCoupon(null);
        setSubmitting(false);
        return;
      }
      
      // Check usage limits
      if (coupon.max_uses && coupon.use_count >= coupon.max_uses) {
        setCouponError('This coupon has reached its usage limit');
        setAppliedCoupon(null);
        setSubmitting(false);
        return;
      }
      
      const discountAmount = coupon.discount_amount || 0;
      const discountType = coupon.discount_type || 'percentage';
      
      let finalPrice: number;
      if (discountType === 'percentage') {
        finalPrice = originalPrice * (1 - discountAmount / 100);
      } else {
        finalPrice = Math.max(0, originalPrice - discountAmount);
      }
      
      setAppliedCoupon({
        code: coupon.code,
        discountAmount,
        discountType,
        finalPrice: Math.round(finalPrice * 100) / 100,
      });
      toast.success(`Coupon applied! ${discountType === 'percentage' ? `${discountAmount}% off` : `$${discountAmount} off`}`);
    } catch (err) {
      console.error('Error looking up coupon:', err);
      setCouponError('Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !talent || !service) return;
    
    // Calculate final price (with coupon if applied)
    const finalPrice = appliedCoupon ? appliedCoupon.finalPrice : service.pricing / 100;
    
    setStep('payment');
    // Use ticket intention if user wants recurring, transaction intention for one-time
    // Note: service.is_recurring just enables the option, wantsRecurring is the user's choice
    const useRecurring = service.is_recurring && wantsRecurring;
    setTimeout(() => initializeFortis(finalPrice, useRecurring), 100);
  };

  const initializeFortis = async (amount: number, isRecurring: boolean = false) => {
    try {
      const amountCents = Math.round(amount * 100);
      console.log('🔄 Initializing Fortis with amount:', amount, 'cents:', amountCents, 'recurring:', isRecurring);
      
      let intentionData;
      let intentionError;
      
      try {
        // Use ticket intention for recurring payments, transaction intention for one-time
        const functionName = isRecurring ? 'fortis-ticket-intention' : 'fortis-intention';
        const body = isRecurring ? {} : { amount_cents: amountCents };
        
        const response = await supabase.functions.invoke(functionName, { body });
        intentionData = response.data;
        intentionError = response.error;
        console.log(`${functionName} response:`, { data: intentionData, error: intentionError });
      } catch (fetchError: any) {
        console.error('Network error calling fortis intention:', fetchError);
        throw new Error(`Network error: ${fetchError.message || 'Failed to connect to payment service'}`);
      }

      if (intentionError) {
        console.error('Fortis intention error:', intentionError);
        throw new Error(intentionError.message || 'Failed to create payment intention');
      }
      
      if (!intentionData) {
        throw new Error('No response from payment service');
      }

      const { clientToken, intentionType } = intentionData;
      
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
        
        // For recurring (ticket) flow, we get a ticket_id, not a transaction
        // User must have chosen recurring AND talent must have enabled it
        const userChoseRecurring = service?.is_recurring && wantsRecurring;
        const isTicketFlow = intentionType === 'ticket' || userChoseRecurring;
        const ticketId = payload?.data?.id || payload?.id;
        const txId = payload?.transaction?.id || payload?.data?.id || payload?.id;

        try {
          if (!user || !talent || !service) {
            throw new Error('Missing required data');
          }

          // Calculate final amount (with coupon if applied)
          const finalAmountCents = appliedCoupon 
            ? Math.round(appliedCoupon.finalPrice * 100) 
            : service.pricing;

          let transactionId = txId;
          let tokenId: string | null = null;

          // For recurring services, process the ticket to get payment and token
          if (isTicketFlow) {
            console.log('Processing ticket for recurring payment:', ticketId);
            
            const { data: ticketResult, error: ticketError } = await supabase.functions.invoke('fortis-process-ticket', {
              body: {
                ticket_id: ticketId,
                amount_cents: finalAmountCents,
                save_account: true, // Always save for recurring
              },
            });

            if (ticketError || !ticketResult?.success) {
              throw new Error(ticketResult?.error || ticketError?.message || 'Payment processing failed');
            }

            transactionId = ticketResult.transaction_id;
            tokenId = ticketResult.token_id;
            console.log('Ticket processed successfully:', { transactionId, tokenId });
          }

          const adminFeePercent = 15; // Fixed 15% admin fee for collabs
          const adminFee = Math.round(finalAmountCents * (adminFeePercent / 100));
          
          const fulfillmentDeadline = new Date();
          const fulfillmentHours = talent.fulfillment_time_hours || 168;
          fulfillmentDeadline.setHours(fulfillmentDeadline.getHours() + fulfillmentHours);

          // Create the order
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              user_id: user.id,
              talent_id: talent.id,
              service_offering_id: service.id,
              service_type: 'social_collab',
              amount: finalAmountCents,
              original_amount: service.pricing !== finalAmountCents ? service.pricing : null,
              discount_amount: service.pricing !== finalAmountCents ? service.pricing - finalAmountCents : null,
              coupon_code: appliedCoupon?.code || null,
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
              payment_transaction_id: transactionId,
              payment_transaction_payload: payload,
            })
            .select()
            .single();

          if (orderError) throw orderError;

          console.log('✅ Order created:', order.id);

          // For recurring services, create the subscription (if user chose recurring)
          if (userChoseRecurring && tokenId) {
            console.log('Creating subscription for recurring service with interval:', selectedInterval);
            
            // Calculate next billing date based on user's chosen interval
            const nextBillingDate = new Date();
            switch (selectedInterval) {
              case 'weekly':
                nextBillingDate.setDate(nextBillingDate.getDate() + 7);
                break;
              case 'biweekly':
                nextBillingDate.setDate(nextBillingDate.getDate() + 14);
                break;
              case 'monthly':
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                break;
              case 'quarterly':
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
                break;
              case 'yearly':
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                break;
            }

            const { error: subError } = await supabase
              .from('collab_subscriptions')
              .insert({
                user_id: user.id,
                talent_id: talent.id,
                service_offering_id: service.id,
                fortis_token_id: tokenId,
                status: 'active',
                amount_cents: finalAmountCents,
                recurring_interval: selectedInterval, // User's chosen interval
                next_billing_date: nextBillingDate.toISOString(),
                last_billing_date: new Date().toISOString(),
                successful_payments: 1,
                company_name: orderDetails.companyName,
                suggested_script: orderDetails.suggestedScript,
                target_audience: orderDetails.targetAudience,
                customer_socials: orderDetails.customerSocials,
              });

            if (subError) {
              console.error('Failed to create subscription:', subError);
              // Don't fail the whole order, just log the error
            } else {
              console.log('✅ Subscription created');
            }
          }

          setCreatedOrderId(order.id);
          setStep('success');
          toast.success(userChoseRecurring ? 'Subscription started successfully!' : 'Order placed successfully!');
          
        } catch (error) {
          console.error('Error creating order:', error);
          toast.error('Payment received but order creation failed. Please contact support.');
        } finally {
          setIsProcessing(false);
        }
      };

      console.log('Attaching Commerce JS handlers');
      elements.eventBus.on('ready', () => {
        console.log('Commerce iframe ready');
        setIsPaymentReady(true);
      });
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
      // Get background from bio gradient or use dark default
      const themeBgColor = bioSettings?.gradient_start || '#0f172a';
      
      // Fortis Commerce.js v1.0.0
      // fontFamily MUST be: Roboto, Montserrat, OpenSans, Raleway, SourceCode, or SourceSans
      
      elements.create({
        container: '#fortis-payment-container',
        theme: 'dark',
        environment: 'production',
        view: 'default',
        language: 'en-us',
        defaultCountry: 'US',
        floatingLabels: true,
        showReceipt: false,
        showSubmitButton: false, // Hide Fortis's button, we'll use our own custom styled button
        showValidationAnimation: true,
        hideAgreementCheckbox: false,
        hideTotal: true,
        appearance: {
          colorBackground: themeBgColor,
          colorButtonSelectedBackground: themeButtonColor,
          colorButtonSelectedText: '#ffffff',
          borderRadius: '8px',
        },
      });
      
      console.log('Commerce iframe created with bg:', themeBgColor, 'button:', themeButtonColor);

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
  const userName = (talent as any)?.users?.full_name;
  const displayName = bioSettings?.display_name || talent?.full_name || talent?.temp_full_name || userName || 'Creator';
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

        {/* Step Content - match Fortis form background */}
        <div className="flex-1">
          <div 
            className="backdrop-blur-md border border-white/10 p-6"
            style={{ 
              backgroundColor: gradientStart,
              borderRadius: getButtonRadius(),
            }}
          >
            {/* Registration Step - Email → Phone → OTP Flow */}
            {step === 'register' && (
              <div className="space-y-4">
                {/* Email Step */}
                {authStep === 'email' && (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <h2 className="text-xl font-semibold text-white mb-4">Sign in or Create Account</h2>
                    <p className="text-gray-400 text-sm mb-4">
                      Enter your email to continue. If you have a ShoutOut account, we'll send a code to your phone.
                    </p>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                        style={{ borderRadius: getButtonRadius() }}
                        placeholder="you@email.com"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Checking...
                        </span>
                      ) : 'Continue'}
                    </button>
                  </form>
                )}

                {/* Phone Step - for new users */}
                {authStep === 'phone' && (
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setAuthStep('email')}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    
                    <h2 className="text-xl font-semibold text-white mb-4">Enter Your Phone</h2>
                    <p className="text-gray-400 text-sm mb-4">
                      We'll send a verification code to confirm your number.
                    </p>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={formatPhoneDisplay(phone)}
                        onChange={handlePhoneChange}
                        required
                        autoFocus
                        className="w-full bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                        style={{ borderRadius: getButtonRadius() }}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || phone.length < 10}
                      className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Sending Code...
                        </span>
                      ) : 'Send Code'}
                    </button>
                  </form>
                )}

                {/* OTP Step */}
                {authStep === 'otp' && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep(phone ? 'phone' : 'email');
                        setOtpCode(['', '', '', '', '', '']);
                      }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    
                    <h2 className="text-xl font-semibold text-white mb-4">Enter Verification Code</h2>
                    <p className="text-gray-400 text-sm mb-4">
                      We sent a 6-digit code to {phoneHint || formatPhoneDisplay(phone)}
                    </p>
                    
                    {/* OTP Input */}
                    <div className="flex justify-center gap-2 mb-6">
                      {otpCode.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { otpInputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={index === 0 ? handleOtpPaste : undefined}
                          className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 text-white focus:outline-none focus:border-pink-500 transition-colors"
                          style={{ borderRadius: getButtonRadius() }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOtpSubmit()}
                      disabled={submitting || otpCode.join('').length !== 6}
                      className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Verifying...
                        </span>
                      ) : 'Verify Code'}
                    </button>

                    {/* Resend */}
                    <div className="text-center">
                      {otpCooldown > 0 ? (
                        <p className="text-gray-500 text-sm">
                          Resend code in {otpCooldown}s
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={submitting}
                          className="text-pink-400 hover:text-pink-300 text-sm font-medium transition-colors"
                        >
                          Didn't receive a code? Resend
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ShoutOut Logo at bottom */}
                <div className="pt-6 flex flex-col items-center">
                  <p className="text-gray-500 text-xs mb-2">Powered by</p>
                  <div className="flex items-center gap-2 opacity-60">
                    <img src="/whiteicon.png" alt="ShoutOut" className="h-5 w-5" />
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

                {/* Recurring Payment Option - shown if talent enabled it */}
                {service?.is_recurring && (
                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Subscribe & Save</h4>
                          <p className="text-xs text-gray-400">Set up recurring billing</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wantsRecurring}
                          onChange={(e) => setWantsRecurring(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                    
                    {wantsRecurring && (
                      <div className="p-4 border-t border-white/10 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">How often would you like to be billed?</label>
                          <select
                            value={selectedInterval}
                            onChange={(e) => setSelectedInterval(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Every 2 Weeks</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly (every 3 months)</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-blue-400 text-sm">
                            💳 Your card will be charged <span className="font-bold">${appliedCoupon ? appliedCoupon.finalPrice.toFixed(2) : ((service?.pricing || 0) / 100).toFixed(2)}</span>{' '}
                            {selectedInterval === 'weekly' && 'every week'}
                            {selectedInterval === 'biweekly' && 'every 2 weeks'}
                            {selectedInterval === 'monthly' && 'every month'}
                            {selectedInterval === 'quarterly' && 'every 3 months'}
                            {selectedInterval === 'yearly' && 'every year'}
                            . Cancel anytime.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: buttonColor, borderRadius: getButtonRadius() }}
                >
                  {wantsRecurring ? 'Continue to Subscribe' : 'Continue to Payment'}
                </button>
              </form>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Payment</h2>
                
                {/* Recurring Option - show if talent enabled it */}
                {service?.is_recurring && (
                  <div 
                    className="border border-white/10 rounded-xl overflow-hidden mb-4"
                    style={{ borderRadius: getButtonRadius() }}
                  >
                    <div className="p-4 flex items-center justify-between bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Subscribe & Save</h4>
                          <p className="text-xs text-gray-400">Set up recurring billing</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wantsRecurring}
                          onChange={(e) => setWantsRecurring(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                    
                    {wantsRecurring && (
                      <div className="p-4 border-t border-white/10 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">How often would you like to be billed?</label>
                          <select
                            value={selectedInterval}
                            onChange={(e) => setSelectedInterval(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Every 2 Weeks</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly (every 3 months)</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-blue-400 text-sm">
                            💳 Your card will be charged <span className="font-bold">${appliedCoupon ? appliedCoupon.finalPrice.toFixed(2) : price.toFixed(2)}</span>{' '}
                            {selectedInterval === 'weekly' && 'every week'}
                            {selectedInterval === 'biweekly' && 'every 2 weeks'}
                            {selectedInterval === 'monthly' && 'every month'}
                            {selectedInterval === 'quarterly' && 'every 3 months'}
                            {selectedInterval === 'yearly' && 'every year'}
                            . Cancel anytime.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Order Summary */}
                <div 
                  className="bg-white/5 p-4 mb-4"
                  style={{ borderRadius: getButtonRadius() }}
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">{service.title}</span>
                    <span className={appliedCoupon ? 'text-gray-500 line-through' : 'text-white'}>${price.toFixed(2)}</span>
                  </div>
                  
                  {appliedCoupon && (
                    <div className="flex justify-between mb-2 text-green-400">
                      <span>Discount ({appliedCoupon.code})</span>
                      <span>
                        -{appliedCoupon.discountType === 'percentage' 
                          ? `${appliedCoupon.discountAmount}%` 
                          : `$${appliedCoupon.discountAmount.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">
                        {service.is_recurring && wantsRecurring ? 'Amount Due Today' : 'Total'}
                      </span>
                      <span className="text-white font-semibold">
                        ${appliedCoupon ? appliedCoupon.finalPrice.toFixed(2) : price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Coupon Code Input - always show if no coupon applied */}
                {!appliedCoupon && (
                  <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-2">Have a coupon code?</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        placeholder="Enter code"
                        className="flex-1 bg-white/5 border border-white/20 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 uppercase"
                        style={{ borderRadius: getButtonRadius() }}
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        className="px-4 py-3 bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                        style={{ borderRadius: getButtonRadius() }}
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-red-400 text-sm mt-2">{couponError}</p>
                    )}
                  </div>
                )}
                
                {/* Applied Coupon Badge */}
                {appliedCoupon && (
                  <div 
                    className="flex items-center justify-between bg-green-500/10 border border-green-500/30 p-3 mb-6"
                    style={{ borderRadius: getButtonRadius() }}
                  >
                    <div className="flex items-center gap-2 text-green-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Coupon <strong>{appliedCoupon.code}</strong> applied</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponInput('');
                      }}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Payment Form Container */}
                <div className="relative rounded-xl border border-white/10 overflow-hidden">
                  {/* Loading indicator overlay */}
                  {!isPaymentReady && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center z-10"
                      style={{ backgroundColor: bioSettings?.gradient_start || '#0f172a' }}
                    >
                      <div className="animate-pulse text-gray-400">Loading payment form...</div>
                    </div>
                  )}
                  
                  {/* Fortis iframe container */}
                  <div 
                    id="fortis-payment-container" 
                    ref={iframeContainerRef}
                    className="min-h-[350px]"
                    style={{ marginTop: '-190px' }}
                  />
                </div>

                {/* Custom Submit Button */}
                {isPaymentReady && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!commerceInstance) {
                        toast.error('Payment form not ready');
                        return;
                      }
                      setIsProcessing(true);
                      commerceInstance.submit();
                    }}
                    disabled={isProcessing || !commerceInstance}
                    className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    style={{
                      backgroundColor: buttonColor,
                      color: '#ffffff',
                      borderRadius: getButtonRadius(),
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      `Pay $${appliedCoupon ? appliedCoupon.finalPrice.toFixed(2) : price.toFixed(2)}${service.is_recurring ? '/mo' : ''}`
                    )}
                  </button>
                )}

                <p className="text-center text-gray-500 text-xs mt-4">
                  Secure payment powered by{' '}
                  <a 
                    href="https://lunarpay.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    LunarPay
                  </a>
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
                
                <h2 className="text-2xl font-bold text-white mb-2">
                  {service.is_recurring ? 'Subscription Started!' : 'Order Placed!'}
                </h2>
                <p className="text-gray-400 mb-6">
                  {displayName} has been notified and will start working on your collab soon.
                </p>

                {service.is_recurring && wantsRecurring && (
                  <div 
                    className="bg-blue-500/10 border border-blue-500/30 p-4 mb-6 text-left"
                    style={{ borderRadius: getButtonRadius() }}
                  >
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="font-semibold">Recurring Subscription</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      You'll be charged ${appliedCoupon ? appliedCoupon.finalPrice.toFixed(2) : price.toFixed(2)}{' '}
                      {selectedInterval === 'weekly' && 'every week'}
                      {selectedInterval === 'biweekly' && 'every 2 weeks'}
                      {selectedInterval === 'monthly' && 'every month'}
                      {selectedInterval === 'quarterly' && 'every 3 months'}
                      {selectedInterval === 'yearly' && 'every year'}.
                      You can cancel anytime from your dashboard.
                    </p>
                  </div>
                )}

                <div 
                  className="bg-white/5 p-4 mb-6 text-left"
                  style={{ borderRadius: getButtonRadius() }}
                >
                  <h3 className="text-white font-semibold mb-2">What's Next?</h3>
                  <ul className="space-y-2 text-gray-400 text-sm">
                    <li>• {displayName} will review your request</li>
                    <li>• You'll receive an email when your content is ready</li>
                    <li>• Track your order status in your dashboard</li>
                    {service.is_recurring && wantsRecurring && (
                      <li>• Manage your subscription from your dashboard</li>
                    )}
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
