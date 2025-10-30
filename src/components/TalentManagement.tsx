import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  UserGroupIcon, 
  LinkIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, TalentCategory } from '../types';
import ImageUpload from './ImageUpload';
import CategorySelector from './CategorySelector';
import { uploadVideoToWasabi } from '../services/videoUpload';
import toast from 'react-hot-toast';

interface TalentWithUser extends TalentProfile {
  users?: {
    full_name: string;
    avatar_url?: string;
    email?: string;
  };
}

const TalentManagement: React.FC = () => {
  const [talents, setTalents] = useState<TalentWithUser[]>([]);
  const [filteredTalents, setFilteredTalents] = useState<TalentWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const talentsPerPage = 10;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTalent, setEditingTalent] = useState<TalentWithUser | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [newTalent, setNewTalent] = useState({
    full_name: '',
    position: '',
    username: '',
    bio: '',
    avatar_url: '',
    category: 'other' as TalentCategory,
    categories: [] as TalentCategory[],
    pricing: 299.99,
    corporate_pricing: 449.99,
    fulfillment_time_hours: 48,
    allow_corporate_pricing: false,
    is_verified: false,
    charity_percentage: 5,
    charity_name: '',
    admin_fee_percentage: 15
  });
  
  // Charity donation toggle for admin creation
  const [adminDonateProceeds, setAdminDonateProceeds] = useState(false);
  
  // Charity donation toggle for admin editing
  const [editDonateProceeds, setEditDonateProceeds] = useState(false);

  useEffect(() => {
    fetchTalents();
  }, []);

  useEffect(() => {
    // Filter talents based on search query
    if (!searchQuery.trim()) {
      setFilteredTalents(talents);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = talents.filter(talent => 
        (talent.users?.full_name?.toLowerCase().includes(query)) ||
        (talent.temp_full_name?.toLowerCase().includes(query)) ||
        (talent.username?.toLowerCase().includes(query)) ||
        (talent.bio?.toLowerCase().includes(query)) ||
        (talent.category?.toLowerCase().includes(query))
      );
      setFilteredTalents(filtered);
    }
  }, [talents, searchQuery]);

  const fetchTalents = async () => {
    try {
      setLoading(true);
      // Add timestamp to force fresh data
      const timestamp = new Date().getTime();
      console.log('Fetching talents at:', timestamp);
      
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Fetched talents data:', data);
      console.log('First talent example:', data?.[0]);
      
      setTalents(data || []);
      setFilteredTalents(data || []);
    } catch (error) {
      console.error('Error fetching talents:', error);
      toast.error('Failed to load talent profiles');
    } finally {
      setLoading(false);
    }
  };

  const generateOnboardingToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const createTalent = async () => {
    try {
      // Validate username
      if (!newTalent.username || !/^[a-zA-Z0-9_-]+$/.test(newTalent.username)) {
        toast.error('Username can only contain letters, numbers, hyphens, and underscores');
        return;
      }

      // Check if username is already taken
      const { data: existingTalent } = await supabase
        .from('talent_profiles')
        .select('username')
        .eq('username', newTalent.username.toLowerCase())
        .single();

      if (existingTalent) {
        toast.error('Username is already taken');
        return;
      }

      // Generate onboarding token and expiry
      const onboardingToken = generateOnboardingToken();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from now
      
      console.log('Generated onboarding token:', onboardingToken);
      console.log('Expiry date:', expiryDate.toISOString());

      // Prepare insert data
      const insertData: any = {
        // Store talent data for onboarding, user_id will be set later
        username: newTalent.username.toLowerCase(),
        bio: newTalent.bio,
        category: newTalent.category,
        categories: newTalent.categories.length > 0 ? newTalent.categories : [newTalent.category],
        pricing: newTalent.pricing,
        corporate_pricing: newTalent.corporate_pricing,
        allow_corporate_pricing: newTalent.allow_corporate_pricing,
        is_verified: newTalent.is_verified,
        fulfillment_time_hours: newTalent.fulfillment_time_hours,
        charity_percentage: newTalent.charity_percentage,
        charity_name: newTalent.charity_name,
        admin_fee_percentage: newTalent.admin_fee_percentage,
        onboarding_token: onboardingToken,
        onboarding_completed: false,
        onboarding_expires_at: expiryDate.toISOString(),
        is_featured: false,
        is_active: false, // Default to inactive until onboarding complete
        total_orders: 0,
        fulfilled_orders: 0,
        average_rating: 0,
        // Store admin-provided data for onboarding
        temp_full_name: newTalent.full_name,
        temp_avatar_url: newTalent.avatar_url
      };

      // Add position field if it's provided (after migration)
      if (newTalent.position) {
        insertData.position = newTalent.position;
      }

      // Create talent profile without user first (user will be created during onboarding)
      const { error } = await supabase
        .from('talent_profiles')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Error creating talent profile:', error);
        throw error;
      }

      console.log('Talent profile created with token:', onboardingToken);
      toast.success('Talent profile created successfully!');
      setShowAddForm(false);
      setAdminDonateProceeds(false);
      setNewTalent({
        full_name: '',
        position: '',
        username: '',
        bio: '',
        avatar_url: '',
        category: 'other' as TalentCategory,
        categories: [] as TalentCategory[],
        pricing: 299.99,
        corporate_pricing: 449.99,
        fulfillment_time_hours: 48,
        allow_corporate_pricing: false,
        is_verified: false,
        charity_percentage: 5,
        charity_name: '',
        admin_fee_percentage: 15
      });
      fetchTalents();

    } catch (error) {
      console.error('Error creating talent:', error);
      toast.error('Failed to create talent profile');
    }
  };

  const copyOnboardingLink = (token: string) => {
    const link = `${window.location.origin}/onboard/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Onboarding link copied to clipboard!');
  };

  const regenerateOnboardingToken = async (talentId: string) => {
    try {
      const newToken = generateOnboardingToken();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      const { error } = await supabase
        .from('talent_profiles')
        .update({
          onboarding_token: newToken,
          onboarding_expires_at: expiryDate.toISOString()
        })
        .eq('id', talentId);

      if (error) throw error;

      toast.success('New onboarding token generated!');
      fetchTalents();

    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error('Failed to regenerate onboarding token');
    }
  };

  const updateTalent = async () => {
    if (!editingTalent) return;

    try {

      // Prepare update data
      const updateData: any = {
        username: editingTalent.username?.toLowerCase(),
        bio: editingTalent.bio,
        category: editingTalent.category,
        categories: editingTalent.categories,
        pricing: editingTalent.pricing,
        corporate_pricing: editingTalent.corporate_pricing,
        allow_corporate_pricing: editingTalent.allow_corporate_pricing,
        is_verified: editingTalent.is_verified,
        fulfillment_time_hours: editingTalent.fulfillment_time_hours,
        charity_percentage: editingTalent.charity_percentage,
        charity_name: editingTalent.charity_name,
        admin_fee_percentage: editingTalent.admin_fee_percentage,
        temp_avatar_url: editingTalent.temp_avatar_url,
        temp_full_name: editingTalent.temp_full_name
      };

      // Add position field if it exists (after migration)
      if (editingTalent.position !== undefined) {
        updateData.position = editingTalent.position || null;
      }

      // Update talent profile - COMPLETE UPDATE
      console.log('Updating talent profile:', {
        talentId: editingTalent.id,
        updateData: updateData
      });
      
      // FORCE USER TABLE TO MATCH TEMP FIELDS (TEMP IS SOURCE OF TRUTH)
      if (editingTalent.user_id && editingTalent.temp_full_name) {
        console.log('FORCING user table to match temp fields:', {
          userId: editingTalent.user_id,
          tempName: editingTalent.temp_full_name,
          tempImage: editingTalent.temp_avatar_url ? 'IMAGE_SET' : 'NO_IMAGE'
        });
        
        const { error: userError } = await supabase
          .from('users')
          .update({
            full_name: editingTalent.temp_full_name,
            avatar_url: editingTalent.temp_avatar_url
          })
          .eq('id', editingTalent.user_id);

        if (userError) {
          console.error('FAILED: User table sync:', userError);
        } else {
          console.log('SUCCESS: User table synced to temp fields');
        }
      }

      // Try a simpler update first to isolate the issue
      console.log('Attempting talent profile update...');
      const { data: updatedData, error: talentError } = await supabase
        .from('talent_profiles')
        .update(updateData)
        .eq('id', editingTalent.id)
        .select('*')
        .single();

      console.log('Update result:', { data: updatedData, error: talentError });

      if (talentError) {
        console.error('FAILED: Talent profile update error:', talentError);
        toast.error(`Database error: ${talentError.message}`);
        throw talentError;
      }

      console.log('SUCCESS: Talent profile update completed');

      // Now verify the data was actually saved
      const { data: verificationData, error: verifyError } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('id', editingTalent.id)
        .single();

      if (verificationData) {
        console.log('VERIFICATION: Data actually in database:', verificationData);
        console.log('VERIFICATION: temp_full_name:', verificationData.temp_full_name);
        console.log('VERIFICATION: temp_avatar_url:', verificationData.temp_avatar_url);
        console.log('VERIFICATION: users.full_name:', verificationData.users?.full_name);
        console.log('VERIFICATION: users.avatar_url:', verificationData.users?.avatar_url);
      } else {
        console.error('VERIFICATION FAILED: Could not retrieve updated data');
      }

      // Immediately update the local state to reflect changes
      const updatedTalents = talents.map(t => 
        t.id === editingTalent.id ? { ...t, ...updateData, users: editingTalent.users } : t
      );
      setTalents(updatedTalents);
      setFilteredTalents(updatedTalents);
      
      toast.success('Talent profile updated successfully');
      setEditingTalent(null);
      
      
      // Force refresh the talents list to show updated data
      console.log('Forcing talent list refresh after update');
      await fetchTalents();

    } catch (error) {
      console.error('Error updating talent:', error);
      toast.error('Failed to update talent profile');
    }
  };

  const toggleTalentStatus = async (talentId: string, field: 'is_active' | 'is_featured' | 'allow_corporate_pricing' | 'is_verified', value: boolean) => {
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({ [field]: value })
        .eq('id', talentId);

      if (error) throw error;

      const action = field === 'is_active' 
        ? (value ? 'activated' : 'deactivated')
        : field === 'is_featured'
        ? (value ? 'featured' : 'unfeatured')
        : field === 'allow_corporate_pricing'
        ? (value ? 'corporate pricing enabled' : 'corporate pricing disabled')
        : (value ? 'verified' : 'unverified');
      
      toast.success(`Talent ${action} successfully`);
      fetchTalents();

    } catch (error) {
      console.error(`Error toggling talent ${field}:`, error);
      toast.error(`Failed to update talent status`);
    }
  };

  const deleteTalent = async (talentId: string, talentName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${talentName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('talent_profiles')
        .delete()
        .eq('id', talentId);

      if (error) throw error;

      toast.success('Talent profile deleted successfully');
      fetchTalents();

    } catch (error) {
      console.error('Error deleting talent:', error);
      toast.error('Failed to delete talent profile');
    }
  };

  const getStatusBadge = (talent: TalentWithUser) => {
    if (talent.onboarding_completed && talent.is_active) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="w-4 h-4 mr-1" />
          Active
        </span>
      );
    } else if (talent.onboarding_completed && !talent.is_active) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ClockIcon className="w-4 h-4 mr-1" />
          Inactive
        </span>
      );
    } else if (talent.onboarding_expires_at && new Date(talent.onboarding_expires_at) < new Date()) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircleIcon className="w-4 h-4 mr-1" />
          Expired
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <ClockIcon className="w-4 h-4 mr-1" />
          Pending
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Talent Management</h2>
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search talent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add New Talent
          </button>
        </div>
      </div>

      {/* Add Talent Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add New Talent Member</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTalent.full_name}
                  onChange={(e) => setNewTalent({...newTalent, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newTalent.position}
                  onChange={(e) => setNewTalent({...newTalent, position: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Congressman, Judge, Senator"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Title that appears above their name on profiles
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username * (shoutout.us/username)
                </label>
                <input
                  type="text"
                  required
                  value={newTalent.username}
                  onChange={(e) => setNewTalent({...newTalent, username: e.target.value.toLowerCase()})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="username"
                />
                <p className="text-xs text-gray-500 mt-1">Letters, numbers, hyphens, and underscores only</p>
              </div>
              
              <div className="md:col-span-2">
                <ImageUpload
                  currentImageUrl={newTalent.avatar_url}
                  onImageUploaded={(imageUrl) => setNewTalent({...newTalent, avatar_url: imageUrl})}
                  uploadPath="talent-avatars"
                  maxSizeMB={5}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio *
                </label>
                <textarea
                  required
                  rows={3}
                  value={newTalent.bio}
                  onChange={(e) => setNewTalent({...newTalent, bio: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter bio/description"
                />
              </div>
              
              <div className="md:col-span-2">
                <CategorySelector
                  selectedCategories={newTalent.categories}
                  onCategoryChange={(categories) => setNewTalent({...newTalent, categories, category: categories[0] || 'other'})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Delivery Time (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={newTalent.fulfillment_time_hours}
                  onChange={(e) => setNewTalent({...newTalent, fulfillment_time_hours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long it typically takes to fulfill orders
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Pricing ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTalent.pricing}
                  onChange={(e) => setNewTalent({...newTalent, pricing: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corporate Pricing ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTalent.corporate_pricing}
                  onChange={(e) => setNewTalent({...newTalent, corporate_pricing: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allow_corporate_pricing"
                    checked={newTalent.allow_corporate_pricing}
                    onChange={(e) => setNewTalent({...newTalent, allow_corporate_pricing: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="allow_corporate_pricing" className="ml-2 block text-sm font-medium text-gray-700">
                    Allow Corporate Pricing
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">Enable business/corporate pricing option for this talent</p>
              </div>
              
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_verified"
                    checked={newTalent.is_verified}
                    onChange={(e) => setNewTalent({...newTalent, is_verified: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_verified" className="ml-2 block text-sm font-medium text-gray-700">
                    Verified Talent
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">Show verification badge on talent profile</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Fee (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={newTalent.admin_fee_percentage}
                  onChange={(e) => setNewTalent({...newTalent, admin_fee_percentage: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Charity Donation Toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enable charity donations?
                  </label>
                  <p className="text-xs text-gray-500">
                    Allow this talent to donate a percentage to charity
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newDonateState = !adminDonateProceeds;
                      setAdminDonateProceeds(newDonateState);
                      if (!newDonateState) {
                        setNewTalent({...newTalent, charity_name: '', charity_percentage: 0});
                      } else {
                        setNewTalent({...newTalent, charity_percentage: 5});
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      adminDonateProceeds ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        adminDonateProceeds ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {adminDonateProceeds ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* Charity Fields - Only show when enabled */}
              {adminDonateProceeds && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Charity Name *
                    </label>
                    <select
                      value={newTalent.charity_name}
                      onChange={(e) => setNewTalent({...newTalent, charity_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={adminDonateProceeds}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Donation Percentage * (Min 5%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={newTalent.charity_percentage}
                        onChange={(e) => {
                          const value = Math.max(5, Math.min(50, parseInt(e.target.value) || 5));
                          setNewTalent({...newTalent, charity_percentage: value});
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required={adminDonateProceeds}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTalent}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Talent Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Talents List */}
      <div className="glass rounded-2xl shadow-modern">
        <div className="px-6 py-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5" />
              Talent Profiles ({filteredTalents.length}{searchQuery ? ` of ${talents.length}` : ''})
            </h3>
          </div>
        </div>
        
        {filteredTalents.length > 0 ? (
          <div className="space-y-4 p-6">
            {filteredTalents
              .slice((currentPage - 1) * talentsPerPage, currentPage * talentsPerPage)
              .map((talent) => (
              <div key={talent.id} className="glass-subtle rounded-2xl p-6 border border-white/30 hover:glass transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {(talent.temp_avatar_url || talent.users?.avatar_url) ? (
                        <img
                          src={talent.temp_avatar_url || talent.users?.avatar_url}
                          alt={talent.temp_full_name || talent.users?.full_name || 'Talent'}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserGroupIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-medium text-gray-900">
                          {talent.temp_full_name || talent.users?.full_name || 'Pending Setup'}
                        </h4>
                        {getStatusBadge(talent)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>@{talent.username}</span>
                        <span>•</span>
                        <span>${talent.pricing}</span>
                        <span>•</span>
                        <span>{talent.category.replace('-', ' ')}</span>
                      </div>
                      
                      {talent.bio && (
                        <p className="text-sm text-gray-600 mt-2 max-w-md">
                          {talent.bio.length > 100 ? `${talent.bio.substring(0, 100)}...` : talent.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!talent.onboarding_completed && talent.onboarding_token && (
                      <>
                        <button
                          onClick={() => copyOnboardingLink(talent.onboarding_token!)}
                          className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Copy onboarding link to clipboard"
                        >
                          <LinkIcon className="h-4 w-4" />
                          Onboarding Link
                        </button>
                      </>
                    )}
                    
                    {/* Quick Toggle Buttons */}
                    <button
                      onClick={() => toggleTalentStatus(talent.id, 'is_active', !talent.is_active)}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.is_active 
                          ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                          : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                      }`}
                      title={talent.is_active ? 'Deactivate talent (hide from public)' : 'Activate talent (show on homepage)'}
                    >
                      {talent.is_active ? (
                        <CheckCircleIcon className="h-4 w-4" />
                      ) : (
                        <XCircleIcon className="h-4 w-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => toggleTalentStatus(talent.id, 'is_featured', !talent.is_featured)}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.is_featured 
                          ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' 
                          : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                      }`}
                      title={talent.is_featured ? 'Remove from featured carousel' : 'Add to featured carousel on homepage'}
                    >
                      <span className="text-lg">{talent.is_featured ? '⭐' : '☆'}</span>
                    </button>
                    
                    <button
                      onClick={() => toggleTalentStatus(talent.id, 'allow_corporate_pricing', !talent.allow_corporate_pricing)}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.allow_corporate_pricing 
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                          : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                      }`}
                      title={talent.allow_corporate_pricing ? 'Disable business pricing option' : 'Enable business pricing option for orders'}
                    >
                      <span className="text-lg">{talent.allow_corporate_pricing ? '🏢' : '👤'}</span>
                    </button>
                    
                    <button
                      onClick={() => toggleTalentStatus(talent.id, 'is_verified', !talent.is_verified)}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.is_verified 
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                          : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                      }`}
                      title={talent.is_verified ? 'Remove verification badge' : 'Add verification badge'}
                    >
                      <span className="text-lg">{talent.is_verified ? '✅' : '⚪'}</span>
                    </button>
                    
                    {talent.is_participating_in_promotion && (
                      <div className="p-2 bg-purple-50 rounded-lg" title="Participating in promotion program">
                        <span className="text-lg">🎁</span>
                      </div>
                    )}
                    
                    <button
                      onClick={() => {
                        setEditingTalent(talent);
                        setEditDonateProceeds((talent.charity_percentage || 0) > 0 && !!talent.charity_name);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit talent profile and settings"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => window.open(`/talent/${talent.id}`, '_blank')}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="View public talent profile (opens in new tab)"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    
                    {talent.promo_video_url && (
                      <button
                        onClick={async () => {
                          try {
                            toast.loading('Preparing download with watermark...');
                            
                            // Simply download the video - watermark will be added when user views/shares
                            const link = document.createElement('a');
                            link.href = talent.promo_video_url!;
                            link.download = `${talent.username || talent.id}-promo-video-watermarked.mp4`;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            toast.dismiss();
                            toast.success('Downloading promo video with watermark...');
                          } catch (error) {
                            console.error('Download error:', error);
                            toast.error('Failed to download video');
                          }
                        }}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Download promo video (with watermark)"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => deleteTalent(talent.id, talent.users?.full_name || talent.username || 'talent')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Permanently delete talent profile"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No talent profiles yet</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first talent member.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add First Talent
            </button>
          </div>
        )}
      </div>

      {/* Edit Talent Modal */}
      {editingTalent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Talent Profile</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editingTalent.temp_full_name || editingTalent.users?.full_name || ''}
                  onChange={(e) => setEditingTalent({
                    ...editingTalent,
                    temp_full_name: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editingTalent.position || ''}
                  onChange={(e) => setEditingTalent({...editingTalent, position: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Congressman, Judge, Senator"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Title that appears above their name on profiles
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editingTalent.username || ''}
                  onChange={(e) => setEditingTalent({...editingTalent, username: e.target.value.toLowerCase()})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <ImageUpload
                  currentImageUrl={editingTalent.temp_avatar_url || editingTalent.users?.avatar_url}
                  onImageUploaded={(imageUrl) => setEditingTalent({
                    ...editingTalent,
                    temp_avatar_url: imageUrl
                  })}
                  uploadPath="talent-avatars"
                  maxSizeMB={5}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={editingTalent.bio}
                  onChange={(e) => setEditingTalent({...editingTalent, bio: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <CategorySelector
                  selectedCategories={editingTalent.categories || []}
                  onCategoryChange={(categories) => setEditingTalent({
                    ...editingTalent, 
                    categories,
                    category: categories[0] || 'other'
                  })}
                  autoSave={false}
                  startEditing={false}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Pricing ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingTalent.pricing}
                  onChange={(e) => setEditingTalent({...editingTalent, pricing: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corporate Pricing ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingTalent.corporate_pricing || editingTalent.pricing * 1.5}
                  onChange={(e) => setEditingTalent({...editingTalent, corporate_pricing: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_allow_corporate_pricing"
                    checked={editingTalent.allow_corporate_pricing || false}
                    onChange={(e) => setEditingTalent({...editingTalent, allow_corporate_pricing: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="edit_allow_corporate_pricing" className="ml-2 block text-sm font-medium text-gray-700">
                    Allow Corporate Pricing
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">Enable business/corporate pricing option for this talent</p>
              </div>
              
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_is_verified"
                    checked={editingTalent.is_verified || false}
                    onChange={(e) => setEditingTalent({...editingTalent, is_verified: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="edit_is_verified" className="ml-2 block text-sm font-medium text-gray-700">
                    Verified Talent
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">Show verification badge on talent profile</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Delivery Time (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={editingTalent.fulfillment_time_hours}
                  onChange={(e) => setEditingTalent({...editingTalent, fulfillment_time_hours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long it typically takes to fulfill orders
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Fee (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={editingTalent.admin_fee_percentage}
                  onChange={(e) => setEditingTalent({...editingTalent, admin_fee_percentage: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Charity Settings */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-1">Charity Settings</h4>
                  <p className="text-xs text-gray-500">
                    Enable charity donations for this talent
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newDonateState = !editDonateProceeds;
                      setEditDonateProceeds(newDonateState);
                      if (!newDonateState) {
                        setEditingTalent({...editingTalent, charity_name: '', charity_percentage: 0});
                      } else {
                        setEditingTalent({...editingTalent, charity_percentage: 5});
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      editDonateProceeds ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editDonateProceeds ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {editDonateProceeds ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Charity Fields - Only show when enabled */}
              {editDonateProceeds && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Charity Name *
                    </label>
                    <select
                      value={editingTalent.charity_name || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, charity_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={editDonateProceeds}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Charity Percentage * (Min 5%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={editingTalent.charity_percentage || 5}
                        onChange={(e) => {
                          const value = Math.max(5, Math.min(50, parseInt(e.target.value) || 5));
                          setEditingTalent({...editingTalent, charity_percentage: value});
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required={editDonateProceeds}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditingTalent(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateTalent()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TalentManagement;
