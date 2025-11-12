import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { 
  UserCircleIcon, 
  VideoCameraIcon, 
  CurrencyDollarIcon,
  CheckCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import ImageUpload from '../components/ImageUpload';
import Logo from '../components/Logo';
import CategorySelector from '../components/CategorySelector';
import { TalentCategory } from '../types';
import { uploadVideoToWasabi } from '../services/videoUpload';
import toast from 'react-hot-toast';
import MFAEnrollmentDual from '../components/MFAEnrollmentDual';

const PublicTalentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [defaultAdminFee, setDefaultAdminFee] = useState(25); // Default to 25%, will fetch from platform settings

  // Step 1: Account Creation
  const [accountData, setAccountData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [signInData, setSignInData] = useState({
    email: '',
    password: '',
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [talentProfileId, setTalentProfileId] = useState<string | null>(null);

  // Step 2: Profile Information
  const [profileData, setProfileData] = useState({
    fullName: '',
    username: '',
    category: '' as TalentCategory,
    categories: [] as TalentCategory[],
    bio: '',
    pricing: 50,
    fulfillmentTime: 72,
    avatarUrl: '',
    instagramHandle: '',
    tiktokHandle: '',
    facebookHandle: '',
    twitterHandle: '',
  });

  // Step 3: Charity (optional)
  const [donateToCharity, setDonateToCharity] = useState(false);
  const [charityData, setCharityData] = useState({
    charityName: '',
    charityPercentage: 5,
  });

  // Step 4: Promo Video
  const [promoVideo, setPromoVideo] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  const steps = [
    { number: 1, title: 'Create Account', icon: UserCircleIcon },
    { number: 2, title: 'Profile Info', icon: StarIcon },
    { number: 3, title: 'Charity (Optional)', icon: CurrencyDollarIcon },
    { number: 4, title: 'Promo Video', icon: VideoCameraIcon },
    { number: 5, title: 'Security (MFA)', icon: ShieldCheckIcon },
  ];

  // Fetch platform settings on mount
  useEffect(() => {
    fetchPlatformSettings();
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const { data, error} = await supabase
        .from('app_settings')
        .select('global_admin_fee_percentage')
        .single();

      if (error) throw error;

      if (data?.global_admin_fee_percentage) {
        setDefaultAdminFee(data.global_admin_fee_percentage);
        console.log('Platform settings loaded: admin fee =', data.global_admin_fee_percentage + '%');
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
      // Keep default of 25% if fetch fails
    }
  };

  // Load saved progress from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('talent_onboarding_progress');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.userId) setUserId(parsed.userId);
        if (parsed.talentProfileId) setTalentProfileId(parsed.talentProfileId);
        if (parsed.accountData) setAccountData({ ...accountData, ...parsed.accountData });
        if (parsed.profileData) setProfileData({ ...profileData, ...parsed.profileData });
        if (parsed.charityData) setCharityData({ ...charityData, ...parsed.charityData });
        if (parsed.donateToCharity !== undefined) setDonateToCharity(parsed.donateToCharity);
        toast.success('Progress restored! Continuing where you left off...');
      } catch (error) {
        console.error('Failed to parse saved progress:', error);
      }
    }
  }, []);

  // Check username availability with debounce
  useEffect(() => {
    if (!profileData.username || profileData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const timeoutId = setTimeout(async () => {
      try {
        const { data: existingProfile } = await supabase
          .from('talent_profiles')
          .select('id, username')
          .eq('username', profileData.username.toLowerCase())
          .neq('id', talentProfileId || '00000000-0000-0000-0000-000000000000')
          .maybeSingle();

        setUsernameAvailable(!existingProfile);
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [profileData.username, talentProfileId]);

  // Save progress to localStorage whenever critical data changes
  useEffect(() => {
    if (userId || currentStep > 1) {
      const dataToSave = {
        currentStep,
        userId,
        talentProfileId,
        accountData: { email: accountData.email, fullName: accountData.fullName },
        profileData,
        charityData,
        donateToCharity,
      };
      localStorage.setItem('talent_onboarding_progress', JSON.stringify(dataToSave));
    }
  }, [currentStep, userId, talentProfileId, profileData, charityData, donateToCharity]);

  // Sign In Handler (for returning users)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: signInResult, error: signInError } = await supabase.auth.signInWithPassword({
        email: signInData.email,
        password: signInData.password,
      });

      if (signInError) throw signInError;
      if (!signInResult.user) throw new Error('Failed to sign in');

      // Check for existing talent profile
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('talent_profiles')
        .select('id, onboarding_completed')
        .eq('user_id', signInResult.user.id)
        .single();

      if (!existingProfile) {
        toast.error('No talent profile found. Please create a new account.');
        return;
      }

      setUserId(signInResult.user.id);
      setTalentProfileId(existingProfile.id);

      if (existingProfile.onboarding_completed) {
        toast.success('Welcome back! Redirecting to dashboard...');
        navigate('/dashboard');
        return;
      }

      toast.success('Welcome back! Continuing your onboarding...');
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      // Provide more helpful error messages
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('Incorrect email or password. Please try again or create a new account.');
      } else if (error.message?.includes('Email not confirmed')) {
        toast.error('Please check your email to confirm your account first.');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Create Account
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (accountData.password !== accountData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (accountData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Check if user already exists and has a talent profile
      const { data: existingSession } = await supabase.auth.getSession();
      
      if (existingSession?.session?.user) {
        // User is already logged in, check for existing talent profile
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('talent_profiles')
          .select('id, onboarding_completed')
          .eq('user_id', existingSession.session.user.id)
          .single();

        if (existingProfile) {
          setUserId(existingSession.session.user.id);
          setTalentProfileId(existingProfile.id);
          
          if (existingProfile.onboarding_completed) {
            toast.success('Welcome back! Redirecting to dashboard...');
            navigate('/talent-dashboard');
            return;
          } else {
            toast.success('Continuing onboarding...');
            setCurrentStep(2);
            return;
          }
        }
      }

      // Try to create new account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: {
          data: {
            full_name: accountData.fullName,
          },
          emailRedirectTo: `${window.location.origin}/onboard`,
        },
      });

      // Handle "User already registered" error
      if (authError) {
        if (authError.message?.includes('User already registered')) {
          // Try to sign in instead
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: accountData.email,
            password: accountData.password,
          });

          if (signInError) {
            toast.error('Account exists. Please use the correct password or reset it.');
            return;
          }

          if (!signInData.user) throw new Error('Failed to sign in');

          // Check for existing talent profile
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from('talent_profiles')
            .select('id, onboarding_completed')
            .eq('user_id', signInData.user.id)
            .single();

          if (existingProfile) {
            setUserId(signInData.user.id);
            setTalentProfileId(existingProfile.id);
            
            if (existingProfile.onboarding_completed) {
              toast.success('Welcome back! Redirecting to dashboard...');
              navigate('/talent-dashboard');
              return;
            } else {
              toast.success('Continuing onboarding...');
              setCurrentStep(2);
              return;
            }
          }

          // If no talent profile exists, create one
          setUserId(signInData.user.id);
          
          // Create/update user record to set user_type to 'talent'
          const formattedPhone = accountData.phone ? `+1${accountData.phone.replace(/\D/g, '')}` : null;
          
          // Use upsert to create or update user record
          const { error: upsertError } = await supabase
            .from('users')
            .upsert({ 
              id: signInData.user.id,
              email: signInData.user.email,
              user_type: 'talent',
              phone: formattedPhone,
              full_name: accountData.fullName,
            }, {
              onConflict: 'id'
            });

          if (upsertError) {
            console.error('Failed to create/update user record:', upsertError);
            throw new Error('Failed to set up user account. Please contact support.');
          }

          const { data: talentData, error: talentError } = await supabase
            .from('talent_profiles')
            .insert({
              user_id: signInData.user.id,
              category: 'other',
              bio: '',
              pricing: 50,
              fulfillment_time_hours: 72,
              is_featured: false,
              is_active: false, // Admin must approve before going live
              total_orders: 0,
              fulfilled_orders: 0,
              average_rating: 0,
              admin_fee_percentage: defaultAdminFee, // Use platform settings
              first_orders_promo_active: true,
              onboarding_completed: false,
            })
            .select()
            .single();

          if (talentError) throw talentError;
          setTalentProfileId(talentData.id);
          toast.success('Continuing onboarding...');
          setCurrentStep(2);
          return;
        }
        
        throw authError;
      }

      if (!authData.user) throw new Error('Failed to create user account');
      
      setUserId(authData.user.id);

      // Create user record in public.users table
      const formattedPhone = accountData.phone ? `+1${accountData.phone.replace(/\D/g, '')}` : null;
      
      // Use upsert to create or update user record
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: authData.user.email,
          user_type: 'talent',
          phone: formattedPhone,
          full_name: accountData.fullName,
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error('Failed to create/update user record:', upsertError);
        throw new Error('Failed to set up user account. Please contact support.');
      }

      // Create talent profile (this will work even without active session)
      const { data: talentData, error: talentError } = await supabase
        .from('talent_profiles')
        .insert({
          user_id: authData.user.id,
          category: 'other', // Will be updated in step 2
          bio: '',
          pricing: 50,
          fulfillment_time_hours: 72,
          is_featured: false,
          is_active: false, // Admin must approve before going live
          total_orders: 0,
          fulfilled_orders: 0,
          average_rating: 0,
          admin_fee_percentage: defaultAdminFee, // Use platform settings
          first_orders_promo_active: true, // Enable 0% fee promo
          onboarding_completed: false,
        })
        .select()
        .single();

      if (talentError) throw talentError;
      setTalentProfileId(talentData.id);

      // Check if email confirmation is required
      if (authData.session === null && authData.user.email_confirmed_at === null) {
        toast.success('Account created! Please verify your email, then sign in to continue.', {
          duration: 8000,
        });
        setLoading(false);
        return;
      }

      toast.success('Account created successfully!');
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Profile Information
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!talentProfileId) {
      toast.error('Profile not found. Please start over.');
      return;
    }

    if (!profileData.fullName) {
      toast.error('Full name is required');
      return;
    }

    if (!profileData.username) {
      toast.error('Username is required');
      return;
    }

    if (usernameAvailable === false) {
      toast.error(`Username "${profileData.username}" is already taken. Please choose another.`);
      return;
    }

    if (profileData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    if (!profileData.bio || profileData.bio.length < 50) {
      toast.error('Bio must be at least 50 characters');
      return;
    }

    setLoading(true);

    try {
      // Check if username is already taken by another profile
      const { data: existingProfile } = await supabase
        .from('talent_profiles')
        .select('id, username')
        .eq('username', profileData.username.toLowerCase())
        .neq('id', talentProfileId) // Exclude current profile
        .maybeSingle();

      if (existingProfile) {
        toast.error(`Username "${profileData.username}" is already taken. Please choose another.`);
        setLoading(false);
        return;
      }

      // Update talent profile
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          full_name: profileData.fullName,
          username: profileData.username.toLowerCase(),
          category: profileData.categories[0], // Primary category
          categories: profileData.categories, // All categories
          bio: profileData.bio,
          pricing: profileData.pricing,
          fulfillment_time_hours: profileData.fulfillmentTime,
          temp_avatar_url: profileData.avatarUrl,
          instagram_handle: profileData.instagramHandle || null,
          tiktok_handle: profileData.tiktokHandle || null,
          facebook_handle: profileData.facebookHandle || null,
          twitter_handle: profileData.twitterHandle || null,
        })
        .eq('id', talentProfileId);

      if (error) {
        // Handle specific constraint violation error
        if (error.message.includes('idx_talent_profiles_username') || error.message.includes('duplicate key')) {
          throw new Error(`Username "${profileData.username}" is already taken. Please choose another.`);
        }
        throw error;
      }

      toast.success('Profile information saved!');
      setCurrentStep(3);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Charity (Optional)
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!talentProfileId) {
      toast.error('Profile not found. Please start over.');
      return;
    }

    setLoading(true);

    try {
      // Update charity info (can be empty)
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          charity_name: donateToCharity && charityData.charityName ? charityData.charityName : null,
          charity_percentage: donateToCharity && charityData.charityName ? charityData.charityPercentage : 0,
        })
        .eq('id', talentProfileId);

      if (error) throw error;

      toast.success('Charity settings saved!');
      setCurrentStep(4);
    } catch (error: any) {
      console.error('Error saving charity:', error);
      toast.error(error.message || 'Failed to save charity settings');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Promo Video
  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!promoVideo) {
      toast.error('Please upload a promo video');
      return;
    }

    if (!talentProfileId) {
      toast.error('Profile not found. Please start over.');
      return;
    }

    setVideoUploading(true);

    try {
      // Upload video to Wasabi
      const uploadResult = await uploadVideoToWasabi(promoVideo, talentProfileId);

      // Update talent profile with video URL
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          promo_video_url: uploadResult.videoUrl,
        })
        .eq('id', talentProfileId);

      if (error) throw error;

      // Send admin notification
      try {
        await supabase.functions.invoke('onboarding-complete-notification', {
          body: {
            talentId: talentProfileId,
            talentName: accountData.fullName,
            email: accountData.email,
          },
        });
      } catch (notifError) {
        console.error('Failed to send admin notification:', notifError);
        // Don't block onboarding if notification fails
      }

      toast.success('Promo video uploaded successfully!');
      setCurrentStep(5);
    } catch (error: any) {
      console.error('Error uploading video:', error);
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setVideoUploading(false);
    }
  };

  // Step 5: MFA Complete (Final step)
  const handleMFAComplete = async () => {
    if (!talentProfileId) {
      toast.error('Profile not found. Please start over.');
      return;
    }

    try {
      // Mark onboarding as complete - profile stays INACTIVE until admin approves
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          onboarding_completed: true,
          is_active: false, // Admin must approve before profile goes live
        })
        .eq('id', talentProfileId);

      if (error) throw error;

      // Clear saved onboarding progress
      localStorage.removeItem('talent_onboarding_progress');

      toast.success('🎉 Onboarding complete! Your profile is pending admin approval.');
      
      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    }
  };

  return (
    <div className="min-h-screen py-3 px-3 sm:py-8 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Logo - Compact */}
        <div className="flex justify-center mb-3">
          <Logo size="sm" theme="dark" className="h-8" />
        </div>

        {/* Header - Compact */}
        <div className="text-center mb-3">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1">
            Become a ShoutOut Talent
          </h1>
          <p className="text-xs sm:text-sm text-gray-300">
            Join and start earning with personalized videos
          </p>
        </div>

        {/* Progress Steps - Mobile Responsive */}
        <div className="mb-6">
          <div className="flex items-center justify-between max-w-4xl mx-auto px-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div
                    className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold mb-1 sm:mb-2 ${
                      currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : currentStep === step.number
                        ? 'bg-blue-500 text-white'
                        : 'glass border-2 border-white/30 text-white'
                    }`}
                  >
                    {currentStep > step.number ? '✓' : step.number}
                  </div>
                  <p className={`text-[10px] sm:text-xs font-medium text-center whitespace-nowrap px-1 ${
                    currentStep >= step.number ? 'text-white' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-4 sm:w-8 md:w-12 h-0.5 sm:h-1 mb-6 sm:mb-8 ${
                      currentStep > step.number ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content - Compact */}
        <div className="glass-strong rounded-2xl shadow-2xl border border-white/30 p-4 sm:p-6">
          {/* Step 1: Create Account or Sign In */}
          {currentStep === 1 && !showSignIn && (
            <form onSubmit={handleStep1Submit} autoComplete="on">
              <h2 className="text-xl font-bold text-white mb-3">Create Your Account</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={accountData.fullName}
                    onChange={(e) => setAccountData({ ...accountData, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={accountData.email}
                    onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    value={accountData.phone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      if (cleaned.length <= 10) {
                        let formatted = cleaned;
                        if (cleaned.length > 6) {
                          formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                        } else if (cleaned.length > 3) {
                          formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
                        } else if (cleaned.length > 0) {
                          formatted = `(${cleaned}`;
                        }
                        setAccountData({ ...accountData, phone: formatted });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 123-4567"
                  />
                  <p className="text-xs text-gray-400 mt-1">For account security & payouts</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={accountData.password}
                    onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={accountData.confirmPassword}
                    onChange={(e) => setAccountData({ ...accountData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account & Continue'}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowSignIn(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Already started? Sign in to continue
                </button>
              </div>
            </form>
          )}

          {/* Step 1: Sign In Form */}
          {currentStep === 1 && showSignIn && (
            <form onSubmit={handleSignIn} autoComplete="on">
              <h2 className="text-xl font-bold text-white mb-3">Sign In to Continue</h2>
              <p className="text-xs text-gray-300 mb-4">
                Resume your onboarding where you left off
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-r from-green-600 to-green-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:from-green-700 hover:to-green-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing In...' : 'Sign In & Continue'}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowSignIn(false)}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Need to create an account?
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Profile Information */}
          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit}>
              <h2 className="text-xl font-bold text-white mb-3">Profile Information</h2>
              
              <div className="space-y-3">
                {/* Profile Picture - Compact */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Profile Picture *
                  </label>
                  <div className="flex items-center gap-3">
                    {profileData.avatarUrl && (
                      <img src={profileData.avatarUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover" />
                    )}
                    <ImageUpload
                      currentImageUrl={profileData.avatarUrl}
                      onImageUploaded={(url) => setProfileData({ ...profileData, avatarUrl: url })}
                      uploadPath="talent-avatars"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileData.fullName}
                    onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Smith"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Username * (profile URL)
                  </label>
                  <div className="flex items-center text-sm">
                    <span className="glass px-2 py-2 rounded-l-lg text-gray-300 border border-white/30 border-r-0 text-xs">
                      shoutout.us/
                    </span>
                    <input
                      type="text"
                      required
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className={`flex-1 px-3 py-2 text-sm glass border rounded-r-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                        usernameAvailable === false 
                          ? 'border-red-500 focus:ring-red-500' 
                          : usernameAvailable === true 
                            ? 'border-green-500 focus:ring-green-500'
                            : 'border-white/30 focus:ring-blue-500'
                      }`}
                      placeholder="yourname"
                    />
                  </div>
                  {usernameAvailable === false && (
                    <p className="text-xs text-red-400 mt-1">
                      ❌ Username already taken - please choose another
                    </p>
                  )}
                  {usernameAvailable === true && (
                    <p className="text-xs text-green-400 mt-1">
                      ✓ Username available
                    </p>
                  )}
                  {checkingUsername && (
                    <p className="text-xs text-gray-400 mt-1">
                      Checking availability...
                    </p>
                  )}
                </div>

                {/* Categories - Multi Select */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Categories * (Select all that apply)
                  </label>
                  <CategorySelector
                    selectedCategories={profileData.categories}
                    onCategoryChange={(categories) => setProfileData({ ...profileData, categories })}
                    autoSave={true}
                    startEditing={true}
                    stayInEditMode={true}
                  />
                </div>

                {/* Position/Title */}

                {/* Bio - Compact */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Bio * (min 50 characters)
                  </label>
                  <textarea
                    required
                    minLength={50}
                    rows={3}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tell your audience about yourself..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {profileData.bio.length}/50 min
                  </p>
                </div>

                {/* Pricing */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Price per Video ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    step="5"
                    value={profileData.pricing}
                    onChange={(e) => setProfileData({ ...profileData, pricing: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="50"
                  />
                  <p className="text-xs text-gray-400 mt-1">Recommended: $50-$200</p>
                </div>

                {/* Fulfillment Time */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Fulfillment Time * (hours)
                  </label>
                  <input
                    type="number"
                    required
                    min="24"
                    step="24"
                    value={profileData.fulfillmentTime}
                    onChange={(e) => setProfileData({ ...profileData, fulfillmentTime: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    24h = 1 day, 72h = 3 days
                  </p>
                </div>

                {/* Social Media Handles (Optional) */}
                <div className="pt-3 border-t border-white/20">
                  <h3 className="text-sm font-semibold text-white mb-2">Social Media (Optional)</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">
                        Instagram Handle
                      </label>
                      <input
                        type="text"
                        value={profileData.instagramHandle}
                        onChange={(e) => setProfileData({ ...profileData, instagramHandle: e.target.value })}
                        className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="@yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">
                        TikTok Handle
                      </label>
                      <input
                        type="text"
                        value={profileData.tiktokHandle}
                        onChange={(e) => setProfileData({ ...profileData, tiktokHandle: e.target.value })}
                        className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="@yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">
                        Facebook Handle
                      </label>
                      <input
                        type="text"
                        value={profileData.facebookHandle}
                        onChange={(e) => setProfileData({ ...profileData, facebookHandle: e.target.value })}
                        className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="@yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">
                        X (Twitter) Handle
                      </label>
                      <input
                        type="text"
                        value={profileData.twitterHandle}
                        onChange={(e) => setProfileData({ ...profileData, twitterHandle: e.target.value })}
                        className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="@yourhandle"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </form>
          )}

          {/* Step 3: Charity (Optional) */}
          {currentStep === 3 && (
            <form onSubmit={handleStep3Submit}>
              <h2 className="text-xl font-bold text-white mb-3">Charity Donation (Optional)</h2>
              
              <p className="text-xs text-gray-300 mb-3">
                Payout details can be added in your dashboard after onboarding.
              </p>

              {/* Charity Toggle - Compact */}
              <div className="glass-strong rounded-xl p-4 mb-3 border border-white/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Donate to Charity</h3>
                    <p className="text-xs text-gray-300">Share earnings with a charity</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDonateToCharity(!donateToCharity);
                      if (!donateToCharity) {
                        setCharityData({ charityName: '', charityPercentage: 5 });
                      }
                    }}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      donateToCharity ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        donateToCharity ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show charity fields when toggle is ON */}
                {donateToCharity && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-white/20">
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">
                        Charity Name *
                      </label>
                      <input
                        type="text"
                        required={donateToCharity}
                        value={charityData.charityName}
                        onChange={(e) => setCharityData({ ...charityData, charityName: e.target.value })}
                        className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Red Cross, St. Jude's"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white mb-1">
                        Donation % (5-100%) *
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          required={donateToCharity}
                          min="5"
                          max="100"
                          value={charityData.charityPercentage}
                          onChange={(e) => setCharityData({ ...charityData, charityPercentage: parseInt(e.target.value) || 5 })}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 5;
                            const clamped = Math.max(5, Math.min(100, val));
                            setCharityData({ ...charityData, charityPercentage: clamped });
                          }}
                          className="w-20 px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-white font-semibold">%</span>
                        <span className="text-xs text-gray-300">per order</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </form>
          )}

          {/* Step 4: Promo Video */}
          {currentStep === 4 && (
            <form onSubmit={handleStep4Submit}>
              <h2 className="text-xl font-bold text-white mb-3">Upload Promo Video</h2>
              
              <div className="space-y-3">
                {/* Script Template - Collapsible */}
                <details className="glass border border-white/20 rounded-lg p-3">
                  <summary className="text-sm font-semibold text-white cursor-pointer">
                    📝 Script Template (30-60 sec)
                  </summary>
                  <div className="text-xs text-gray-300 space-y-1.5 mt-2">
                    <p><strong>1. Opening:</strong> "Hi! I'm [Your Name]..."</p>
                    <p><strong>2. Intro:</strong> "[Who you are - Former Fox News, Congressman, etc.]"</p>
                    <p><strong>3. Service:</strong> "I'm on ShoutOut - order a personalized video..."</p>
                    <p><strong>4. Personal:</strong> "[What makes your videos special]"</p>
                    <p><strong>5. Close:</strong> "Find me on ShoutOut!"</p>
                  </div>
                </details>

                {/* Recording Tips - Collapsible */}
                <details className="glass border border-white/20 rounded-lg p-3">
                  <summary className="text-sm font-semibold text-white cursor-pointer">
                    💡 Recording Tips
                  </summary>
                  <ul className="text-xs text-gray-300 space-y-0.5 mt-2">
                    <li>• Good lighting (natural light)</li>
                    <li>• Clear audio (no background noise)</li>
                    <li>• Look at the camera</li>
                    <li>• Speak clearly & enthusiastically</li>
                    <li>• Be authentic!</li>
                  </ul>
                </details>

                {/* Video Upload - Compact */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1">
                    Upload Video *
                  </label>
                  <input
                    type="file"
                    id="promo-video-upload"
                    accept="video/*"
                    required
                    onChange={(e) => setPromoVideo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="promo-video-upload"
                    className="flex items-center justify-center gap-2 glass-strong hover:glass border border-white/30 rounded-lg px-4 py-3 cursor-pointer transition-all duration-300"
                  >
                    <VideoCameraIcon className="h-5 w-5 text-white" />
                    <span className="text-sm font-medium text-white truncate">
                      {promoVideo ? promoVideo.name : 'Choose Video'}
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-400 text-center">
                    MP4, MOV, AVI • Max 300MB
                  </p>

                  {/* Video Preview - Compact */}
                  {promoVideo && (
                    <div className="mt-3">
                      <div className="relative rounded-lg overflow-hidden bg-gray-900">
                        <video
                          src={URL.createObjectURL(promoVideo)}
                          controls
                          className="w-full h-auto"
                          style={{ maxHeight: '200px' }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!promoVideo || videoUploading}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {videoUploading ? 'Uploading...' : 'Continue'}
              </button>
            </form>
          )}

          {/* Step 5: MFA */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-3">Secure Your Account</h2>
              
              <p className="text-xs text-gray-300 mb-3">
                Set up two-factor authentication to protect your account. Choose authenticator app for best results.
              </p>

              <MFAEnrollmentDual
                onComplete={handleMFAComplete}
                required={false}
                initialPhone={accountData.phone ? `+1${accountData.phone.replace(/\D/g, '')}` : undefined}
              />
              
              <button
                onClick={handleMFAComplete}
                className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-colors"
              >
                Skip MFA for Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicTalentOnboardingPage;

