import React, { useState, useEffect } from 'react';
import { 
  UsersIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { HelpMessage } from '../types';
import TalentManagement from './TalentManagement';
import PlatformSettings from './PlatformSettings';
import toast from 'react-hot-toast';

const AdminManagementTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'talent' | 'settings' | 'helpdesk'>('talent');
  const [helpMessages, setHelpMessages] = useState<HelpMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'helpdesk') {
        const { data, error } = await supabase
          .from('help_messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setHelpMessages(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
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
        <TalentManagement />
      )}

      {/* Platform Settings Tab */}
      {activeTab === 'settings' && (
        <PlatformSettings />
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

    </div>
  );
};

export default AdminManagementTabs;
