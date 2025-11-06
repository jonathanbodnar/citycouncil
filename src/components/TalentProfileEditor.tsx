import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  XMarkIcon,
  CheckIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile } from '../types';
import ProfilePictureUpload from './ProfilePictureUpload';
import toast from 'react-hot-toast';

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface TalentProfileEditorProps {
  talent: TalentWithUser;
  onClose: () => void;
  onSave: () => void;
}

interface ProfileFormData {
  full_name: string;
  email: string;
  category: string;
  bio: string;
  pricing: number;
  corporate_pricing: number;
  fulfillment_time_hours: number;
  charity_percentage: number;
  charity_name: string;
  is_featured: boolean;
  is_active: boolean;
  admin_fee_percentage: number;
}

const TalentProfileEditor: React.FC<TalentProfileEditorProps> = ({ 
  talent, 
  onClose, 
  onSave 
}) => {
  const [saving, setSaving] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ProfileFormData>({
    defaultValues: {
      full_name: talent.users.full_name,
      email: talent.users.email,
      category: talent.category,
      bio: talent.bio,
      pricing: talent.pricing,
      corporate_pricing: talent.corporate_pricing || talent.pricing * 1.5,
      fulfillment_time_hours: talent.fulfillment_time_hours,
      charity_percentage: talent.charity_percentage || 0,
      charity_name: talent.charity_name || '',
      is_featured: talent.is_featured,
      is_active: talent.is_active,
      admin_fee_percentage: talent.admin_fee_percentage || 25, // Default to 25% to match platform settings
    }
  });

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

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      // Update user profile
      const { error: userError } = await supabase
        .from('users')
        .update({
          full_name: data.full_name,
          email: data.email,
        })
        .eq('id', talent.user_id);

      if (userError) throw userError;

      // Update talent profile
      const { error: talentError } = await supabase
        .from('talent_profiles')
        .update({
          category: data.category,
          bio: data.bio,
          pricing: data.pricing,
          corporate_pricing: data.corporate_pricing,
          fulfillment_time_hours: data.fulfillment_time_hours,
          charity_percentage: data.charity_percentage,
          charity_name: data.charity_name,
          is_featured: data.is_featured,
          is_active: data.is_active,
          admin_fee_percentage: data.admin_fee_percentage,
        })
        .eq('id', talent.id);

      if (talentError) throw talentError;

      toast.success('Talent profile updated successfully!');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating talent profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpdate = async (avatarUrl: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', talent.user_id);

      if (error) throw error;
      
      toast.success('Profile photo updated!');
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update profile photo');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Talent Profile - {talent.users.full_name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="space-y-6">
            {/* Profile Photo */}
            <div className="flex items-center space-x-6 pb-6 border-b border-gray-200">
              <ProfilePictureUpload
                currentAvatarUrl={talent.users.avatar_url}
                onUploadComplete={handleAvatarUpdate}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Profile Photo</h3>
                <p className="text-sm text-gray-600">
                  Upload a professional headshot for the talent
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Recommended: 400x400px, JPG or PNG format, max 5MB
                </p>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  {...register('full_name', { required: 'Full name is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Category and Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                {...register('category', { required: 'Category is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                placeholder="Tell customers about this talent and what makes their ShoutOuts special..."
              />
              {errors.bio && (
                <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
              )}
            </div>

            {/* Pricing and Settings */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Pricing ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('pricing', { required: 'Pricing is required', min: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.pricing && (
                  <p className="mt-1 text-sm text-red-600">{errors.pricing.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">For individual customers</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Corporate Pricing ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('corporate_pricing', { required: 'Corporate pricing is required', min: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.corporate_pricing && (
                  <p className="mt-1 text-sm text-red-600">{errors.corporate_pricing.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">For business customers</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fulfillment Time (hours) *
                </label>
                <input
                  type="number"
                  {...register('fulfillment_time_hours', { required: 'Fulfillment time is required', min: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.fulfillment_time_hours && (
                  <p className="mt-1 text-sm text-red-600">{errors.fulfillment_time_hours.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Fee (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  {...register('admin_fee_percentage')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to use global setting
                </p>
              </div>
            </div>

            {/* Charity Settings */}
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
                />
              </div>
            </div>

            {/* Status Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('is_featured')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Featured Talent
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active Profile
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default TalentProfileEditor;
