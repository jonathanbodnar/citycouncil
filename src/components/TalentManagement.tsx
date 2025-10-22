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
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, TalentCategory } from '../types';
import ImageUpload from './ImageUpload';
import CategorySelector from './CategorySelector';
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTalent, setEditingTalent] = useState<TalentWithUser | null>(null);
  const [newTalent, setNewTalent] = useState({
    full_name: '',
    username: '',
    bio: '',
    avatar_url: '',
    category: 'other' as TalentCategory,
    categories: [] as TalentCategory[],
    pricing: 299.99,
    corporate_pricing: 449.99,
    fulfillment_time_hours: 48,
    charity_percentage: 10,
    charity_name: '',
    admin_fee_percentage: 15
  });

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

      // Create talent profile without user first (user will be created during onboarding)
      const { error } = await supabase
        .from('talent_profiles')
        .insert([
          {
            // Store talent data for onboarding, user_id will be set later
            username: newTalent.username.toLowerCase(),
            bio: newTalent.bio,
            category: newTalent.category,
            categories: newTalent.categories.length > 0 ? newTalent.categories : [newTalent.category],
            pricing: newTalent.pricing,
            corporate_pricing: newTalent.corporate_pricing,
            fulfillment_time_hours: newTalent.fulfillment_time_hours,
            charity_percentage: newTalent.charity_percentage,
            charity_name: newTalent.charity_name,
            admin_fee_percentage: newTalent.admin_fee_percentage,
            onboarding_token: onboardingToken,
            onboarding_completed: false,
            onboarding_expires_at: expiryDate.toISOString(),
            is_featured: false,
            is_active: false, // Will be activated after onboarding
            total_orders: 0,
            fulfilled_orders: 0,
            average_rating: 0,
            // Store admin-provided data for onboarding
            temp_full_name: newTalent.full_name,
            temp_avatar_url: newTalent.avatar_url
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating talent profile:', error);
        throw error;
      }

      console.log('Talent profile created with token:', onboardingToken);
      toast.success('Talent profile created successfully!');
      setShowAddForm(false);
      setNewTalent({
        full_name: '',
        username: '',
        bio: '',
        avatar_url: '',
        category: 'other' as TalentCategory,
        categories: [] as TalentCategory[],
        pricing: 299.99,
        corporate_pricing: 449.99,
        fulfillment_time_hours: 48,
        charity_percentage: 10,
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
      // Update user record
      if (editingTalent.user_id) {
        const { error: userError } = await supabase
          .from('users')
          .update({
            full_name: editingTalent.users?.full_name,
            avatar_url: editingTalent.users?.avatar_url || editingTalent.temp_avatar_url
          })
          .eq('id', editingTalent.user_id);

        if (userError) throw userError;
      }

      // Update talent profile - COMPLETE UPDATE
      const { error: talentError } = await supabase
        .from('talent_profiles')
        .update({
          username: editingTalent.username?.toLowerCase(),
          bio: editingTalent.bio,
          category: editingTalent.category,
          categories: editingTalent.categories,
          pricing: editingTalent.pricing,
          corporate_pricing: editingTalent.corporate_pricing,
          fulfillment_time_hours: editingTalent.fulfillment_time_hours,
          charity_percentage: editingTalent.charity_percentage,
          charity_name: editingTalent.charity_name,
          admin_fee_percentage: editingTalent.admin_fee_percentage,
          temp_avatar_url: editingTalent.temp_avatar_url,
          temp_full_name: editingTalent.temp_full_name
        })
        .eq('id', editingTalent.id);

      if (talentError) throw talentError;

      toast.success('Talent profile updated successfully');
      setEditingTalent(null);
      fetchTalents();

    } catch (error) {
      console.error('Error updating talent:', error);
      toast.error('Failed to update talent profile');
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
                  Fulfillment Time (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={newTalent.fulfillment_time_hours}
                  onChange={(e) => setNewTalent({...newTalent, fulfillment_time_hours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Charity Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newTalent.charity_percentage}
                  onChange={(e) => setNewTalent({...newTalent, charity_percentage: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Charity Name
                </label>
                <input
                  type="text"
                  value={newTalent.charity_name}
                  onChange={(e) => setNewTalent({...newTalent, charity_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional charity name"
                />
              </div>
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
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5" />
              Talent Profiles ({filteredTalents.length}{searchQuery ? ` of ${talents.length}` : ''})
            </h3>
          </div>
        </div>
        
        {filteredTalents.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredTalents.map((talent) => (
              <div key={talent.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {talent.users?.avatar_url ? (
                        <img
                          src={talent.users.avatar_url}
                          alt={talent.users?.full_name || 'Talent'}
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
                          {talent.users?.full_name || talent.temp_full_name || 'Pending Setup'}
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
                          title="Copy onboarding link"
                        >
                          <LinkIcon className="h-4 w-4" />
                          Copy Link
                        </button>
                        
                        <button
                          onClick={() => regenerateOnboardingToken(talent.id)}
                          className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Generate new token"
                        >
                          <ClockIcon className="h-4 w-4" />
                          Renew
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={() => setEditingTalent(talent)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit talent"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => window.open(`/talent/${talent.id}`, '_blank')}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="View profile"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => deleteTalent(talent.id, talent.users?.full_name || talent.username || 'talent')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete talent"
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
                  value={editingTalent.users?.full_name || ''}
                  onChange={(e) => setEditingTalent({
                    ...editingTalent,
                    users: { ...editingTalent.users!, full_name: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
                  currentImageUrl={editingTalent.users?.avatar_url}
                  onImageUploaded={(imageUrl) => setEditingTalent({
                    ...editingTalent,
                    users: { ...editingTalent.users!, avatar_url: imageUrl }
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
