import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  UserCircleIcon,
  VideoCameraIcon,
  CurrencyDollarIcon,
  CheckIcon,
  ArrowRightIcon,
  DevicePhoneMobileIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import ImageUpload from '../components/ImageUpload';
import Logo from '../components/Logo';
import CategorySelector from '../components/CategorySelector';
import ShoutoutTypeSelector from '../components/onboarding/ShoutoutTypeSelector';
import PricingHelper from '../components/onboarding/PricingHelper';
import { TalentCategory } from '../types';
import { uploadVideoToWasabi } from '../services/videoUpload';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, name: 'Create Account', description: 'Sign up or login', icon: UserCircleIcon },
  { id: 2, name: 'Profile Info', description: 'Your public profile', icon: StarIcon },
  { id: 3, name: 'Categories', description: 'Your niche & occasions', icon: SparklesIcon },
  { id: 4, name: 'Charity', description: 'Optional donation', icon: CurrencyDollarIcon },
  { id: 5, name: 'Promo Video', description: 'Introduce yourself', icon: VideoCameraIcon },
];

const TalentStartPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [defaultAdminFee, setDefaultAdminFee] = useState(25);

  // OTP Auth State (same flow as admin onboarding)
  const [authStep, setAuthStep] = useState<'email' | 'phone' | 'otp'>('email');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [existingUserPhone, setExistingUserPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [talentProfileId, setTalentProfileId] = useState<string | null>(null);

  // Profile Data
  const [profileData, setProfileData] = useState({
    fullName: '',
    username: '',
    category: '' as TalentCategory,
    categories: [] as TalentCategory[],
    bio: '',
    pricing: 50,
    instagramFollowers: 0,
    fulfillmentTime: 72,
    avatarUrl: ''
  });
  const [selectedShoutoutTypes, setSelectedShoutoutTypes] = useState<string[]>([]);

  // Charity Data
  const [donateToCharity, setDonateToCharity] = useState(false);
  const [charityData, setCharityData] = useState({ charityName: '', charityPercentage: 5 });
  const [charities, setCharities] = useState<{ id: string; name: string }[]>([]);
  const [showCustomCharity, setShowCustomCharity] = useState(false);

  // Video
  const [promoVideo, setPromoVideo] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  useEffect(() => {
    fetchPlatformSettings();
    fetchCharities();
    loadSavedProgress();
  }, []);

  // OTP Cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && currentStep === 1) {
        handleUserAuthenticated(session.user.id);
      }
    };
    checkExistingSession();
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const { data } = await supabase.from('app_settings').select('global_admin_fee_percentage').single();
      if (data?.global_admin_fee_percentage) setDefaultAdminFee(data.global_admin_fee_percentage);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchCharities = async () => {
    try {
      const { data } = await supabase
        .from('charities')
        .select('id, name')
        .eq('is_verified', true)
        .order('name');
      if (data) setCharities(data);
    } catch (error) {
      console.error('Error fetching charities:', error);
    }
  };

  const loadSavedProgress = () => {
    const saved = localStorage.getItem('talent_start_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep && parsed.currentStep > 1) setCurrentStep(parsed.currentStep);
        if (parsed.userId) setUserId(parsed.userId);
        if (parsed.talentProfileId) setTalentProfileId(parsed.talentProfileId);
        if (parsed.profileData) setProfileData({ ...profileData, ...parsed.profileData });
        if (parsed.selectedShoutoutTypes) setSelectedShoutoutTypes(parsed.selectedShoutoutTypes);
        if (parsed.donateToCharity !== undefined) setDonateToCharity(parsed.donateToCharity);
        if (parsed.charityData) setCharityData(parsed.charityData);
        if (parsed.showCustomCharity !== undefined) setShowCustomCharity(parsed.showCustomCharity);
        if (parsed.currentStep > 1) toast.success('Progress restored!');
      } catch (e) {
        console.error('Failed to parse saved progress:', e);
      }
    }
  };

  // Save progress
  useEffect(() => {
    if (userId || currentStep > 1) {
      localStorage.setItem('talent_start_progress', JSON.stringify({
        currentStep, userId, talentProfileId, profileData, selectedShoutoutTypes, donateToCharity, charityData, showCustomCharity
      }));
    }
  }, [currentStep, userId, talentProfileId, profileData, selectedShoutoutTypes, donateToCharity, charityData, showCustomCharity]);

  // Handle authenticated user - create/get talent profile
  const handleUserAuthenticated = async (authUserId: string) => {
    setUserId(authUserId);
    setLoading(true);

    try {
      // Check for existing talent profile
      const { data: existingProfile } = await supabase
        .from('talent_profiles')
        .select('id, onboarding_completed')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (existingProfile?.onboarding_completed) {
        toast.success('Welcome back!');
        navigate('/dashboard');
        return;
      }

      if (existingProfile) {
        setTalentProfileId(existingProfile.id);
        // Check for saved progress and restore step
        const saved = localStorage.getItem('talent_start_progress');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.currentStep && parsed.currentStep > 1) {
              setCurrentStep(parsed.currentStep);
              toast.success('Continuing your setup...');
              return;
            }
          } catch (e) { /* ignore */ }
        }
        // Default to step 2 if no saved progress
        toast.success('Continuing your setup...');
        setCurrentStep(2);
        return;
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', authUserId)
        .single();

      // Create new talent profile
      console.log('Creating talent profile for user:', authUserId);
      const { data: newProfile, error: profileError } = await supabase
        .from('talent_profiles')
        .insert({
          user_id: authUserId,
          category: 'other',
          bio: '',
          pricing: 50,
          fulfillment_time_hours: 72,
          is_featured: false,
          is_active: false,
          total_orders: 0,
          fulfilled_orders: 0,
          average_rating: 0,
          admin_fee_percentage: defaultAdminFee,
          first_orders_promo_active: true,
          onboarding_completed: false,
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        console.error('Profile error details:', JSON.stringify(profileError, null, 2));
        toast.error(`Failed to create profile: ${profileError.message || 'RLS policy may be blocking. Contact support.'}`);
        return;
      }
      
      console.log('Talent profile created successfully:', newProfile?.id);

      setTalentProfileId(newProfile.id);
      if (userData?.full_name) {
        setProfileData(prev => ({ ...prev, fullName: userData.full_name || '' }));
      }
      
      toast.success('Account verified! Let\'s set up your profile.');
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error setting up profile:', error);
      toast.error(error.message || 'Failed to set up profile');
    } finally {
      setLoading(false);
    }
  };

  // Username check
  useEffect(() => {
    if (!profileData.username || profileData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('talent_profiles')
          .select('id')
          .eq('username', profileData.username.toLowerCase())
          .neq('id', talentProfileId || '00000000-0000-0000-0000-000000000000')
          .maybeSingle();
        setUsernameAvailable(!data);
      } catch (e) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [profileData.username, talentProfileId]);

  // Format phone number for display
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Handle email submission - check if user exists and has phone (same as admin onboarding)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Check if user exists with a phone number using Supabase client
      const { data, error } = await supabase.functions.invoke('send-registration-otp', {
        body: {
          email: normalizedEmail,
          checkEmailOnly: true,
        },
      });

      if (error) {
        console.error('Email check error:', error);
        // On error, just proceed to phone step
        setAuthStep('phone');
        return;
      }
      
      if (data?.sentToExistingPhone && data?.phone) {
        // User exists with phone - OTP already sent, skip to OTP step
        setExistingUserPhone(data.phone);
        setPhone(data.phone);
        toast.success('We sent a code to your phone!');
        setAuthStep('otp');
        setOtpCooldown(60);
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } else {
        // No existing user with phone - go to phone step
        setAuthStep('phone');
      }
    } catch (error: any) {
      console.error('Email check error:', error);
      // On error, just proceed to phone step
      setAuthStep('phone');
    } finally {
      setLoading(false);
    }
  };

  // Handle phone submission - send OTP
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    const formattedPhone = `+1${digits}`;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { data, error } = await supabase.functions.invoke('send-registration-otp', {
        body: {
          email: normalizedEmail,
          phone: formattedPhone,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send verification code');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Verification code sent!');
      setAuthStep('otp');
      setOtpCooldown(60);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (error: any) {
      console.error('Send OTP error:', error);
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    const normalizedEmail = email.toLowerCase().trim();
    const formattedPhone = existingUserPhone || `+1${phone.replace(/\D/g, '')}`;

    try {
      const { data, error } = await supabase.functions.invoke('verify-registration-otp', {
        body: {
          email: normalizedEmail,
          phone: formattedPhone,
          code: otpCode,
        },
      });

      if (error) {
        throw new Error(error.message || 'Invalid verification code');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Set the session directly
      if (data?.session?.access_token && data?.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error('Failed to establish session');
        }
      } else {
        throw new Error('No session returned from verification');
      }

      // Create or update user record to be a talent
      // First try to insert (for new users)
      const { error: userInsertError } = await supabase.from('users').insert({
        id: data.user.id,
        email: normalizedEmail,
        phone: formattedPhone,
        user_type: 'talent',
        created_at: new Date().toISOString(),
      });

      if (userInsertError) {
        // If insert fails (user exists), try update instead
        console.log('User insert failed (may already exist), trying update:', userInsertError.message);
        const { error: userUpdateError } = await supabase.from('users').update({
          user_type: 'talent',
          phone: formattedPhone,
        }).eq('id', data.user.id);

        if (userUpdateError) {
          console.error('Failed to update user type:', userUpdateError);
        }
      } else {
        console.log('User record created successfully');
      }

      toast.success(data.isLogin ? 'Welcome back!' : 'Account verified!');
      
      // Continue to profile setup
      await handleUserAuthenticated(data.user.id);
    } catch (error: any) {
      console.error('OTP verification error:', error);
      toast.error(error.message || 'Invalid verification code');
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    
    setLoading(true);
    const normalizedEmail = email.toLowerCase().trim();
    const formattedPhone = existingUserPhone || `+1${phone.replace(/\D/g, '')}`;

    try {
      const { data, error } = await supabase.functions.invoke('send-registration-otp', {
        body: {
          email: normalizedEmail,
          phone: formattedPhone,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to resend code');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('New code sent!');
      setOtpCooldown(60);
      setOtpCode('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Profile
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!talentProfileId) return toast.error('Profile not found');
    if (!profileData.fullName) return toast.error('Full name required');
    if (!profileData.username) return toast.error('Username required');
    if (usernameAvailable === false) return toast.error('Username taken');
    if (!profileData.bio || profileData.bio.length < 50) return toast.error('Bio must be 50+ characters');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          full_name: profileData.fullName,
          username: profileData.username.toLowerCase(),
          bio: profileData.bio,
          pricing: profileData.pricing,
          fulfillment_time_hours: profileData.fulfillmentTime,
          temp_avatar_url: profileData.avatarUrl,
        })
        .eq('id', talentProfileId);

      if (error) throw error;
      toast.success('Profile saved!');
      setCurrentStep(3);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Categories & Occasion Match
  const handleCategoriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!talentProfileId) return toast.error('Profile not found');
    if (profileData.categories.length === 0) return toast.error('Select at least one category');
    if (selectedShoutoutTypes.length === 0) return toast.error('Select at least one occasion');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          category: profileData.categories[0],
          categories: profileData.categories,
          selected_shoutout_types: selectedShoutoutTypes
        })
        .eq('id', talentProfileId);

      if (error) throw error;
      toast.success('Categories saved!');
      setCurrentStep(4);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save categories');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Charity
  const handleCharitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!talentProfileId) return;
    setLoading(true);
    try {
      await supabase
        .from('talent_profiles')
        .update({
          charity_name: donateToCharity ? charityData.charityName : null,
          charity_percentage: donateToCharity ? charityData.charityPercentage : 0,
        })
        .eq('id', talentProfileId);
      toast.success('Settings saved!');
      setCurrentStep(5);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Video - Final step, completes onboarding
  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoVideo) return toast.error('Please upload a video');
    if (!talentProfileId) return;

    setVideoUploading(true);
    try {
      const result = await uploadVideoToWasabi(promoVideo, talentProfileId);
      
      // Update video URL and mark onboarding as complete
      await supabase
        .from('talent_profiles')
        .update({ 
          promo_video_url: result.videoUrl,
          onboarding_completed: true,
          is_active: false // Admin must approve
        })
        .eq('id', talentProfileId);

      // Send admin notification
      try {
        await supabase.functions.invoke('onboarding-complete-notification', {
          body: { talentId: talentProfileId, talentName: profileData.fullName, email: email },
        });
      } catch (e) {}

      // Clear saved progress
      localStorage.removeItem('talent_start_progress');
      localStorage.removeItem('talent_start_email');

      toast.success('🎉 Onboarding complete! Pending admin approval.');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setVideoUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Logo size="sm" theme="dark" />
            </Link>
            <div className="text-right">
              <h1 className="text-xl sm:text-2xl font-bold text-white">Get Started On ShoutOut</h1>
              <p className="text-xs sm:text-sm text-gray-400">Start earning with personalized video ShoutOuts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-[280px,1fr] gap-6 lg:gap-8">
          {/* Sidebar */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 sm:p-6">
              <h3 className="text-base font-semibold text-white mb-4">Your Progress</h3>
              <nav className="space-y-1.5">
                {STEPS.map((step) => {
                  const Icon = step.icon;
                  const isCompleted = currentStep > step.id;
                  const isCurrent = currentStep === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                        isCurrent ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30' : ''
                      } ${isCompleted ? 'opacity-60' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-white/10'
                      }`}>
                        {isCompleted ? <CheckIcon className="w-4 h-4 text-white" /> : <Icon className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}>{step.name}</p>
                        <p className="text-xs text-gray-500 truncate">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </nav>
              <div className="mt-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-xs text-emerald-300">
                  <SparklesIcon className="w-4 h-4 inline mr-1" />
                  Progress auto-saved. Continue anytime!
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Step 1: Email-first OTP Auth (same as admin onboarding) */}
            {currentStep === 1 && (
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="max-w-md mx-auto">
                  {/* Email Step */}
                  {authStep === 'email' && (
                    <form onSubmit={handleEmailSubmit} className="space-y-5">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <DevicePhoneMobileIcon className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Get Started</h2>
                        <p className="text-gray-600 text-sm mt-1">
                          Enter your email to sign up or log in
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                          placeholder="Enter your email"
                          autoFocus
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loading ? 'Checking...' : 'Continue'}
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                    </form>
                  )}

                  {/* Phone Step */}
                  {authStep === 'phone' && (
                    <form onSubmit={handlePhoneSubmit} className="space-y-5">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Add Your Phone</h2>
                        <p className="text-gray-600 text-sm mt-1">
                          We'll send a verification code to your phone
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-600">
                          Email: <span className="font-medium">{email}</span>
                          <button
                            type="button"
                            onClick={() => setAuthStep('email')}
                            className="ml-2 text-emerald-600 hover:text-emerald-700 text-sm"
                          >
                            Change
                          </button>
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                          className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                          placeholder="(555) 123-4567"
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-1">We'll send you a verification code</p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <DevicePhoneMobileIcon className="w-5 h-5" />
                        {loading ? 'Sending code...' : 'Send Verification Code'}
                      </button>
                    </form>
                  )}

                  {/* OTP Step */}
                  {authStep === 'otp' && (
                    <form onSubmit={handleOtpSubmit} className="space-y-5">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Enter Code</h2>
                        <p className="text-gray-600 text-sm mt-1">
                          We sent a 6-digit code to
                        </p>
                        <p className="text-emerald-600 font-medium">
                          {existingUserPhone 
                            ? `***-***-${existingUserPhone.slice(-4)}`
                            : phone
                          }
                        </p>
                      </div>

                      <div>
                        <input
                          ref={otpInputRef}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center text-2xl tracking-[0.5em] font-mono text-gray-900"
                          placeholder="000000"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpCode.length !== 6}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loading ? 'Verifying...' : 'Verify & Continue'}
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>

                      <div className="text-center space-y-2">
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={otpCooldown > 0 || loading}
                          className="text-sm text-emerald-600 hover:text-emerald-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Didn't receive the code? Resend"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setAuthStep('phone');
                            setOtpCode('');
                            setExistingUserPhone(null);
                          }}
                          className="block w-full text-sm text-gray-500 hover:text-gray-700"
                        >
                          Use a different phone number
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Profile */}
            {currentStep === 2 && (
              <div className="p-6 sm:p-8 lg:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Profile</h2>
                <p className="text-gray-600 mb-6">This is how you'll appear to customers</p>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture *</label>
                    <ImageUpload
                      currentImageUrl={profileData.avatarUrl}
                      onImageUploaded={(url) => setProfileData({ ...profileData, avatarUrl: url })}
                      uploadPath="talent-avatars"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                    <input
                      type="text"
                      required
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-4 rounded-l-xl bg-gray-100 text-gray-500 text-sm border border-r-0 border-gray-300">
                        shoutout.us/
                      </span>
                      <input
                        type="text"
                        required
                        value={profileData.username}
                        onChange={(e) => setProfileData({ ...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        className={`flex-1 px-4 py-3 border rounded-r-xl focus:ring-2 ${
                          usernameAvailable === false ? 'border-red-500 focus:ring-red-500' :
                          usernameAvailable === true ? 'border-emerald-500 focus:ring-emerald-500' :
                          'border-gray-300 focus:ring-emerald-500'
                        }`}
                        placeholder="yourname"
                      />
                    </div>
                    {usernameAvailable === false && <p className="text-xs text-red-500 mt-1">Username taken</p>}
                    {usernameAvailable === true && <p className="text-xs text-emerald-500 mt-1">✓ Available</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio * (min 50 characters)</label>
                    <textarea
                      required
                      minLength={50}
                      rows={3}
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      placeholder="Tell your audience about yourself..."
                    />
                    <p className="text-xs text-gray-500 mt-1">{profileData.bio.length}/50 min</p>
                  </div>

                  <PricingHelper
                    followers={profileData.instagramFollowers}
                    onFollowersChange={(f) => setProfileData({ ...profileData, instagramFollowers: f })}
                    price={profileData.pricing}
                    onPriceChange={(p) => setProfileData({ ...profileData, pricing: p })}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Saving...' : 'Continue'}
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Step 3: Categories & Occasion Match */}
            {currentStep === 3 && (
              <div className="p-6 sm:p-8 lg:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Categories & Occasions</h2>
                <p className="text-gray-600 mb-6">Help customers find you</p>

                <form onSubmit={handleCategoriesSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categories * (up to 3)</label>
                    <p className="text-xs text-gray-500 mb-3">Select up to 3 categories that best describe you</p>
                    <CategorySelector
                      selectedCategories={profileData.categories}
                      onCategoryChange={(cats) => setProfileData({ ...profileData, categories: cats.slice(0, 3) })}
                      autoSave={true}
                      startEditing={true}
                      stayInEditMode={true}
                      maxSelections={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Occasion Match * (up to 3)</label>
                    <p className="text-xs text-gray-500 mb-3">
                      Pick which 3 occasions match your personality. (Don't worry, users can order any type - this just helps us show your profile for different occasions.)
                    </p>
                    <ShoutoutTypeSelector
                      selected={selectedShoutoutTypes}
                      onChange={setSelectedShoutoutTypes}
                      maxSelections={3}
                      autoSave={true}
                      startEditing={true}
                      stayInEditMode={true}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || profileData.categories.length === 0 || selectedShoutoutTypes.length === 0}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Saving...' : 'Continue'}
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Step 4: Charity */}
            {currentStep === 4 && (
              <div className="p-6 sm:p-8 lg:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Donate to Charity (Optional)</h2>
                <p className="text-gray-600 mb-4">Share a portion of your earnings with a cause you care about.</p>
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                  You'll need to handle the donation yourself after receiving your payout. We'll display your charity on your profile to show fans you're giving back.
                </p>

                <form onSubmit={handleCharitySubmit} className="space-y-5">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">Enable charity donation</p>
                      <p className="text-sm text-gray-500">Donate a % of each order</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDonateToCharity(!donateToCharity)}
                      className={`relative w-12 h-7 rounded-full transition-colors ${donateToCharity ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${donateToCharity ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {donateToCharity && (
                    <div className="space-y-4 p-4 border border-emerald-300 rounded-xl bg-white">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Select Charity</label>
                        <select
                          value={showCustomCharity ? 'custom' : charityData.charityName}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setShowCustomCharity(true);
                              setCharityData({ ...charityData, charityName: '' });
                            } else {
                              setShowCustomCharity(false);
                              setCharityData({ ...charityData, charityName: e.target.value });
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-gray-900"
                        >
                          <option value="">Select a charity...</option>
                          {charities.map((charity) => (
                            <option key={charity.id} value={charity.name}>{charity.name}</option>
                          ))}
                          <option value="custom">+ Add Custom Charity</option>
                        </select>
                      </div>

                      {showCustomCharity && (
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">Custom Charity Name</label>
                          <input
                            type="text"
                            value={charityData.charityName}
                            onChange={(e) => setCharityData({ ...charityData, charityName: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-gray-900 placeholder-gray-400"
                            placeholder="Enter charity name"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Donation %</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={100}
                            value={charityData.charityPercentage}
                            onChange={(e) => setCharityData({ ...charityData, charityPercentage: parseInt(e.target.value) || 5 })}
                            className="w-24 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-gray-900"
                          />
                          <span className="text-gray-700">% per order</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Saving...' : 'Continue'}
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Step 5: Video */}
            {currentStep === 5 && (
              <div className="p-6 sm:p-8 lg:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Promo Video</h2>
                <p className="text-gray-600 mb-6">Introduce yourself to potential customers (30-60 seconds)</p>

                <form onSubmit={handleVideoSubmit} className="space-y-5">
                  <details className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <summary className="font-medium text-blue-800 cursor-pointer">📝 Script Template</summary>
                    <div className="mt-3 text-sm text-blue-700 space-y-1">
                      <p><strong>1.</strong> "Hi! I'm [Your Name]..."</p>
                      <p><strong>2.</strong> "[Who you are - your background]"</p>
                      <p><strong>3.</strong> "I'm on ShoutOut - order a personalized video..."</p>
                      <p><strong>4.</strong> "[What makes your videos special]"</p>
                      <p><strong>5.</strong> "Find me on ShoutOut!"</p>
                    </div>
                  </details>

                  <div>
                    <input
                      type="file"
                      id="video-upload"
                      accept="video/*"
                      onChange={(e) => setPromoVideo(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label
                      htmlFor="video-upload"
                      className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                    >
                      <VideoCameraIcon className="w-8 h-8 text-gray-400" />
                      <span className="text-gray-600">{promoVideo ? promoVideo.name : 'Choose Video File'}</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-2 text-center">MP4, MOV, AVI • Max 300MB</p>
                  </div>

                  {promoVideo && (
                    <div className="rounded-xl overflow-hidden bg-black">
                      <video src={URL.createObjectURL(promoVideo)} controls className="w-full" style={{ maxHeight: '300px' }} />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!promoVideo || videoUploading}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {videoUploading ? 'Uploading...' : 'Continue'}
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default TalentStartPage;
