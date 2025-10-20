import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  UserIcon, 
  CreditCardIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentOnboardingData, TalentCategory } from '../types';
import Logo from '../components/Logo';
import CategorySelector from '../components/CategorySelector';
import CharitySelector from '../components/CharitySelector';
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

  // Step 2: Profile Details
  const [profileData, setProfileData] = useState({
    bio: '',
    category: 'other' as TalentCategory,
    categories: [] as TalentCategory[],
    pricing: 299.99,
    corporate_pricing: 449.99,
    fulfillment_time_hours: 48,
    charity_percentage: 10,
    charity_name: '',
    social_accounts: []
  });

  // Step 3: Payout Details
  const [payoutData, setPayoutData] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'checking' as 'checking' | 'savings'
  });

  useEffect(() => {
    if (token) {
      fetchOnboardingData();
    }
  }, [token]);

  const fetchOnboardingData = async () => {
    try {
      setLoading(true);
      
      console.log('Looking for onboarding token:', token);
      
      const { data, error } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('onboarding_token', token)
        .single();

      console.log('Onboarding query result:', { data, error });

      if (error) {
        console.error('Database error:', error);
        throw error;
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

      // Pre-fill profile data
      setProfileData({
        bio: data.bio || '',
        category: data.category || 'other',
        categories: data.categories || [],
        pricing: data.pricing || 299.99,
        corporate_pricing: data.corporate_pricing || 449.99,
        fulfillment_time_hours: data.fulfillment_time_hours || 48,
        charity_percentage: data.charity_percentage || 10,
        charity_name: data.charity_name || '',
        social_accounts: data.social_accounts || []
      });

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

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          bio: profileData.bio,
          category: profileData.category,
          categories: profileData.categories,
          pricing: profileData.pricing,
          corporate_pricing: profileData.corporate_pricing,
          fulfillment_time_hours: profileData.fulfillment_time_hours,
          charity_percentage: profileData.charity_percentage,
          charity_name: profileData.charity_name,
          social_accounts: profileData.social_accounts
        })
        .eq('id', onboardingData?.talent.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      setCurrentStep(3);

    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Save bank information
      const { error: bankError } = await supabase
        .from('vendor_bank_info')
        .insert([{
          talent_id: onboardingData?.talent.id,
          ...payoutData,
          is_verified: false
        }]);

      if (bankError) throw bankError;

      // Mark onboarding as completed and activate profile
      const { error: completeError } = await supabase
        .from('talent_profiles')
        .update({
          onboarding_completed: true,
          is_active: true,
          onboarding_token: null,
          onboarding_expires_at: null
        })
        .eq('id', onboardingData?.talent.id);

      if (completeError) throw completeError;

      toast.success('Onboarding completed! Welcome to ShoutOut!');
      navigate('/dashboard');

    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast.error(error.message || 'Failed to complete onboarding');
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
    { number: 3, title: 'Payout Setup', icon: CreditCardIcon }
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
          
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Your Profile Details:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Name:</span>
                <span className="ml-2 text-blue-900">{onboardingData.talent.temp_full_name || 'Not set'}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Username:</span>
                <span className="ml-2 text-blue-900">@{onboardingData.talent.username}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Profile URL:</span>
                <span className="ml-2 text-blue-900">shoutout.us/{onboardingData.talent.username}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Category:</span>
                <span className="ml-2 text-blue-900 capitalize">{onboardingData.talent.category.replace('-', ' ')}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Pricing:</span>
                <span className="ml-2 text-blue-900">${onboardingData.talent.pricing}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {currentStep === 1 && (
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

          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 2: Complete Your Profile
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio / Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Tell people about yourself..."
                  />
                </div>

                <CategorySelector
                  selectedCategories={profileData.categories}
                  onCategoryChange={(categories) => setProfileData({...profileData, categories})}
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
                      onChange={(e) => setProfileData({...profileData, pricing: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Corporate Pricing ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={profileData.corporate_pricing}
                      onChange={(e) => setProfileData({...profileData, corporate_pricing: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fulfillment Time (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={profileData.fulfillment_time_hours}
                      onChange={(e) => setProfileData({...profileData, fulfillment_time_hours: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <CharitySelector
                  selectedCharityName={profileData.charity_name}
                  charityPercentage={profileData.charity_percentage}
                  onCharityChange={(charityName, percentage) => setProfileData({...profileData, charity_name: charityName, charity_percentage: percentage})}
                />
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
            <form onSubmit={handleStep3Submit}>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={payoutData.account_number}
                      onChange={(e) => setPayoutData({...payoutData, account_number: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Bank account number"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number *
                    </label>
                    <input
                      type="text"
                      required
                      pattern="[0-9]{9}"
                      value={payoutData.routing_number}
                      onChange={(e) => setPayoutData({...payoutData, routing_number: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="9-digit routing number"
                    />
                  </div>
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
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Complete Setup
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalentOnboardingPage;
