import React, { useState, useEffect } from 'react';
import { 
  UsersIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  XMarkIcon,
  StarIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { TalentProfile, HelpMessage, AppSettings } from '../types';
import TalentProfileEditor from './TalentProfileEditor';
import toast from 'react-hot-toast';

interface TalentWithUser extends TalentProfile {
  users: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

const AdminManagementTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'talent' | 'settings' | 'helpdesk'>('talent');
  const [talent, setTalent] = useState<TalentWithUser[]>([]);
  const [helpMessages, setHelpMessages] = useState<HelpMessage[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTalent, setEditingTalent] = useState<TalentWithUser | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'talent') {
        const { data, error } = await supabase
          .from('talent_profiles')
          .select(`
            *,
            users!talent_profiles_user_id_fkey (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTalent(data || []);
      } else if (activeTab === 'helpdesk') {
        const { data, error } = await supabase
          .from('help_messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setHelpMessages(data || []);
      } else if (activeTab === 'settings') {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .single();

        if (error) throw error;
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeatured = async (talentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({ is_featured: !currentStatus })
        .eq('id', talentId);

      if (error) throw error;

      toast.success(`Talent ${!currentStatus ? 'featured' : 'unfeatured'} successfully`);
      fetchData();
    } catch (error) {
      console.error('Error updating featured status:', error);
      toast.error('Failed to update featured status');
    }
  };

  const handleToggleActive = async (talentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({ is_active: !currentStatus })
        .eq('id', talentId);

      if (error) throw error;

      toast.success(`Talent ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchData();
    } catch (error) {
      console.error('Error updating active status:', error);
      toast.error('Failed to update active status');
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update(newSettings)
        .eq('id', settings?.id);

      if (error) throw error;

      toast.success('Settings updated successfully');
      fetchData();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  return (
    <div className="mt-8">
      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'talent', label: 'Manage Talent', icon: UsersIcon },
              { key: 'settings', label: 'Platform Settings', icon: Cog6ToothIcon },
              { key: 'helpdesk', label: 'Help Desk', icon: ChatBubbleLeftRightIcon },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Talent Management Tab */}
      {activeTab === 'talent' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Talent Management</h2>
            <p className="text-sm text-gray-600">Manage talent profiles, featured status, and settings</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {talent.map((talentProfile) => (
                <div key={talentProfile.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        {talentProfile.users.avatar_url ? (
                          <img
                            src={talentProfile.users.avatar_url}
                            alt={talentProfile.users.full_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-primary-600 font-medium">
                            {talentProfile.users.full_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{talentProfile.users.full_name}</h3>
                        <p className="text-sm text-gray-600">
                          {talentProfile.category} • ${talentProfile.pricing} • {talentProfile.total_orders} orders
                        </p>
                        <p className="text-xs text-gray-500">{talentProfile.users.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Featured Toggle */}
                      <button
                        onClick={() => handleToggleFeatured(talentProfile.id, talentProfile.is_featured)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          talentProfile.is_featured
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800'
                        }`}
                      >
                        {talentProfile.is_featured ? '⭐ Featured' : 'Feature'}
                      </button>

                      {/* Active Toggle */}
                      <button
                        onClick={() => handleToggleActive(talentProfile.id, talentProfile.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          talentProfile.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {talentProfile.is_active ? 'Active' : 'Inactive'}
                      </button>

                      {/* Edit Button */}
                      <button 
                        onClick={() => setEditingTalent(talentProfile)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="Edit Profile"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Fulfillment:</span> {talentProfile.fulfillment_time_hours}h
                    </div>
                    <div>
                      <span className="font-medium">Rating:</span> {talentProfile.average_rating.toFixed(1)} ⭐
                    </div>
                    <div>
                      <span className="font-medium">Charity:</span> {talentProfile.charity_percentage || 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Platform Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Platform Settings</h2>
            <p className="text-sm text-gray-600">Configure global platform settings and policies</p>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Global Admin Fee (%)
                  </label>
                  <input
                    type="number"
                    value={settings.global_admin_fee_percentage}
                    onChange={(e) => setSettings({...settings, global_admin_fee_percentage: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Featured Talent Limit
                  </label>
                  <input
                    type="number"
                    value={settings.featured_talent_limit}
                    onChange={(e) => setSettings({...settings, featured_talent_limit: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Fulfillment Hours
                  </label>
                  <input
                    type="number"
                    value={settings.max_fulfillment_hours}
                    onChange={(e) => setSettings({...settings, max_fulfillment_hours: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Policy Text
                </label>
                <textarea
                  rows={3}
                  value={settings.refund_policy_text}
                  onChange={(e) => setSettings({...settings, refund_policy_text: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-6">
                <button
                  onClick={() => handleUpdateSettings(settings)}
                  className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700"
                >
                  Update Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Desk Tab */}
      {activeTab === 'helpdesk' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Help Desk</h2>
            <p className="text-sm text-gray-600">Manage customer support and help requests</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {helpMessages.map((message) => (
                <div key={message.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Support Request</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(message.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        message.is_resolved 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {message.is_resolved ? 'Resolved' : 'Open'}
                      </span>
                      {message.is_human_takeover && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Human Takeover
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md mb-3">
                    <p className="text-gray-700">{message.message}</p>
                  </div>

                  {message.response && (
                    <div className="bg-blue-50 p-3 rounded-md mb-3">
                      <p className="text-blue-900 font-medium">Response:</p>
                      <p className="text-blue-800">{message.response}</p>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {!message.is_resolved && (
                      <>
                        <button className="bg-primary-600 text-white px-3 py-1 rounded-md text-sm hover:bg-primary-700">
                          Respond
                        </button>
                        <button className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700">
                          Mark Resolved
                        </button>
                        <button className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700">
                          Human Takeover
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {helpMessages.length === 0 && (
                <div className="text-center py-12">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No help requests</h3>
                  <p className="text-gray-600">Customer support requests will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Talent Profile Editor Modal */}
      {editingTalent && (
        <TalentProfileEditor
          talent={editingTalent}
          onClose={() => setEditingTalent(null)}
          onSave={() => {
            fetchData(); // Refresh the talent list
            setEditingTalent(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminManagementTabs;
