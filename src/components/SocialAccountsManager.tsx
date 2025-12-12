import React, { useState, useEffect } from 'react';
import { 
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { SocialAccount } from '../types';
import toast from 'react-hot-toast';

interface SocialAccountsManagerProps {
  talentId: string;
  readonly?: boolean;
}

const SocialAccountsManager: React.FC<SocialAccountsManagerProps> = ({ 
  talentId, 
  readonly = false 
}) => {
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newAccount, setNewAccount] = useState<{ platform: string; handle: string }>({
    platform: '',
    handle: ''
  });

  const SOCIAL_PLATFORMS = [
    { value: 'twitter', label: 'Twitter/X', placeholder: '@username' },
    { value: 'facebook', label: 'Facebook', placeholder: 'username' },
    { value: 'instagram', label: 'Instagram', placeholder: '@username' },
    { value: 'tiktok', label: 'TikTok', placeholder: '@username' },
    { value: 'rumble', label: 'Rumble', placeholder: 'username' },
    { value: 'linkedin', label: 'LinkedIn', placeholder: 'username' },
  ];

  useEffect(() => {
    fetchSocialAccounts();
  }, [talentId]);

  const fetchSocialAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('talent_id', talentId);

      if (error) throw error;
      setSocialAccounts(data || []);
    } catch (error) {
      console.error('Error fetching social accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSocialAccount = async () => {
    if (!newAccount.platform || !newAccount.handle.trim()) {
      toast.error('Please select a platform and enter a handle');
      return;
    }

    try {
      const handle = newAccount.handle.trim();
      
      // Insert into social_accounts table
      const { error } = await supabase
        .from('social_accounts')
        .insert([
          {
            talent_id: talentId,
            platform: newAccount.platform,
            handle: handle,
          },
        ]);

      if (error) throw error;

      // Also sync to talent_profiles _handle columns
      const handleColumn = `${newAccount.platform}_handle`;
      const cleanHandle = handle.replace('@', '');
      if (['twitter', 'instagram', 'facebook', 'tiktok', 'rumble'].includes(newAccount.platform)) {
        await supabase
          .from('talent_profiles')
          .update({ [handleColumn]: cleanHandle })
          .eq('id', talentId);
      }

      toast.success('Social account added successfully!');
      setNewAccount({ platform: '', handle: '' });
      fetchSocialAccounts();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('You already have an account for this platform');
      } else {
        toast.error('Failed to add social account');
      }
    }
  };

  const removeSocialAccount = async (accountId: string) => {
    try {
      // First get the account to know which platform to clear
      const accountToRemove = socialAccounts.find(a => a.id === accountId);
      
      const { error } = await supabase
        .from('social_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      // Also clear the talent_profiles _handle column
      if (accountToRemove && ['twitter', 'instagram', 'facebook', 'tiktok', 'rumble'].includes(accountToRemove.platform)) {
        const handleColumn = `${accountToRemove.platform}_handle`;
        await supabase
          .from('talent_profiles')
          .update({ [handleColumn]: null })
          .eq('id', talentId);
      }

      toast.success('Social account removed');
      fetchSocialAccounts();
    } catch (error) {
      console.error('Error removing social account:', error);
      toast.error('Failed to remove social account');
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: { [key: string]: string } = {
      twitter: '🐦',
      facebook: '📘',
      instagram: '📸',
      tiktok: '🎵',
      rumble: '📺',
      linkedin: '💼',
    };
    return icons[platform] || '🔗';
  };

  const getPlatformUrl = (platform: string, handle: string) => {
    const cleanHandle = handle.replace('@', '');
    const urls: { [key: string]: string } = {
      twitter: `https://twitter.com/${cleanHandle}`,
      facebook: `https://facebook.com/${cleanHandle}`,
      instagram: `https://instagram.com/${cleanHandle}`,
      tiktok: `https://tiktok.com/@${cleanHandle}`,
      rumble: `https://rumble.com/c/${cleanHandle}`,
      linkedin: `https://linkedin.com/in/${cleanHandle}`,
    };
    return urls[platform] || '#';
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900">Social Media Accounts</h4>
        {!readonly && (
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
          >
            <PencilIcon className="h-4 w-4" />
            <span>{editing ? 'Done' : 'Edit'}</span>
          </button>
        )}
      </div>

      {/* Existing Social Accounts */}
      <div className="space-y-3">
        {socialAccounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-xl">{getPlatformIcon(account.platform)}</span>
              <div>
                <p className="font-medium text-gray-900 capitalize">{account.platform}</p>
                <a
                  href={getPlatformUrl(account.platform, account.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  {account.handle}
                </a>
              </div>
            </div>
            {editing && (
              <button
                onClick={() => removeSocialAccount(account.id)}
                className="p-1 text-red-600 hover:text-red-700"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add New Social Account */}
      {editing && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Add Social Account</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <select
                value={newAccount.platform}
                onChange={(e) => setNewAccount({ ...newAccount, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Platform</option>
                {SOCIAL_PLATFORMS
                  .filter(p => !socialAccounts.find(sa => sa.platform === p.value))
                  .map(platform => (
                    <option key={platform.value} value={platform.value}>
                      {platform.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <input
                type="text"
                value={newAccount.handle}
                onChange={(e) => setNewAccount({ ...newAccount, handle: e.target.value })}
                placeholder={
                  newAccount.platform 
                    ? SOCIAL_PLATFORMS.find(p => p.value === newAccount.platform)?.placeholder 
                    : 'Enter handle'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <button
                onClick={addSocialAccount}
                disabled={!newAccount.platform || !newAccount.handle.trim()}
                className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {socialAccounts.length === 0 && !editing && (
        <div className="text-center py-6 text-gray-500">
          <p>No social accounts added yet</p>
          {!readonly && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 text-primary-600 hover:text-primary-700 text-sm"
            >
              Add your first social account
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SocialAccountsManager;
