import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { TalentProfile } from '../types';
import ProfilePictureUpload from './ProfilePictureUpload';
import toast from 'react-hot-toast';

interface ProfileFormData {
  full_name: string;
  bio?: string;
  pricing?: number;
  fulfillment_time_hours?: number;
  charity_percentage?: number;
  charity_name?: string;
  category?: string;
}

const ProfileEditor: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProfileFormData>();

  useEffect(() => {
    if (user?.user_type === 'talent') {
      fetchTalentProfile();
    }
  }, [user]);

  const fetchTalentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setTalentProfile(data);
      
      // Reset form with current data
      reset({
        full_name: user?.full_name || '',
        bio: data.bio,
        pricing: data.pricing,
        fulfillment_time_hours: data.fulfillment_time_hours,
        charity_percentage: data.charity_percentage || 0,
        charity_name: data.charity_name || '',
        category: data.category,
      });
    } catch (error) {
      console.error('Error fetching talent profile:', error);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      // Update user profile
      await updateProfile({
        full_name: data.full_name,
      });

      // Update talent profile if user is talent
      if (user?.user_type === 'talent' && talentProfile) {
        const { error } = await supabase
          .from('talent_profiles')
          .update({
            bio: data.bio,
            pricing: data.pricing,
            fulfillment_time_hours: data.fulfillment_time_hours,
            charity_percentage: data.charity_percentage,
            charity_name: data.charity_name,
            category: data.category,
          })
          .eq('id', talentProfile.id);

        if (error) throw error;
      }

      toast.success('Profile updated successfully!');
      setEditing(false);
      fetchTalentProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    reset({
      full_name: user?.full_name || '',
      bio: talentProfile?.bio,
      pricing: talentProfile?.pricing,
      fulfillment_time_hours: talentProfile?.fulfillment_time_hours,
      charity_percentage: talentProfile?.charity_percentage || 0,
      charity_name: talentProfile?.charity_name || '',
      category: talentProfile?.category,
    });
  };

  const TALENT_CATEGORIES = [
    { value: 'politician', label: 'Politician' },
    { value: 'candidate', label: 'Candidate' },
    { value: 'party-leader', label: 'Party Leader/Strategist' },
    { value: 'reporter', label: 'Reporter/Journalist' },
    { value: 'tv-host', label: 'TV/Radio Host' },
    { value: 'commentator', label: 'Commentator/Pundit' },
    { value: 'author', label: 'Author/Speaker' },
    { value: 'comedian', label: 'Comedian' },
    { value: 'musician', label: 'Musician/Artist' },
    { value: 'actor', label: 'Actor/Filmmaker' },
    { value: 'influencer', label: 'Influencer/Creator' },
    { value: 'activist', label: 'Activist/Organizer' },
    { value: 'faith-leader', label: 'Faith Leader/Pastor' },
    { value: 'academic', label: 'Academic/Expert' },
    { value: 'military', label: 'Military/Veteran' },
    { value: 'youth-leader', label: 'Youth Leader/Gen Z Voice' },
    { value: 'patriotic-entertainer', label: 'Patriotic Entertainer' },
    { value: 'other', label: 'Other Public Figure' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
          >
            <PencilIcon className="h-4 w-4" />
            <span>Edit Profile</span>
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-700"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Profile Photo */}
        <div className="flex items-center space-x-6">
          <ProfilePictureUpload
            currentAvatarUrl={user?.avatar_url}
            onUploadComplete={(url) => {
              // Handle avatar upload completion
              updateProfile({ avatar_url: url });
            }}
            size="lg"
          />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Profile Photo</h3>
            <p className="text-sm text-gray-600">
              Upload a professional headshot (max 5MB)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Recommended: 400x400px, JPG or PNG format
            </p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              {...register('full_name', { required: 'Full name is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              readOnly={!editing}
            />
            {errors.full_name && (
              <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              readOnly
            />
          </div>
        </div>

        {/* Talent-specific fields */}
        {user?.user_type === 'talent' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                {...register('category', { required: 'Category is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={!editing}
              >
                <option value="">Select a category</option>
                {TALENT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio *
              </label>
              <textarea
                rows={4}
                {...register('bio', { required: 'Bio is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tell customers about yourself and what makes your ShoutOuts special..."
                readOnly={!editing}
              />
              {errors.bio && (
                <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('pricing', { required: 'Pricing is required', min: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  readOnly={!editing}
                />
                {errors.pricing && (
                  <p className="mt-1 text-sm text-red-600">{errors.pricing.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fulfillment Time (hours) *
                </label>
                <input
                  type="number"
                  {...register('fulfillment_time_hours', { required: 'Fulfillment time is required', min: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  readOnly={!editing}
                />
                {errors.fulfillment_time_hours && (
                  <p className="mt-1 text-sm text-red-600">{errors.fulfillment_time_hours.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Charity Donation (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  {...register('charity_percentage')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  readOnly={!editing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Charity Name
                </label>
                <input
                  type="text"
                  {...register('charity_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Wounded Warrior Project"
                  readOnly={!editing}
                />
              </div>
            </div>
          </>
        )}

        {editing && (
          <div className="pt-6 border-t border-gray-200">
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ProfileEditor;
