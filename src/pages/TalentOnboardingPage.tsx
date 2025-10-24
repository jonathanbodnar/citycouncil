import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  UserIcon, 
  CreditCardIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ExclamationTriangleIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon,
  HeartIcon,
  CheckBadgeIcon,
  ShareIcon
} from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import { bankEncryption } from '../services/encryption';
import { uploadVideoToWasabi } from '../services/videoUpload';
import { TalentOnboardingData, TalentCategory } from '../types';
import Logo from '../components/Logo';
import CategorySelector from '../components/CategorySelector';
import ImageUpload from '../components/ImageUpload';
import SecureBankInput from '../components/SecureBankInput';
import SupportChatWidget from '../components/SupportChatWidget';
import toast from 'react-hot-toast';

const TalentOnboardingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [onboardingData, setOnboardingData] = useState<TalentOnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  
  // Step 1: Account Setup
  const [accountData, setAccountData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Step 2: Profile Details
  const [profileData, setProfileData] = useState({
    bio: '',
    position: '',
    category: 'other' as TalentCategory,
    categories: [] as TalentCategory[],
    pricing: 299.99,
    corporate_pricing: 449.99,
    fulfillment_time_hours: 48,
    charity_percentage: 5, // Default minimum when enabled
    charity_name: '',
    social_accounts: []
  });
  
  // Charity donation toggle
  const [donateProceeds, setDonateProceeds] = useState(false);

  // Step 3: Payout Details
  const [payoutData, setPayoutData] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'checking' as 'checking' | 'savings'
  });

  // Step 4: Welcome Video
  const [welcomeVideoFile, setWelcomeVideoFile] = useState<File | null>(null);
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    if (token) {
      fetchOnboardingData();
    }
  }, [token]);

  const fetchOnboardingData = async () => {
    try {
      setLoading(true);
      
      console.log('Looking for onboarding token:', token);
      
      // First, let's check if any talent profiles exist at all
      const { data: allTalents, error: allError } = await supabase
        .from('talent_profiles')
        .select('id, username, onboarding_token, onboarding_expires_at')
        .limit(5);
      
      console.log('All talent profiles (first 5):', { allTalents, allError });
      
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('onboarding_token', token)
        .single();

      console.log('Onboarding query result:', { data, error });

      if (error) {
        console.error('Database error:', error);
        
        // If it's a column doesn't exist error, provide helpful message
        if (error.message.includes('column') && error.message.includes('onboarding_token')) {
          console.error('MIGRATION NEEDED: The onboarding_token column does not exist. Please run the database migration scripts.');
        }
        
        throw error;
      }

      // Sync avatar URLs if needed - ensure temp_avatar_url takes priority
      if (data && data.temp_avatar_url && data.user_id && 
          data.users?.avatar_url !== data.temp_avatar_url) {
        
        console.log('Syncing temp_avatar_url to users.avatar_url:', {
          temp_avatar_url: data.temp_avatar_url,
          current_users_avatar_url: data.users?.avatar_url
        });
        
        const { error: syncError } = await supabase
          .from('users')
          .update({ avatar_url: data.temp_avatar_url })
          .eq('id', data.user_id);
          
        if (!syncError && data.users) {
          // Update the data object to reflect the sync
          data.users.avatar_url = data.temp_avatar_url;
          console.log('Avatar sync successful');
        } else if (syncError) {
          console.error('Avatar sync failed:', syncError);
        }
      }

      if (!data) {
        setOnboardingData({
          token: token!,
          talent: null as any,
          expired: true
        });
        return;
      }

      const expired = data.onboarding_expires_at && new Date(data.onboarding_expires_at) < new Date();
      
      setOnboardingData({
        token: token!,
        talent: data,
        expired: expired || false
      });

      if (data.onboarding_completed) {
        navigate('/login');
        toast.success('You have already completed onboarding. Please log in.');
        return;
      }

      // Check if user account already exists (step 1 completed)
      if (data.user_id) {
        // User account exists, but they need to authenticate first
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && user.id === data.user_id) {
          // User is already authenticated, go to Step 2
          setCurrentStep(2);
          toast.success('Welcome back! Continue your profile setup.');
        } else {
          // User exists but not authenticated, show login
          setCurrentStep(1); // Stay on Step 1 but show login form
          toast.success('Please log in to continue your profile setup.');
        }
      }

      // Pre-fill profile data (use actual saved values, not fallbacks)
      setProfileData({
        bio: data.bio || '',
        position: data.position || '',
        category: data.category || 'other',
        categories: data.categories || [],
        pricing: data.pricing ?? 299.99, // Use nullish coalescing to preserve 0 values
        corporate_pricing: data.corporate_pricing ?? 449.99,
        fulfillment_time_hours: data.fulfillment_time_hours ?? 48,
        charity_percentage: data.charity_percentage ?? 5,
        charity_name: data.charity_name || '',
        social_accounts: data.social_accounts || []
      });
      
      console.log('LOADED profile data from database:', {
        bio: data.bio,
        pricing: data.pricing,
        fulfillment_time_hours: data.fulfillment_time_hours,
        charity_percentage: data.charity_percentage,
        charity_name: data.charity_name
      });
      
      // Set charity donation toggle based on existing data
      setDonateProceeds(data.charity_percentage > 0 && data.charity_name);

    } catch (error) {
      console.error('Error fetching onboarding data:', error);
      setOnboardingData({
        token: token!,
        talent: null as any,
        expired: true
      });
    } finally {
      setLoading(false);
    }
  };

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

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: {
          data: {
            full_name: onboardingData?.talent.temp_full_name || 'Talent Member',
            user_type: 'talent'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user record in our users table
        const { error: userError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email: accountData.email,
              full_name: onboardingData?.talent.temp_full_name || 'Talent Member',
              user_type: 'talent',
              avatar_url: onboardingData?.talent.temp_avatar_url
            }
          ]);

        if (userError) throw userError;

        // Update talent profile with user ID
        const { error: updateError } = await supabase
          .from('talent_profiles')
          .update({ user_id: authData.user.id })
          .eq('id', onboardingData?.talent.id);

        if (updateError) throw updateError;

        toast.success('Account created successfully!');
        setCurrentStep(2);
      }

    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Failed to create account');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Sign in existing user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Verify this user is associated with the talent profile
        if (authData.user.id !== onboardingData?.talent.user_id) {
          toast.error('This email is not associated with this talent profile');
          return;
        }

        console.log('LOGIN SUCCESS: User authenticated for onboarding:', {
          userId: authData.user.id,
          talentUserId: onboardingData?.talent.user_id,
          email: authData.user.email
        });
        
        toast.success('Logged in successfully!');
        setCurrentStep(2);
      }

    } catch (error: any) {
      console.error('Error logging in:', error);
      toast.error(error.message || 'Failed to log in');
    }
  };

  const updateProfilePreview = async (updates: Partial<typeof profileData>) => {
    console.log('updateProfilePreview called with:', updates);
    
    // Update the profile data state
    setProfileData(prev => ({ ...prev, ...updates }));
    
    // Update the onboarding data for live preview
    if (onboardingData) {
      console.log('Updating onboarding data with updates:', updates);
      setOnboardingData({
        ...onboardingData,
        talent: {
          ...onboardingData.talent,
          ...updates
        }
      });
      
      // ALSO SAVE TO DATABASE IMMEDIATELY (like admin edits)
      try {
        console.log('SAVING to database immediately:', updates);
        
        // Check authentication and permissions
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current authenticated user:', user?.id);
        console.log('Talent user_id:', onboardingData.talent.user_id);
        console.log('User IDs match:', user?.id === onboardingData.talent.user_id);
        console.log('User email:', user?.email);
        console.log('User type from metadata:', user?.user_metadata?.user_type);
        
        if (!user) {
          console.error('PROBLEM: No authenticated user found!');
          return;
        }
        
        if (user.id !== onboardingData.talent.user_id) {
          console.error('PROBLEM: User ID mismatch - cannot update talent profile!');
          console.error('Auth user ID:', user.id);
          console.error('Talent user_id:', onboardingData.talent.user_id);
          return;
        }
        
        // Prepare the update with proper field mapping
        const dbUpdate: any = { ...updates };
        
        // Ensure temp fields are also updated for consistency
        if (updates.bio) dbUpdate.bio = updates.bio;
        if (updates.pricing) dbUpdate.pricing = updates.pricing;
        if (updates.corporate_pricing) dbUpdate.corporate_pricing = updates.corporate_pricing;
        if (updates.fulfillment_time_hours) dbUpdate.fulfillment_time_hours = updates.fulfillment_time_hours;
        if (updates.charity_percentage !== undefined) dbUpdate.charity_percentage = updates.charity_percentage;
        if (updates.charity_name !== undefined) dbUpdate.charity_name = updates.charity_name;
        if (updates.categories) dbUpdate.categories = updates.categories;
        if (updates.category) dbUpdate.category = updates.category;
        if (updates.position !== undefined) dbUpdate.position = updates.position;
        
        console.log('Database update payload:', dbUpdate);
        console.log('Talent ID for update:', onboardingData.talent.id);
        
        // Try a simple single field update first
        const { data: testResult, error: testError } = await supabase
          .from('talent_profiles')
          .update({ bio: updates.bio || onboardingData.talent.bio })
          .eq('id', onboardingData.talent.id)
          .select('id, bio');
          
        console.log('Simple bio update test:', { data: testResult, error: testError });
        
        // If that works, try the full update
        const { error } = await supabase
          .from('talent_profiles')
          .update(dbUpdate)
          .eq('id', onboardingData.talent.id);
          
        console.log('Database save result:', { error });
          
        if (error) {
          console.error('FAILED: Profile preview update error:', error);
          console.error('Update payload that failed:', dbUpdate);
          console.error('Talent ID:', onboardingData.talent.id);
        } else {
          console.log('SUCCESS: Profile preview saved to database');
          console.log('Saved fields:', Object.keys(dbUpdate));
          
          // Verify the data was actually saved by querying it back
          const { data: verifyData } = await supabase
            .from('talent_profiles')
            .select('bio, pricing, fulfillment_time_hours, charity_percentage, charity_name, temp_avatar_url')
            .eq('id', onboardingData.talent.id)
            .single();
            
          if (verifyData) {
            console.log('VERIFICATION: Current data in database:', verifyData);
          }
        }
      } catch (error) {
        console.error('Failed to save profile preview:', error);
      }
    }
  };

  const updateAvatarPreview = async (avatarUrl: string) => {
    console.log('updateAvatarPreview called with:', avatarUrl);
    
    // Update the onboarding data for live preview
    if (onboardingData) {
      console.log('Updating onboarding data with new avatar URL');
      setOnboardingData({
        ...onboardingData,
        talent: {
          ...onboardingData.talent,
          temp_avatar_url: avatarUrl,
          users: {
            ...onboardingData.talent.users,
            avatar_url: avatarUrl
          }
        }
      });
      
      // ALSO SAVE TO DATABASE IMMEDIATELY
      try {
        console.log('SAVING avatar to database immediately:', avatarUrl);
        const { error } = await supabase
          .from('talent_profiles')
          .update({ temp_avatar_url: avatarUrl })
          .eq('id', onboardingData.talent.id);
          
        if (error) {
          console.error('Error saving avatar update:', error);
        } else {
          console.log('Avatar saved to database successfully');
        }
      } catch (error) {
        console.error('Failed to save avatar:', error);
      }
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare update data
      const updateData: any = {
        bio: profileData.bio,
        category: profileData.category,
        categories: profileData.categories,
        pricing: profileData.pricing,
        corporate_pricing: profileData.corporate_pricing,
        fulfillment_time_hours: profileData.fulfillment_time_hours,
        charity_percentage: profileData.charity_percentage,
        charity_name: profileData.charity_name,
        social_accounts: profileData.social_accounts,
        temp_avatar_url: onboardingData?.talent.temp_avatar_url // Save uploaded image
      };

      // Add position field if it's provided (after migration)
      if (profileData.position !== undefined) {
        updateData.position = profileData.position || null;
      }

      // Update talent profile
      const { error: talentError } = await supabase
        .from('talent_profiles')
        .update(updateData)
        .eq('id', onboardingData?.talent.id);

      if (talentError) throw talentError;

      // Update user avatar if image was uploaded and user exists
      if (onboardingData?.talent.user_id && onboardingData?.talent.temp_avatar_url) {
        console.log('Updating user avatar:', {
          userId: onboardingData.talent.user_id,
          avatarUrl: onboardingData.talent.temp_avatar_url
        });
        
        const { error: userError } = await supabase
          .from('users')
          .update({
            avatar_url: onboardingData.talent.temp_avatar_url
          })
          .eq('id', onboardingData.talent.user_id);

        if (userError) {
          console.error('Error updating user avatar:', userError);
          toast.error('Failed to update profile image');
        } else {
          console.log('User avatar updated successfully');
        }
      }

      toast.success('Profile updated successfully!');
      setCurrentStep(3);

    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Step 3 form submitted!');
    console.log('Payout data:', payoutData);
    
    // Validate required fields (temporarily exclude routing number)
    if (!payoutData.account_holder_name || !payoutData.bank_name || !payoutData.account_number) {
      toast.error('Please fill in all required fields');
      console.log('Missing required fields:', {
        account_holder_name: !!payoutData.account_holder_name,
        bank_name: !!payoutData.bank_name,
        account_number: !!payoutData.account_number,
        routing_number: !!payoutData.routing_number
      });
      return;
    }

    // Validate routing number format if provided
    if (payoutData.routing_number && payoutData.routing_number.length !== 9) {
      toast.error('Routing number must be exactly 9 digits');
      console.log('Invalid routing number length:', payoutData.routing_number.length);
      return;
    }
    
    try {
      // Encrypt sensitive bank account information
      console.log('Encrypting bank account information...');
      const { encryptedAccount, encryptedRouting } = await bankEncryption.encryptBankInfo(
        payoutData.account_number,
        payoutData.routing_number
      );

      // Save encrypted bank information
      const { error: bankError } = await supabase
        .from('vendor_bank_info')
        .insert([{
          talent_id: onboardingData?.talent.id,
          account_holder_name: payoutData.account_holder_name,
          bank_name: payoutData.bank_name,
          account_type: payoutData.account_type,
          // Store encrypted data
          account_number_encrypted: encryptedAccount.encrypted,
          account_number_iv: encryptedAccount.iv,
          routing_number_encrypted: encryptedRouting.encrypted,
          routing_number_iv: encryptedRouting.iv,
          // Store masked versions for display
          account_number_masked: bankEncryption.maskAccountNumber(payoutData.account_number),
          routing_number_masked: bankEncryption.maskRoutingNumber(payoutData.routing_number),
          is_verified: false
        }]);

      if (bankError) throw bankError;
      console.log('Bank information encrypted and saved successfully');

      // Final avatar sync before completion
      if (onboardingData?.talent.user_id && onboardingData?.talent.temp_avatar_url) {
        const { error: finalAvatarError } = await supabase
          .from('users')
          .update({
            avatar_url: onboardingData.talent.temp_avatar_url
          })
          .eq('id', onboardingData.talent.user_id);

        if (finalAvatarError) {
          console.error('Error in final avatar sync:', finalAvatarError);
        }
      }

      toast.success('Payout information saved! Now let\'s create your welcome video.');
      setCurrentStep(4);

    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    }
  };

  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let finalVideoUrl = welcomeVideoUrl;
      
      // Upload video if file is selected
      if (welcomeVideoFile) {
        setUploadingVideo(true);
        console.log('Uploading welcome video to Wasabi...');
        
        const uploadResult = await uploadVideoToWasabi(
          welcomeVideoFile, 
          `welcome-videos/${onboardingData?.talent.id}-welcome-${Date.now()}.mp4`
        );
        
        if (!uploadResult.success || !uploadResult.videoUrl) {
          throw new Error(uploadResult.error || 'Failed to upload video');
        }
        
        finalVideoUrl = uploadResult.videoUrl;
        console.log('Welcome video uploaded successfully:', finalVideoUrl);
      }

      // Save welcome video URL and complete onboarding
      const { error: videoError } = await supabase
        .from('talent_profiles')
        .update({
          welcome_video_url: finalVideoUrl,
          onboarding_completed: true,
          is_active: true, // Activate talent when onboarding completes
          onboarding_token: null,
          onboarding_expires_at: null
        })
        .eq('id', onboardingData?.talent.id);

      if (videoError) throw videoError;

      toast.success('Welcome video uploaded! Onboarding completed - Welcome to ShoutOut!');
      navigate('/dashboard');

    } catch (error: any) {
      console.error('Error uploading welcome video:', error);
      toast.error(error.message || 'Failed to upload welcome video');
    } finally {
      setUploadingVideo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!onboardingData || onboardingData.expired || !onboardingData.talent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Logo size="lg" className="mx-auto mb-8" />
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid or Expired Link</h1>
          <p className="text-gray-600 mb-6">
            This onboarding link is either invalid or has expired. Please contact your administrator for a new invitation.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { number: 1, title: 'Account Setup', icon: UserIcon },
    { number: 2, title: 'Profile Details', icon: UserIcon },
    { number: 3, title: 'Payout Setup', icon: CreditCardIcon },
    { number: 4, title: 'Welcome Video', icon: VideoCameraIcon }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Logo size="md" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step.number
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-500'
                }`}>
                  {currentStep > step.number ? (
                    <CheckCircleIcon className="w-6 h-6" />
                  ) : (
                    <span className="text-sm font-semibold">{step.number}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    currentStep >= step.number ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Welcome Message */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to ShoutOut!
          </h1>
          <p className="text-gray-600 mb-4">
            You've been invited to join as a talent member. Let's get your profile set up.
          </p>
          
          {/* Complete Setup Button */}
          <div className="mb-6">
            <button
              disabled
              className="w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-lg font-semibold cursor-not-allowed"
            >
              Complete Setup to Enable Orders
            </button>
          </div>
          
          {/* Profile Preview Card */}
          <div className={`bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 ${currentStep === 4 ? 'hidden' : ''}`}>
            <div className="flex min-h-[400px]">
              {/* Profile Image - Left Side (40% width, full height) */}
              <div className="w-2/5">
                <div className="h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center relative">
                  {(onboardingData.talent.temp_avatar_url || onboardingData.talent.users?.avatar_url) ? (
                    <img
                      src={onboardingData.talent.temp_avatar_url || onboardingData.talent.users?.avatar_url}
                      alt={onboardingData.talent.temp_full_name || onboardingData.talent.users?.full_name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-6xl font-bold text-white">
                      {(onboardingData.talent.temp_full_name || onboardingData.talent.users?.full_name || 'T').charAt(0)}
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Available
                  </div>

                  {/* Charity Badge */}
                  {donateProceeds && onboardingData.talent.charity_percentage && onboardingData.talent.charity_percentage > 0 && (
                    <div className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm">
                      <HeartIcon className="h-6 w-6 text-red-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Info - Right Side (60% width) */}
              <div className="w-3/5 p-6 flex flex-col">
                {/* Header Section */}
                <div className="mb-4">
                  {/* Position Title */}
                  {onboardingData.talent.position && (
                    <p className="text-sm font-medium text-gray-600 mb-1 uppercase tracking-wide">
                      {onboardingData.talent.position}
                    </p>
                  )}
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {onboardingData.talent.temp_full_name || onboardingData.talent.users?.full_name || 'Talent Member'}
                  </h2>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {onboardingData.talent.categories && onboardingData.talent.categories.length > 0 ? (
                        onboardingData.talent.categories.slice(0, 2).map((cat, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium capitalize">
                            {cat.replace('-', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium capitalize">
                          {onboardingData.talent.category?.replace('-', ' ') || 'Other'}
                        </span>
                      )}
                      {onboardingData.talent.categories && onboardingData.talent.categories.length > 2 && (
                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                          +{onboardingData.talent.categories.length - 2} more
                        </span>
                      )}
                    </div>
                    {onboardingData.talent.is_verified && (
                      <div className="flex items-center gap-1">
                        <CheckBadgeIcon className="h-5 w-5 text-blue-500" />
                        <span className="text-sm text-gray-600">Verified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rating - Hidden during onboarding since talent hasn't received orders yet */}

                {/* Bio */}
                <p className="text-gray-700 mb-6 leading-relaxed flex-1">
                  {onboardingData.talent.bio || 'Profile bio will be added during setup.'}
                </p>

                {/* Stats - Bottom Section */}
                <div className="mt-auto">
                  <div className={`grid gap-4 mb-4 ${
                    donateProceeds && onboardingData.talent.charity_percentage && Number(onboardingData.talent.charity_percentage) > 0 
                      ? 'grid-cols-4' 
                      : 'grid-cols-3'
                  }`}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        ${onboardingData.talent.pricing}
                      </div>
                      <div className="text-sm text-gray-600">Personal</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {onboardingData.talent.fulfillment_time_hours}h
                      </div>
                      <div className="text-sm text-gray-600">Delivery</div>
                    </div>

                    {onboardingData.talent.allow_corporate_pricing && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          ${onboardingData.talent.corporate_pricing || Math.round(onboardingData.talent.pricing * 1.5)}
                        </div>
                        <div className="text-sm text-gray-600">Corporate</div>
                      </div>
                    )}

                    {(donateProceeds && onboardingData.talent.charity_percentage && Number(onboardingData.talent.charity_percentage) > 0) && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {onboardingData.talent.charity_percentage}%
                        </div>
                        <div className="text-sm text-gray-600">To Charity</div>
                      </div>
                    )}
                  </div>

                  {/* Charity Info */}
                  {donateProceeds && onboardingData.talent.charity_name && onboardingData.talent.charity_percentage && Number(onboardingData.talent.charity_percentage) > 0 && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center text-red-800">
                        <HeartIcon className="h-5 w-5 mr-2" />
                        <span className="text-sm font-medium">
                          {onboardingData.talent.charity_percentage}% of proceeds go to {onboardingData.talent.charity_name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {currentStep === 1 && !onboardingData?.talent.user_id && (
            <form onSubmit={handleStep1Submit}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 1: Create Your Account
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={accountData.email}
                    onChange={(e) => setAccountData({...accountData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={accountData.password}
                      onChange={(e) => setAccountData({...accountData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={accountData.confirmPassword}
                    onChange={(e) => setAccountData({...accountData, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm your password"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Account & Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === 1 && onboardingData?.talent.user_id && (
            <form onSubmit={handleLoginSubmit}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 1: Welcome Back!
              </h2>
              
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <p className="text-blue-800">
                  You've already created your account. Please log in to continue setting up your profile.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Log In & Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 2: Complete Your Profile
              </h2>
              
              <div className="space-y-6">
                <ImageUpload
                  currentImageUrl={onboardingData?.talent.temp_avatar_url || onboardingData?.talent.users?.avatar_url}
                  onImageUploaded={(imageUrl) => {
                    updateAvatarPreview(imageUrl);
                  }}
                  uploadPath="talent-avatars"
                  maxSizeMB={5}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position <span className="text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.position}
                    onChange={(e) => updateProfilePreview({ position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Congressman, Judge, Senator, Pastor"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Title that appears above your name on your profile
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio / Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={profileData.bio}
                    onChange={(e) => updateProfilePreview({ bio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Tell people about yourself..."
                  />
                </div>

                <CategorySelector
                  selectedCategories={profileData.categories}
                  onCategoryChange={(categories) => updateProfilePreview({ categories, category: categories[0] || 'other' })}
                  autoSave={true}
                  startEditing={true}
                  stayInEditMode={true}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Personal Pricing ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={profileData.pricing}
                      onChange={(e) => updateProfilePreview({ pricing: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {onboardingData.talent.allow_corporate_pricing && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Corporate Pricing ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={profileData.corporate_pricing}
                        onChange={(e) => updateProfilePreview({ corporate_pricing: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Average Delivery Time (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={profileData.fulfillment_time_hours}
                      onChange={(e) => updateProfilePreview({ fulfillment_time_hours: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How long it typically takes to fulfill orders
                    </p>
                  </div>
                </div>

                {/* Charity Donation Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Donate proceeds to charity?
                      </label>
                      <p className="text-xs text-gray-500">
                        Choose to donate a percentage of your earnings to charity
                      </p>
                    </div>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          const newDonateState = !donateProceeds;
                          setDonateProceeds(newDonateState);
                          if (!newDonateState) {
                            // Reset charity data when disabled
                            updateProfilePreview({ charity_name: '', charity_percentage: 0 });
                          } else {
                            // Set minimum 5% when enabled
                            updateProfilePreview({ charity_percentage: 5 });
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          donateProceeds ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            donateProceeds ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-sm font-medium text-gray-700">
                        {donateProceeds ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>

                  {/* Charity Fields - Only show when donation is enabled */}
                  {donateProceeds && (
                    <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Charity Name *
                        </label>
                        <select
                          value={profileData.charity_name}
                          onChange={(e) => {
                            updateProfilePreview({ charity_name: e.target.value });
                            // Ensure donateProceeds stays true when charity name is selected
                            if (e.target.value && !donateProceeds) {
                              setDonateProceeds(true);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required={donateProceeds}
                        >
                          <option value="">Select a charity</option>
                          <option value="American Red Cross">American Red Cross</option>
                          <option value="St. Jude Children's Research Hospital">St. Jude Children's Research Hospital</option>
                          <option value="Wounded Warrior Project">Wounded Warrior Project</option>
                          <option value="Doctors Without Borders">Doctors Without Borders</option>
                          <option value="Habitat for Humanity">Habitat for Humanity</option>
                          <option value="United Way">United Way</option>
                          <option value="Salvation Army">Salvation Army</option>
                          <option value="Make-A-Wish Foundation">Make-A-Wish Foundation</option>
                          <option value="American Cancer Society">American Cancer Society</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Donation Percentage * (Minimum 5%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="5"
                            max="50"
                            value={profileData.charity_percentage}
                            onChange={(e) => {
                              const value = Math.max(5, Math.min(50, parseInt(e.target.value) || 5));
                              updateProfilePreview({ charity_percentage: value });
                              // Ensure donateProceeds is true when percentage is set
                              if (value > 0 && !donateProceeds) {
                                setDonateProceeds(true);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="5"
                            required={donateProceeds}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500">%</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Choose between 5% and 50% of your earnings to donate
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form 
              onSubmit={(e) => {
                console.log('Form onSubmit triggered');
                handleStep3Submit(e);
              }}
              onInvalid={(e) => {
                console.log('Form validation failed:', e);
              }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 3: Payout Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={payoutData.account_holder_name}
                    onChange={(e) => setPayoutData({...payoutData, account_holder_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Full name on bank account"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={payoutData.bank_name}
                    onChange={(e) => setPayoutData({...payoutData, bank_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Name of your bank"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SecureBankInput
                    label="Account Number"
                    type="account"
                    value={payoutData.account_number}
                    onChange={(value) => setPayoutData({...payoutData, account_number: value})}
                    placeholder="Enter account number"
                    required={true}
                    maxLength={17}
                  />
                  
                  <SecureBankInput
                    label="Routing Number"
                    type="routing"
                    value={payoutData.routing_number}
                    onChange={(value) => setPayoutData({...payoutData, routing_number: value})}
                    placeholder="9-digit routing number"
                    required={false}
                    maxLength={9}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type *
                  </label>
                  <select
                    value={payoutData.account_type}
                    onChange={(e) => setPayoutData({...payoutData, account_type: e.target.value as 'checking' | 'savings'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your bank information will be verified by our admin team before payouts can be processed. 
                  You'll be notified once verification is complete.
                </p>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  onClick={(e) => {
                    console.log('Button clicked!');
                    console.log('Form data at click:', payoutData);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Continue to Welcome Video
                </button>
              </div>
            </form>
          )}

          {currentStep === 4 && (
            <form onSubmit={handleStep4Submit}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 4: Welcome Video
              </h2>
              
              <div className="glass-strong rounded-2xl p-6 mb-6 border border-white/30">
                <div className="text-center mb-6">
                  <VideoCameraIcon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Record Your Welcome Video
                  </h3>
                  <p className="text-gray-600">
                    Create a 30-60 second introduction video to welcome potential customers
                  </p>
                </div>

                {/* Script Template */}
                <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    📝 Script Template
                  </h4>
                  <div className="text-sm text-blue-800 space-y-2">
                    <p><strong>Opening:</strong> "Hi! I'm [Your Name]..."</p>
                    <p><strong>Introduction:</strong> "[Brief description of who you are - Former Fox News host, Political commentator, etc.]"</p>
                    <p><strong>Service:</strong> "I'm now on ShoutOut where you can order a personalized video from me for any occasion you're looking for..."</p>
                    <p><strong>Personal Touch:</strong> "[Add your own spin - mention what makes your videos special]"</p>
                    <p><strong>Closing:</strong> "Find me on ShoutOut!"</p>
                  </div>
                </div>

                {/* Recording Tips */}
                <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    🎥 Recording Tips
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Record in good lighting (natural light works best)</li>
                    <li>• Ensure clear audio (avoid background noise)</li>
                    <li>• Look directly at the camera</li>
                    <li>• Speak clearly and with enthusiasm</li>
                    <li>• Keep it between 30-60 seconds</li>
                    <li>• Be authentic and show your personality!</li>
                  </ul>
                </div>

                {/* Video Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Welcome Video *
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setWelcomeVideoFile(file);
                          // Create preview URL
                          const url = URL.createObjectURL(file);
                          setWelcomeVideoUrl(url);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Supported formats: MP4, MOV, AVI. Max size: 100MB
                    </p>
                  </div>

                  {/* Video Preview */}
                  {welcomeVideoUrl && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video Preview
                      </label>
                      <div className="relative rounded-xl overflow-hidden bg-gray-100 max-w-md mx-auto">
                        <video
                          src={welcomeVideoUrl}
                          controls
                          className="w-full h-auto"
                          style={{ maxHeight: '300px' }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!welcomeVideoFile || uploadingVideo}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-red-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-red-700 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingVideo ? 'Uploading...' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Support Chat Widget for Talent */}
      <SupportChatWidget showForUserTypes={['talent']} />
    </div>
  );
};

export default TalentOnboardingPage;
