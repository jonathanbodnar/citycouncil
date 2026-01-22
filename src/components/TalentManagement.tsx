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
    id: string;
    full_name: string;
    avatar_url?: string;
    email?: string;
    phone?: string;
    last_login?: string;
  };
  temp_phone?: string; // For editing phone number
  current_onboarding_step?: number; // Tracks which onboarding step the talent is on (1-5)
  featured_shoutout_types?: string[] | null; // Admin-configured shoutout types
}

const TalentManagement: React.FC = () => {
  const [talents, setTalents] = useState<TalentWithUser[]>([]);
  const [filteredTalents, setFilteredTalents] = useState<TalentWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'incomplete' | 'no-login'>('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const talentsPerPage = 10;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTalent, setEditingTalent] = useState<TalentWithUser | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [defaultAdminFee, setDefaultAdminFee] = useState(25); // Default to 25% if settings not loaded
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
    promote_on_launch: false, // Send SMS announcement when profile goes live
    charity_percentage: 5,
    charity_name: '',
    admin_fee_percentage: 25, // Will be updated from platform settings
    // Social links
    twitter_handle: '',
    instagram_handle: '',
    facebook_handle: '',
    tiktok_handle: '',
    rumble_handle: '',
    rumble_type: 'c' as 'c' | 'user', // 'c' for channel, 'user' for user
    youtube_handle: '',
    snapchat_handle: ''
  });
  
  // Charity donation toggle for admin creation
  const [adminDonateProceeds, setAdminDonateProceeds] = useState(false);
  
  // Charity donation toggle for admin editing
  const [editDonateProceeds, setEditDonateProceeds] = useState(false);

  useEffect(() => {
    fetchPlatformSettings();
    fetchTalents();
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('global_admin_fee_percentage')
        .single();

      if (error) throw error;

      if (data?.global_admin_fee_percentage) {
        const fetchedFee = data.global_admin_fee_percentage;
        console.log('Platform settings loaded: admin fee =', fetchedFee + '%');
        setDefaultAdminFee(fetchedFee);
        // Update newTalent with the fetched admin fee
        setNewTalent(prev => ({
          ...prev,
          admin_fee_percentage: fetchedFee
        }));
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
      // Keep default of 25% if fetch fails
    }
  };

  // Update admin fee input whenever defaultAdminFee changes
  useEffect(() => {
    setNewTalent(prev => ({
      ...prev,
      admin_fee_percentage: defaultAdminFee
    }));
  }, [defaultAdminFee]);

  useEffect(() => {
    // Filter talents based on search query AND status filter
    let filtered = talents;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(talent => 
        (talent.users?.full_name?.toLowerCase().includes(query)) ||
        (talent.temp_full_name?.toLowerCase().includes(query)) ||
        (talent.username?.toLowerCase().includes(query)) ||
        (talent.bio?.toLowerCase().includes(query)) ||
        (talent.category?.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(talent => {
        const hasCompletedProfile = !!(
          talent.username && 
          talent.bio && 
          (talent.temp_avatar_url || talent.users?.avatar_url) && 
          talent.promo_video_url
        );
        const hasLoggedIn = !!(talent.users?.last_login);
        
        switch (statusFilter) {
          case 'active':
            // Has completed profile and logged in
            return hasCompletedProfile && hasLoggedIn;
          case 'incomplete':
            // Profile is incomplete
            return !hasCompletedProfile;
          case 'no-login':
            // Has never logged in or no login recorded
            return !hasLoggedIn;
          default:
            return true;
        }
      });
    }
    
    setFilteredTalents(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [talents, searchQuery, statusFilter]);

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
            id,
            full_name,
            avatar_url,
            email,
            phone,
            last_login
          ),
          social_accounts (
            platform,
            handle
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
        base_pricing: newTalent.pricing, // Also set base_pricing for pricing urgency system
        corporate_pricing: newTalent.corporate_pricing,
        allow_corporate_pricing: newTalent.allow_corporate_pricing,
        is_verified: newTalent.is_verified,
        promote_on_launch: newTalent.promote_on_launch, // SMS announcement when profile goes live
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

      // Add social links if provided
      if (newTalent.twitter_handle) {
        insertData.twitter_handle = newTalent.twitter_handle.replace('@', '');
      }
      if (newTalent.instagram_handle) {
        insertData.instagram_handle = newTalent.instagram_handle.replace('@', '');
      }
      if (newTalent.facebook_handle) {
        insertData.facebook_handle = newTalent.facebook_handle.replace('@', '');
      }
      if (newTalent.tiktok_handle) {
        insertData.tiktok_handle = newTalent.tiktok_handle.replace('@', '');
      }
      if (newTalent.snapchat_handle) {
        insertData.snapchat_handle = newTalent.snapchat_handle.replace('@', '');
      }

      // Create talent profile using RPC function to bypass RLS issues
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('create_talent_profile_bypass_rls', insertData);

      if (rpcError) {
        console.error('Error creating talent profile via RPC:', rpcError);
        
        // Fallback to direct insert if RPC fails
        console.log('Attempting direct insert as fallback...');
        const { error: directError } = await supabase
          .from('talent_profiles')
          .insert([insertData]);

        if (directError) {
          console.error('Direct insert also failed:', directError);
          toast.error(`Database error: ${directError.message}`);
          throw directError;
        }
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
        promote_on_launch: false,
        charity_percentage: 5,
        charity_name: '',
        admin_fee_percentage: defaultAdminFee, // Use platform settings default
        twitter_handle: '',
        instagram_handle: '',
        rumble_handle: '',
        rumble_type: 'c' as 'c' | 'user',
        facebook_handle: '',
        tiktok_handle: '',
        youtube_handle: '',
        snapchat_handle: ''
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
        featured_shoutout_types: editingTalent.featured_shoutout_types || null,
        display_title: editingTalent.display_title || null,
        pricing: editingTalent.pricing || 100, // Default to $100 if pricing is null/undefined/0
        base_pricing: editingTalent.pricing || 100, // Also set base_pricing for pricing urgency system
        corporate_pricing: editingTalent.corporate_pricing,
        allow_corporate_pricing: editingTalent.allow_corporate_pricing,
        is_verified: editingTalent.is_verified,
        fulfillment_time_hours: editingTalent.fulfillment_time_hours,
        charity_percentage: editingTalent.charity_percentage,
        charity_name: editingTalent.charity_name,
        admin_fee_percentage: editingTalent.admin_fee_percentage,
        temp_avatar_url: editingTalent.temp_avatar_url,
        temp_full_name: editingTalent.temp_full_name,
        // Social links
        twitter_handle: editingTalent.twitter_handle || null,
        instagram_handle: editingTalent.instagram_handle || null,
        facebook_handle: editingTalent.facebook_handle || null,
        tiktok_handle: editingTalent.tiktok_handle || null,
        rumble_handle: editingTalent.rumble_handle || null,
        rumble_type: editingTalent.rumble_type || 'c',
        youtube_handle: editingTalent.youtube_handle || null
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
          tempImage: editingTalent.temp_avatar_url ? 'IMAGE_SET' : 'NO_IMAGE',
          tempPhone: editingTalent.temp_phone ? 'PHONE_SET' : 'NO_PHONE'
        });
        
        // Prepare user update data
        const userUpdateData: any = {
          full_name: editingTalent.temp_full_name,
          avatar_url: editingTalent.temp_avatar_url
        };
        
        // Add phone if it exists - SIMPLE: just +1 and 10 digits
        if (editingTalent.temp_phone) {
          const cleaned = editingTalent.temp_phone.replace(/\D/g, '');
          
          if (cleaned.length === 10) {
            // Store as +1XXXXXXXXXX for Comms Center compatibility
            userUpdateData.phone = `+1${cleaned}`;
            console.log('✅ Phone will be saved as:', userUpdateData.phone);
          } else if (cleaned.length === 0) {
            // Empty - clear phone
            userUpdateData.phone = null;
            console.log('📱 Phone will be cleared (empty input)');
          } else {
            console.error('❌ Invalid phone length:', cleaned.length, 'digits');
            toast.error(`Phone must be exactly 10 digits. You entered ${cleaned.length}.`);
            return; // Don't save
          }
        }
        
        console.log('🔄 ATTEMPTING USER UPDATE:', {
          user_id: editingTalent.user_id,
          updateData: userUpdateData
        });

        const { error: userError } = await supabase
          .from('users')
          .update(userUpdateData)
          .eq('id', editingTalent.user_id);

        if (userError) {
          console.error('❌ FAILED: User update error:', userError);
          toast.error(`Failed to update user: ${userError.message}`);
          return; // Stop if user update fails
        }
        
        // VERIFY the phone was actually saved
        const { data: verifyUserArray, error: verifyError } = await supabase
          .from('users')
          .select('phone, full_name')
          .eq('id', editingTalent.user_id);
        
        const verifyUser = verifyUserArray?.[0];
          
        console.log('✅ USER UPDATE COMPLETE - VERIFICATION:', {
          saved_phone: verifyUser?.phone,
          expected_phone: userUpdateData.phone,
          match: verifyUser?.phone === userUpdateData.phone
        });
        
        if (userUpdateData.phone) {
          if (verifyUser?.phone === userUpdateData.phone) {
            toast.success(`✅ Phone saved as ${userUpdateData.phone} - Talent will appear in Comms Center!`);
          } else {
            toast.error(`⚠️ Phone update FAILED - Database shows: ${verifyUser?.phone || 'NULL'}`);
          }
        }
      }

      // Update talent profile
      console.log('Attempting talent profile update...', { talentId: editingTalent.id, updateData });
      
      const { error: talentError } = await supabase
        .from('talent_profiles')
        .update(updateData)
        .eq('id', editingTalent.id);

      if (talentError) {
        console.error('FAILED: Talent profile update error:', talentError);
        toast.error(`Database error: ${talentError.message}`);
        throw talentError;
      }
      
      // Fetch the updated data separately to avoid RLS issues with returning data
      const { data: updatedDataArray, error: fetchError } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('id', editingTalent.id);
      
      const updatedData = updatedDataArray?.[0];
      console.log('Update result:', { data: updatedData, fetchError });
      
      if (fetchError) {
        console.error('FAILED: Could not fetch updated talent:', fetchError);
        // Don't fail here - update likely succeeded
      }

      console.log('SUCCESS: Talent profile update completed');

      // Sync social handles to social_accounts table for backwards compatibility
      try {
        const socialHandles = [
          { platform: 'twitter', handle: editingTalent.twitter_handle },
          { platform: 'instagram', handle: editingTalent.instagram_handle },
          { platform: 'facebook', handle: editingTalent.facebook_handle },
          { platform: 'tiktok', handle: editingTalent.tiktok_handle },
          { platform: 'rumble', handle: editingTalent.rumble_handle },
          { platform: 'youtube', handle: editingTalent.youtube_handle }
        ].filter(s => s.handle); // Only include non-empty handles

        // Delete existing social accounts for this talent
        const { error: deleteError } = await supabase
          .from('social_accounts')
          .delete()
          .eq('talent_id', editingTalent.id);

        if (deleteError) {
          console.warn('Warning: Could not delete existing social accounts:', deleteError);
          // Continue anyway - not critical
        }

        // Insert new social accounts if any
        if (socialHandles.length > 0) {
          const socialAccountsData = socialHandles.map(s => ({
            talent_id: editingTalent.id,
            platform: s.platform,
            handle: s.handle!.startsWith('@') ? s.handle : `@${s.handle}`
          }));

          const { error: socialError } = await supabase
            .from('social_accounts')
            .insert(socialAccountsData);

          if (socialError) {
            console.warn('Warning: Error syncing social accounts:', socialError);
            // Don't throw - main update succeeded
          } else {
            console.log('Social accounts synced successfully');
          }
        }
      } catch (socialSyncError) {
        console.warn('Warning: Social accounts sync failed, but talent update succeeded:', socialSyncError);
        // Don't fail the whole update for social accounts sync
      }

      // Now verify the data was actually saved
      const { data: verificationDataArray, error: verifyError } = await supabase
        .from('talent_profiles')
        .select(`
          *,
          users (
            full_name,
            avatar_url,
            email,
            phone
          )
        `)
        .eq('id', editingTalent.id);

      const verificationData = verificationDataArray?.[0];
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

    } catch (error: any) {
      console.error('Error updating talent:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      toast.error(`Failed to update talent profile: ${error?.message || 'Unknown error'}`);
    }
  };

  const toggleTalentStatus = async (talentId: string, field: 'is_active' | 'is_featured' | 'allow_corporate_pricing' | 'is_verified' | 'is_coming_soon' | 'bio_enabled', value: boolean) => {
    try {
      // If unfeaturing, remove the featured_order
      if (field === 'is_featured' && !value) {
        const { error } = await supabase
          .from('talent_profiles')
          .update({ [field]: value, featured_order: null })
          .eq('id', talentId);

        if (error) throw error;
        
        toast.success('Talent removed from featured carousel');
        fetchTalents();
        return;
      }

      const { error } = await supabase
        .from('talent_profiles')
        .update({ [field]: value })
        .eq('id', talentId);

      if (error) throw error;

      const action = field === 'is_active' 
        ? (value ? 'activated' : 'deactivated')
        : field === 'is_featured'
        ? (value ? 'added to featured carousel' : 'unfeatured')
        : field === 'allow_corporate_pricing'
        ? (value ? 'corporate pricing enabled' : 'corporate pricing disabled')
        : field === 'is_coming_soon'
        ? (value ? 'marked as Coming Soon' : 'Coming Soon removed (now orderable)')
        : field === 'bio_enabled'
        ? (value ? 'ShoutOut Bio enabled' : 'ShoutOut Bio disabled')
        : (value ? 'verified' : 'unverified');
      
      toast.success(`Talent ${action} successfully`);
      fetchTalents();

    } catch (error) {
      console.error(`Error toggling talent ${field}:`, error);
      toast.error(`Failed to update talent status`);
    }
  };

  const setDisplayOrder = async (talentId: string, newOrder: number | null) => {
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({ display_order: newOrder })
        .eq('id', talentId);

      if (error) throw error;

      if (newOrder === null) {
        toast.success('Display order removed - talent will sort by newest first');
      } else {
        toast.success(`Display order set to position ${newOrder}`);
      }
      fetchTalents();

    } catch (error) {
      console.error('Error setting display order:', error);
      toast.error('Failed to update display order');
    }
  };

  const setImagePosition = async (talentId: string, position: string) => {
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({ featured_image_position: position })
        .eq('id', talentId);

      if (error) throw error;

      toast.success('Featured image position updated - check carousel!');
      fetchTalents();

    } catch (error) {
      console.error('Error setting image position:', error);
      toast.error('Failed to update image position');
    }
  };

  const setFeaturedOrder = async (talentId: string, newOrder: number) => {
    try {
      // Get current featured talents
      const { data: featuredTalents, error: fetchError } = await supabase
        .from('talent_profiles')
        .select('id, featured_order')
        .eq('is_featured', true)
        .order('featured_order', { ascending: true, nullsFirst: false });

      if (fetchError) throw fetchError;

      // Find the talent being moved
      const movingTalent = featuredTalents?.find(t => t.id === talentId);
      const currentOrder = movingTalent?.featured_order || null;

      // If setting the same order, do nothing
      if (currentOrder === newOrder) return;

      // Shift other talents
      if (featuredTalents) {
        for (const talent of featuredTalents) {
          if (talent.id === talentId) continue;

          let updatedOrder = talent.featured_order;

          if (currentOrder === null) {
            // New featured talent - shift everyone at or after newOrder down
            if (talent.featured_order && talent.featured_order >= newOrder) {
              updatedOrder = talent.featured_order + 1;
            }
          } else {
            // Moving existing featured talent
            if (newOrder > currentOrder) {
              // Moving down - shift talents between old and new position up
              if (talent.featured_order && talent.featured_order > currentOrder && talent.featured_order <= newOrder) {
                updatedOrder = talent.featured_order - 1;
              }
            } else {
              // Moving up - shift talents between new and old position down
              if (talent.featured_order && talent.featured_order >= newOrder && talent.featured_order < currentOrder) {
                updatedOrder = talent.featured_order + 1;
              }
            }
          }

          if (updatedOrder !== talent.featured_order) {
            await supabase
              .from('talent_profiles')
              .update({ featured_order: updatedOrder })
              .eq('id', talent.id);
          }
        }
      }

      // Update the moving talent's order
      const { error: updateError } = await supabase
        .from('talent_profiles')
        .update({ featured_order: newOrder, is_featured: true })
        .eq('id', talentId);

      if (updateError) throw updateError;

      toast.success(`Featured order updated to position ${newOrder}`);
      fetchTalents();

    } catch (error) {
      console.error('Error setting featured order:', error);
      toast.error('Failed to update featured order');
    }
  };

  const deleteTalent = async (talentId: string, talentName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${talentName}? This action cannot be undone and will also delete all related data (orders, reviews, etc.).`)) {
      return;
    }

    try {
      // Check if talent has any orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('talent_id', talentId);

      if (ordersError) throw ordersError;

      if (orders && orders.length > 0) {
        const confirmDelete = window.confirm(
          `This talent has ${orders.length} order(s). Deleting the profile will also delete all orders, reviews, and notifications. Are you ABSOLUTELY sure?`
        );
        if (!confirmDelete) return;
      }

      // Delete related records first (in correct order to avoid foreign key constraints)
      
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        
        // Delete each order's dependencies individually to avoid any filtering issues
        for (const orderId of orderIds) {
          // 1. Delete reviews for this order
          await supabase
            .from('reviews')
            .delete()
            .eq('order_id', orderId);

          // 2. Delete notifications for this order
          await supabase
            .from('notifications')
            .delete()
            .eq('order_id', orderId);

          // 3. Delete short links for this order
          await supabase
            .from('short_links')
            .delete()
            .eq('order_id', orderId);

          // 4. Delete fulfillment auth tokens for this order
          await supabase
            .from('fulfillment_auth_tokens')
            .delete()
            .eq('order_id', orderId);

          // 5. Delete magic auth tokens for this order
          await supabase
            .from('magic_auth_tokens')
            .delete()
            .eq('order_id', orderId);

          // 6. Delete payouts for this order
          await supabase
            .from('payouts')
            .delete()
            .eq('order_id', orderId);

          // 7. Delete payout errors for this order
          await supabase
            .from('payout_errors')
            .delete()
            .eq('order_id', orderId);
        }
      }

      // 6. Delete reviews by talent_id (talent reviews)
      const { error: talentReviewsError } = await supabase
        .from('reviews')
        .delete()
        .eq('talent_id', talentId);
      
      if (talentReviewsError) console.error('Error deleting talent reviews:', talentReviewsError);

      // 7. Delete orders (now that all references are cleared)
      const { error: ordersDeleteError } = await supabase
        .from('orders')
        .delete()
        .eq('talent_id', talentId);

      if (ordersDeleteError) throw ordersDeleteError;

      // 8. Delete promotional videos
      const { error: videosError } = await supabase
        .from('promotional_videos')
        .delete()
        .eq('talent_id', talentId);
      
      if (videosError) console.error('Error deleting promotional videos:', videosError);

      // 9. Delete social accounts
      const { error: socialError } = await supabase
        .from('social_accounts')
        .delete()
        .eq('talent_profile_id', talentId);
      
      if (socialError) console.error('Error deleting social accounts:', socialError);

      // 10. Delete blocked availability
      const { error: availabilityError } = await supabase
        .from('blocked_availability')
        .delete()
        .eq('talent_id', talentId);
      
      if (availabilityError) console.error('Error deleting blocked availability:', availabilityError);

      // 11. Finally, delete the talent profile
      const { error } = await supabase
        .from('talent_profiles')
        .delete()
        .eq('id', talentId);

      if (error) throw error;

      toast.success('Talent profile and all related data deleted successfully');
      fetchTalents();

    } catch (error: any) {
      console.error('Error deleting talent:', error);
      toast.error(`Failed to delete talent profile: ${error.message || 'Unknown error'}`);
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
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" style={{ backgroundColor: 'rgba(17, 24, 39, 0.98)' }}>
          {/* Solid backdrop to block everything behind */}
          <div className="absolute inset-0 bg-gray-900" style={{ backgroundColor: '#0f172a' }}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
              <h3 className="text-xl font-bold text-white">Add New Talent</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info Section */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newTalent.full_name}
                      onChange={(e) => setNewTalent({...newTalent, full_name: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">shoutout.us/</span>
                      <input
                        type="text"
                        required
                        value={newTalent.username}
                        onChange={(e) => setNewTalent({...newTalent, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')})}
                        className="w-full pl-24 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input
                      type="text"
                      value={newTalent.position}
                      onChange={(e) => setNewTalent({...newTalent, position: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      placeholder="e.g., Congressman, Judge"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Time</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={newTalent.fulfillment_time_hours}
                        onChange={(e) => setNewTalent({...newTalent, fulfillment_time_hours: parseInt(e.target.value)})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 text-sm">hours</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio *</label>
                    <textarea
                      required
                      rows={3}
                      value={newTalent.bio}
                      onChange={(e) => setNewTalent({...newTalent, bio: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
                      placeholder="Brief description of the talent..."
                    />
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
                    <CategorySelector
                      selectedCategories={newTalent.categories}
                      onCategoryChange={(categories) => setNewTalent({...newTalent, categories, category: categories[0] || 'other'})}
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pricing & Fees
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Personal Price</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newTalent.pricing}
                        onChange={(e) => setNewTalent({...newTalent, pricing: parseFloat(e.target.value)})}
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Corporate Price</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newTalent.corporate_pricing}
                        onChange={(e) => setNewTalent({...newTalent, corporate_pricing: parseFloat(e.target.value)})}
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={newTalent.admin_fee_percentage}
                        onChange={(e) => setNewTalent({...newTalent, admin_fee_percentage: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">%</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTalent.allow_corporate_pricing}
                      onChange={(e) => setNewTalent({...newTalent, allow_corporate_pricing: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Allow Corporate Pricing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTalent.is_verified}
                      onChange={(e) => setNewTalent({...newTalent, is_verified: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Verified Talent ✓</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTalent.promote_on_launch}
                      onChange={(e) => setNewTalent({...newTalent, promote_on_launch: e.target.checked})}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">📢 Promote on Launch</span>
                  </label>
                </div>
              </div>

              {/* Charity Section */}
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    Charity Donations
                  </h4>
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      adminDonateProceeds ? 'bg-red-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                        adminDonateProceeds ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {adminDonateProceeds && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Charity Name *</label>
                      <select
                        value={newTalent.charity_name}
                        onChange={(e) => setNewTalent({...newTalent, charity_name: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        required={adminDonateProceeds}
                      >
                        <option value="">Select a charity...</option>
                        <option value="American Red Cross">American Red Cross</option>
                        <option value="St. Jude Children's Research Hospital">St. Jude Children's Research Hospital</option>
                        <option value="Wounded Warrior Project">Wounded Warrior Project</option>
                        <option value="Doctors Without Borders">Doctors Without Borders</option>
                        <option value="Habitat for Humanity">Habitat for Humanity</option>
                        <option value="United Way">United Way</option>
                        <option value="Salvation Army">Salvation Army</option>
                        <option value="Make-A-Wish Foundation">Make-A-Wish Foundation</option>
                        <option value="American Cancer Society">American Cancer Society</option>
                        <option value="Other">Other (specify in bio)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Donation Percentage *</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="5"
                          max="100"
                          value={newTalent.charity_percentage || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : Math.max(5, Math.min(100, parseInt(e.target.value)));
                            setNewTalent({...newTalent, charity_percentage: value});
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                          placeholder="5-100"
                          required={adminDonateProceeds}
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Min 5%, Max 100%</p>
                    </div>
                  </div>
                )}
                {!adminDonateProceeds && (
                  <p className="text-sm text-gray-500">Enable to allow this talent to donate a percentage of earnings to charity.</p>
                )}
              </div>

              {/* Social Links Section */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Social Links <span className="text-gray-400 font-normal">(Optional)</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Twitter/X</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">@</span>
                      <input
                        type="text"
                        value={newTalent.twitter_handle}
                        onChange={(e) => setNewTalent({...newTalent, twitter_handle: e.target.value.replace('@', '')})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Instagram</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">@</span>
                      <input
                        type="text"
                        value={newTalent.instagram_handle}
                        onChange={(e) => setNewTalent({...newTalent, instagram_handle: e.target.value.replace('@', '')})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Facebook</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">@</span>
                      <input
                        type="text"
                        value={newTalent.facebook_handle}
                        onChange={(e) => setNewTalent({...newTalent, facebook_handle: e.target.value.replace('@', '')})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">TikTok</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">@</span>
                      <input
                        type="text"
                        value={newTalent.tiktok_handle}
                        onChange={(e) => setNewTalent({...newTalent, tiktok_handle: e.target.value.replace('@', '')})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">YouTube</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">@</span>
                      <input
                        type="text"
                        value={newTalent.youtube_handle}
                        onChange={(e) => setNewTalent({...newTalent, youtube_handle: e.target.value.replace('@', '')})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        placeholder="channel"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rumble</label>
                    <div className="flex gap-1">
                      <select
                        value={newTalent.rumble_type}
                        onChange={(e) => setNewTalent({...newTalent, rumble_type: e.target.value as 'c' | 'user'})}
                        className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-xs"
                      >
                        <option value="c">/c/</option>
                        <option value="user">/user/</option>
                      </select>
                      <input
                        type="text"
                        value={newTalent.rumble_handle}
                        onChange={(e) => setNewTalent({...newTalent, rumble_handle: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        placeholder="name"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={createTalent}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Talent Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Talent ({talents.length})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <CheckCircleIcon className="h-4 w-4 inline mr-1" />
          Active ({talents.filter(t => {
            const hasCompleteProfile = !!(t.username && t.bio && (t.temp_avatar_url || t.users?.avatar_url) && t.promo_video_url);
            const hasLoggedIn = !!(t.users?.last_login);
            return hasCompleteProfile && hasLoggedIn;
          }).length})
        </button>
        <button
          onClick={() => setStatusFilter('incomplete')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'incomplete'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <ClockIcon className="h-4 w-4 inline mr-1" />
          Incomplete Profile ({talents.filter(t => {
            const hasCompleteProfile = !!(t.username && t.bio && (t.temp_avatar_url || t.users?.avatar_url) && t.promo_video_url);
            return !hasCompleteProfile;
          }).length})
        </button>
        <button
          onClick={() => setStatusFilter('no-login')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'no-login'
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <XCircleIcon className="h-4 w-4 inline mr-1" />
          No Login ({talents.filter(t => !t.users?.last_login).length})
        </button>
      </div>

      {/* Talents List */}
      <div className="glass rounded-2xl shadow-modern">
        <div className="px-6 py-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5" />
              Talent Profiles ({filteredTalents.length}{searchQuery || statusFilter !== 'all' ? ` of ${talents.length}` : ''})
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
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1 flex-wrap">
                        <span>@{talent.username}</span>
                        <span>•</span>
                        <span>${talent.pricing}</span>
                        <span>•</span>
                        <span>{talent.category.replace('-', ' ')}</span>
                        {talent.first_orders_promo_active && talent.fulfilled_orders < 10 && (
                          <>
                            <span>•</span>
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                              0% FEE ({talent.fulfilled_orders}/10 orders)
                            </span>
                          </>
                        )}
                      </div>
                      
                      {/* Onboarding Status & Last Login */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 flex-wrap">
                        {/* Onboarding Step */}
                        {!talent.onboarding_completed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                            <ClockIcon className="h-3 w-3" />
                            {(() => {
                              const stepNames = {
                                1: 'Step 1: Account Setup',
                                2: 'Step 2: Profile Details',
                                3: 'Step 3: Payout Info',
                                4: 'Step 4: Promo Video',
                                5: 'Completing...'
                              };
                              return stepNames[talent.current_onboarding_step as keyof typeof stepNames] || 'Not Started';
                            })()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                            <CheckCircleIcon className="h-3 w-3" />
                            Setup Complete
                          </span>
                        )}
                        
                        {/* Last Login */}
                        {talent.users?.last_login && (
                          <>
                            <span>•</span>
                            <span title={new Date(talent.users.last_login).toLocaleString()}>
                              Last login: {(() => {
                                const lastLogin = new Date(talent.users.last_login);
                                const now = new Date();
                                const diffMs = now.getTime() - lastLogin.getTime();
                                const diffMins = Math.floor(diffMs / 60000);
                                const diffHours = Math.floor(diffMs / 3600000);
                                const diffDays = Math.floor(diffMs / 86400000);
                                
                                if (diffMins < 60) return `${diffMins}m ago`;
                                if (diffHours < 24) return `${diffHours}h ago`;
                                if (diffDays < 7) return `${diffDays}d ago`;
                                return lastLogin.toLocaleDateString();
                              })()}
                            </span>
                          </>
                        )}
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
                    
                    {talent.is_featured && (
                      <>
                        <select
                          value={talent.featured_order || ''}
                          onChange={(e) => {
                            const order = parseInt(e.target.value);
                            if (order) setFeaturedOrder(talent.id, order);
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          title="Featured position in carousel"
                        >
                          <option value="">Order...</option>
                          {Array.from({ length: Math.max(10, talents.filter(t => t.is_featured).length + 1) }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>
                              Position {num}
                            </option>
                          ))}
                        </select>
                        
                        <select
                          value={talent.featured_image_position || 'center center'}
                          onChange={(e) => setImagePosition(talent.id, e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          title="Adjust face position in carousel image"
                        >
                          <option value="center center">Face Center</option>
                          <option value="center 20%">Face Top</option>
                          <option value="center 30%">Face Upper</option>
                          <option value="center 40%">Face Mid-Upper</option>
                          <option value="center 60%">Face Mid-Lower</option>
                          <option value="center 70%">Face Lower</option>
                          <option value="left center">Face Left</option>
                          <option value="right center">Face Right</option>
                        </select>
                      </>
                    )}
                    
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
                    
                    <button
                      onClick={() => toggleTalentStatus(talent.id, 'is_coming_soon', !talent.is_coming_soon)}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.is_coming_soon 
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                          : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                      }`}
                      title={talent.is_coming_soon ? 'Remove Coming Soon status (make orderable)' : 'Mark as Coming Soon (shows on /home but not orderable)'}
                    >
                      <span className="text-lg">{talent.is_coming_soon ? '⏳' : '⚪'}</span>
                    </button>
                    
                    <button
                      onClick={() => toggleTalentStatus(talent.id, 'bio_enabled', !talent.bio_enabled)}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.bio_enabled 
                          ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' 
                          : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                      }`}
                      title={talent.bio_enabled ? 'Disable ShoutOut Bio access' : 'Enable ShoutOut Bio access for this talent'}
                    >
                      <span className="text-lg">{talent.bio_enabled ? '🔗' : '⚪'}</span>
                    </button>
                    
                    {/* Display Order Control */}
                    <select
                      value={talent.display_order === null || talent.display_order === undefined ? '' : talent.display_order}
                      onChange={(e) => {
                        const order = e.target.value === '' ? null : parseInt(e.target.value);
                        setDisplayOrder(talent.id, order);
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Display order on /home page (lower = higher on page, blank = newest first)"
                    >
                      <option value="">Auto (newest)</option>
                      {Array.from({ length: 50 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>
                          Position {num}
                        </option>
                      ))}
                    </select>
                    
                    {talent.is_participating_in_promotion && (
                      <div className="p-2 bg-purple-50 rounded-lg" title="Participating in promotion program">
                        <span className="text-lg">🎁</span>
                      </div>
                    )}
                    
                    <button
                      onClick={() => {
                        // Initialize temp_phone - just store 10 digits
                        const phoneFromDB = talent.users?.phone;
                        let cleanedPhone = '';
                        if (phoneFromDB) {
                          cleanedPhone = phoneFromDB.replace(/\D/g, '');
                          // If it's 11 digits starting with 1, strip the 1
                          if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
                            cleanedPhone = cleanedPhone.substring(1);
                          }
                        }
                        
                        // Populate handle fields from social_accounts if not already set
                        const socialAccounts = (talent as any).social_accounts || [];
                        const getHandleFromSocial = (platform: string) => {
                          const account = socialAccounts.find((a: any) => a.platform === platform);
                          return account?.handle?.replace('@', '') || null;
                        };
                        
                        setEditingTalent({
                          ...talent,
                          temp_phone: cleanedPhone, // Store just 10 digits
                          // Pre-populate from social_accounts if direct columns are empty
                          twitter_handle: talent.twitter_handle || getHandleFromSocial('twitter'),
                          instagram_handle: talent.instagram_handle || getHandleFromSocial('instagram'),
                          facebook_handle: talent.facebook_handle || getHandleFromSocial('facebook'),
                          tiktok_handle: talent.tiktok_handle || getHandleFromSocial('tiktok'),
                          rumble_handle: talent.rumble_handle || getHandleFromSocial('rumble'),
                          youtube_handle: talent.youtube_handle || getHandleFromSocial('youtube')
                        });
                        setEditDonateProceeds((talent.charity_percentage || 0) > 0 && !!talent.charity_name);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit talent profile and settings"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => window.open(talent.username ? `/${talent.username}` : `/talent/${talent.id}`, '_blank')}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="View public talent profile (opens in new tab)"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={async () => {
                        // Check if talent has a user_id (linked auth account)
                        if (!talent.user_id) {
                          toast.error('This talent has not completed registration yet. They need to finish onboarding first.');
                          return;
                        }
                        
                        // eslint-disable-next-line no-restricted-globals
                        if (!confirm(`Login as ${talent.users?.full_name || talent.temp_full_name || talent.username}? You will be logged out of admin.`)) {
                          return;
                        }
                        
                        try {
                          toast.loading('Logging in as talent...', { id: 'login-as' });
                          
                          // Call the admin impersonation edge function with user_id
                          const { data, error } = await supabase.functions.invoke('admin-impersonate', {
                            body: { userId: talent.user_id }
                          });
                          
                          if (error) {
                            throw new Error(error.message || 'Failed to impersonate user');
                          }
                          
                          if (!data?.session) {
                            throw new Error('No session data returned');
                          }
                          
                          // Store admin info for easy return
                          const { data: { user: currentAdmin } } = await supabase.auth.getUser();
                          if (currentAdmin) {
                            localStorage.setItem('admin_return_email', currentAdmin.email || '');
                          }
                          
                          // Set the new session for the talent user FIRST (this will replace the admin session)
                          // Don't sign out first - setSession will handle the session swap
                          const { error: sessionError } = await supabase.auth.setSession({
                            access_token: data.session.access_token,
                            refresh_token: data.session.refresh_token
                          });
                          
                          if (sessionError) {
                            throw sessionError;
                          }
                          
                          toast.success('Logged in as ' + (talent.users?.full_name || talent.temp_full_name || 'talent'), { id: 'login-as' });
                          
                          // Use window.location.replace for immediate redirect (avoids React state issues)
                          window.location.replace('/dashboard');
                          
                        } catch (error: any) {
                          console.error('Error logging in as talent:', error);
                          toast.error(error.message || 'Failed to login as talent', { id: 'login-as' });
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        talent.user_id 
                          ? 'text-purple-600 hover:bg-purple-50' 
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                      title={talent.user_id ? 'Login as this talent (for testing)' : 'Talent has not completed registration'}
                      disabled={!talent.user_id}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </button>
                    
                    {/* Bio Dashboard button */}
                    <button
                      onClick={() => {
                        // Open bio dashboard with talent's ID as token for auto-login
                        const bioUrl = `https://bio.shoutout.us/dashboard?token=${talent.id}`;
                        window.open(bioUrl, '_blank');
                      }}
                      className="p-2 rounded-lg transition-colors text-blue-600 hover:bg-blue-50"
                      title="Open Bio Dashboard for this talent"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </button>
                    
                    {talent.promo_video_url && (
                      <button
                        onClick={async () => {
                          try {
                            toast.loading('Adding watermark...', { id: 'watermark' });
                            
                            // Call watermark edge function
                            const { data, error } = await supabase.functions.invoke('watermark-video', {
                              body: { 
                                videoUrl: talent.promo_video_url,
                                orderId: talent.id,
                                talentName: talent.users?.full_name || talent.temp_full_name || talent.username
                              }
                            });

                            if (error) {
                              console.error('Watermark error:', error);
                              throw error;
                            }

                            if (data.warning) {
                              console.warn('Watermark warning:', data.warning);
                              toast.error(data.warning, { id: 'watermark' });
                              return;
                            }

                            console.log('Watermarked URL from Cloudinary:', data.watermarkedUrl);
                            toast.success('Watermark applied!', { id: 'watermark' });
                            
                            // Download the watermarked video
                            toast.loading('Downloading video...', { id: 'download' });
                            const response = await fetch(data.watermarkedUrl);
                            const blob = await response.blob();
                            
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `shoutout-${talent.username || talent.id}-watermarked.mp4`;
                            document.body.appendChild(link);
                            link.click();
                            
                            // Cleanup
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(link);
                            
                            toast.success('Video downloaded!', { id: 'download' });
                          } catch (error) {
                            console.error('Download error:', error);
                            toast.error('Failed to download video. Try direct download from profile.', { id: 'download' });
                          }
                        }}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Download promo video with watermark"
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
        
        {/* Pagination Controls */}
        {filteredTalents.length > talentsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * talentsPerPage) + 1} - {Math.min(currentPage * talentsPerPage, filteredTalents.length)} of {filteredTalents.length} talent
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = Math.ceil(filteredTalents.length / talentsPerPage);
                  const pages = [];
                  const maxVisiblePages = 5;
                  
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                  
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                          currentPage === i
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pages;
                })()}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredTalents.length / talentsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(filteredTalents.length / talentsPerPage)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  currentPage >= Math.ceil(filteredTalents.length / talentsPerPage)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(Math.ceil(filteredTalents.length / talentsPerPage))}
                disabled={currentPage >= Math.ceil(filteredTalents.length / talentsPerPage)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  currentPage >= Math.ceil(filteredTalents.length / talentsPerPage)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Talent Modal */}
      {editingTalent && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" style={{ backgroundColor: 'rgba(17, 24, 39, 0.98)' }}>
          {/* Solid backdrop to block everything behind */}
          <div className="absolute inset-0 bg-gray-900" style={{ backgroundColor: '#0f172a' }}></div>
          <div className="relative bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  Banner Card Title <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editingTalent.display_title || ''}
                  onChange={(e) => setEditingTalent({
                    ...editingTalent,
                    display_title: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Custom title for homepage banner"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If set, replaces their name on homepage banner cards
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editingTalent.temp_phone || ''}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    if (cleaned.length <= 10) {
                      // Store the raw 10-digit number
                      setEditingTalent({...editingTalent, temp_phone: cleaned});
                    }
                  }}
                  onBlur={(e) => {
                    // Format for display when user leaves the field
                    const cleaned = e.target.value.replace(/\D/g, '');
                    if (cleaned.length === 10) {
                      const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                      setEditingTalent({...editingTalent, temp_phone: formatted});
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="6319438186 or (631) 943-8186"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For MFA and SMS notifications
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                  {editingTalent.users?.email || 'No email'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed from this panel
                </p>
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
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Featured ShoutOut Types
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'pep-talk', label: '💝 Surprise a Loved One' },
                    { value: 'birthday', label: '🎂 Birthday Wishes' },
                    { value: 'roast', label: '🔥 Friendly Roast' },
                    { value: 'advice', label: '💡 Get Advice' },
                    { value: 'corporate', label: '🏢 Corporate Event' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(editingTalent.featured_shoutout_types || []).includes(option.value)}
                        onChange={(e) => {
                          const currentTypes = editingTalent.featured_shoutout_types || [];
                          let newTypes;
                          if (e.target.checked) {
                            newTypes = [...currentTypes, option.value];
                          } else {
                            newTypes = currentTypes.filter(t => t !== option.value);
                          }
                          setEditingTalent({
                            ...editingTalent,
                            featured_shoutout_types: newTypes.length > 0 ? newTypes : null
                          });
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Leave all unchecked to auto-show from their orders. Select specific types to display on homepage banners.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Pricing ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={editingTalent.pricing || ''}
                  onChange={(e) => setEditingTalent({...editingTalent, pricing: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
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
            
            {/* Social Links */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">Social Links</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twitter/X Handle
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                    <input
                      type="text"
                      value={editingTalent.twitter_handle || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, twitter_handle: e.target.value.replace('@', '')})}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="username"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                    <input
                      type="text"
                      value={editingTalent.instagram_handle || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, instagram_handle: e.target.value.replace('@', '')})}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="username"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facebook Handle
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                    <input
                      type="text"
                      value={editingTalent.facebook_handle || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, facebook_handle: e.target.value.replace('@', '')})}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="username"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TikTok Handle
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                    <input
                      type="text"
                      value={editingTalent.tiktok_handle || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, tiktok_handle: e.target.value.replace('@', '')})}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="username"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rumble
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editingTalent.rumble_type || 'c'}
                      onChange={(e) => setEditingTalent({...editingTalent, rumble_type: e.target.value as 'c' | 'user'})}
                      className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="c">Channel (/c/)</option>
                      <option value="user">User (/user/)</option>
                    </select>
                    <input
                      type="text"
                      value={editingTalent.rumble_handle || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, rumble_handle: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Name"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    YouTube
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                    <input
                      type="text"
                      value={editingTalent.youtube_handle || ''}
                      onChange={(e) => setEditingTalent({...editingTalent, youtube_handle: e.target.value.replace('@', '')})}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="channel"
                    />
                  </div>
                </div>
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
