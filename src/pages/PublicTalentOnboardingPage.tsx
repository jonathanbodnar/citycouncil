import React, { useState } from 'react';
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
import CategorySelector from '../components/CategorySelector';
import CharitySelector from '../components/CharitySelector';
import { TalentCategory } from '../types';
import { uploadVideoToWasabi } from '../services/videoUpload';
import toast from 'react-hot-toast';
import MFAEnrollmentDual from '../components/MFAEnrollmentDual';

const PublicTalentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Account Creation
  const [accountData, setAccountData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [talentProfileId, setTalentProfileId] = useState<string | null>(null);

  // Step 2: Profile Information
  const [profileData, setProfileData] = useState({
    username: '',
    category: '' as TalentCategory,
    bio: '',
    position: '',
    pricing: 50,
    corporatePricing: 75,
    fulfillmentTime: 72,
    avatarUrl: '',
  });

  // Step 3: Charity (optional)
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
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: {
          data: {
            full_name: accountData.fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      setUserId(authData.user.id);

      // Create talent profile
      const { data: talentData, error: talentError } = await supabase
        .from('talent_profiles')
        .insert({
          user_id: authData.user.id,
          category: 'other', // Will be updated in step 2
          bio: '',
          pricing: 50,
          fulfillment_time_hours: 72,
          is_featured: false,
          is_active: false, // Inactive until onboarding complete
          total_orders: 0,
          fulfilled_orders: 0,
          average_rating: 0,
          admin_fee_percentage: 25,
          first_orders_promo_active: true, // Enable 0% fee promo
          onboarding_completed: false,
        })
        .select()
        .single();

      if (talentError) throw talentError;
      setTalentProfileId(talentData.id);

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

    if (!profileData.username) {
      toast.error('Username is required');
      return;
    }

    if (!profileData.category) {
      toast.error('Category is required');
      return;
    }

    if (!profileData.bio || profileData.bio.length < 50) {
      toast.error('Bio must be at least 50 characters');
      return;
    }

    setLoading(true);

    try {
      // Update talent profile
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          username: profileData.username.toLowerCase(),
          category: profileData.category,
          bio: profileData.bio,
          position: profileData.position,
          pricing: profileData.pricing,
          corporate_pricing: profileData.corporatePricing,
          fulfillment_time_hours: profileData.fulfillmentTime,
          temp_avatar_url: profileData.avatarUrl,
        })
        .eq('id', talentProfileId);

      if (error) throw error;

      // Update user's full name if it was changed
      if (userId) {
        await supabase.auth.updateUser({
          data: {
            full_name: accountData.fullName,
          },
        });
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
          charity_name: charityData.charityName || null,
          charity_percentage: charityData.charityName ? charityData.charityPercentage : 0,
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
      // Mark onboarding as complete and activate profile
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          onboarding_completed: true,
          is_active: true,
        })
        .eq('id', talentProfileId);

      if (error) throw error;

      toast.success('🎉 Onboarding complete! Welcome to ShoutOut!');
      
      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Become a ShoutOut Talent
          </h1>
          <p className="text-gray-300">
            Join our platform and start earning with personalized video messages
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max px-4">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      currentStep > step.number
                        ? 'bg-green-500'
                        : currentStep === step.number
                        ? 'bg-blue-500'
                        : 'glass border-2 border-white/30'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <CheckCircleIcon className="h-6 w-6 text-white" />
                    ) : (
                      <step.icon className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <span className="mt-2 text-xs text-white font-medium text-center">
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      currentStep > step.number ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="glass-strong rounded-3xl shadow-2xl border border-white/30 p-8">
          {/* Step 1: Create Account */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Submit}>
              <h2 className="text-2xl font-bold text-white mb-6">Create Your Account</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountData.fullName}
                    onChange={(e) => setAccountData({ ...accountData, fullName: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={accountData.email}
                    onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={accountData.password}
                    onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Must be at least 6 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={accountData.confirmPassword}
                    onChange={(e) => setAccountData({ ...accountData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-2xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account & Continue'}
              </button>
            </form>
          )}

          {/* Step 2: Profile Information */}
          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit}>
              <h2 className="text-2xl font-bold text-white mb-6">Profile Information</h2>
              
              <div className="space-y-6">
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Profile Picture *
                  </label>
                  <ImageUpload
                    currentImageUrl={profileData.avatarUrl}
                    onUploadComplete={(url) => setProfileData({ ...profileData, avatarUrl: url })}
                    folder="avatars"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Username * (will be your profile URL)
                  </label>
                  <div className="flex items-center">
                    <span className="glass px-4 py-3 rounded-l-xl text-gray-300 border border-white/30 border-r-0">
                      shoutout.us/
                    </span>
                    <input
                      type="text"
                      required
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="flex-1 px-4 py-3 glass border border-white/30 rounded-r-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="yourname"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Lowercase letters, numbers, and hyphens only
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Category *
                  </label>
                  <CategorySelector
                    selectedCategory={profileData.category}
                    onCategoryChange={(category) => setProfileData({ ...profileData, category })}
                  />
                </div>

                {/* Position/Title */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Position/Title (optional)
                  </label>
                  <input
                    type="text"
                    value={profileData.position}
                    onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Congressman, Judge, Senator"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Bio * (min 50 characters)
                  </label>
                  <textarea
                    required
                    minLength={50}
                    rows={4}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tell your audience about yourself..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {profileData.bio.length}/50 characters minimum
                  </p>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Personal ShoutOut Price * ($)
                    </label>
                    <input
                      type="number"
                      required
                      min="10"
                      step="5"
                      value={profileData.pricing}
                      onChange={(e) => setProfileData({ ...profileData, pricing: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Business ShoutOut Price * ($)
                    </label>
                    <input
                      type="number"
                      required
                      min="10"
                      step="5"
                      value={profileData.corporatePricing}
                      onChange={(e) => setProfileData({ ...profileData, corporatePricing: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Fulfillment Time */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Fulfillment Time * (hours)
                  </label>
                  <input
                    type="number"
                    required
                    min="24"
                    step="24"
                    value={profileData.fulfillmentTime}
                    onChange={(e) => setProfileData({ ...profileData, fulfillmentTime: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    How long will it take you to deliver a video? (24h = 1 day, 72h = 3 days)
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-2xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue to Charity Settings'}
              </button>
            </form>
          )}

          {/* Step 3: Charity (Optional) */}
          {currentStep === 3 && (
            <form onSubmit={handleStep3Submit}>
              <h2 className="text-2xl font-bold text-white mb-6">Charity Donation (Optional)</h2>
              
              <p className="text-gray-300 mb-6">
                You will be able to add payout details in your dashboard shortly after onboarding. Thank you!
              </p>

              <div className="mb-6">
                <CharitySelector
                  charityName={charityData.charityName}
                  charityPercentage={charityData.charityPercentage}
                  onCharityChange={(name, percentage) => setCharityData({ charityName: name, charityPercentage: percentage })}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-2xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue to Promo Video'}
              </button>
            </form>
          )}

          {/* Step 4: Promo Video */}
          {currentStep === 4 && (
            <form onSubmit={handleStep4Submit}>
              <h2 className="text-2xl font-bold text-white mb-6">Upload Your Promo Video</h2>
              
              <p className="text-gray-300 mb-6">
                Upload a short video introducing yourself and what people can expect from their ShoutOut!
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">
                  Promo Video * (MP4, max 300MB)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  required
                  onChange={(e) => setPromoVideo(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 glass border border-white/30 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={videoUploading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-2xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {videoUploading ? 'Uploading Video...' : 'Continue to Security Setup'}
              </button>
            </form>
          )}

          {/* Step 5: MFA */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Secure Your Account</h2>
              
              <p className="text-gray-300 mb-6">
                Set up two-factor authentication to protect your account and earnings.
              </p>

              <MFAEnrollmentDual
                onComplete={handleMFAComplete}
                required={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicTalentOnboardingPage;

