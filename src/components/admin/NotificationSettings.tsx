import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { BellIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

interface NotificationSetting {
  id: string;
  notification_type: string;
  display_name: string;
  description: string;
  sms_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_template: string;
  created_at: string;
  updated_at: string;
}

const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateValue, setTemplateValue] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleSMS = async (settingId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ sms_enabled: !currentValue })
        .eq('id', settingId);

      if (error) throw error;

      setSettings(settings.map(s => 
        s.id === settingId ? { ...s, sms_enabled: !currentValue } : s
      ));

      toast.success(`SMS notification ${!currentValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling SMS:', error);
      toast.error('Failed to update setting');
    }
  };

  const saveTemplate = async (settingId: string) => {
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ sms_template: templateValue })
        .eq('id', settingId);

      if (error) throw error;

      setSettings(settings.map(s => 
        s.id === settingId ? { ...s, sms_template: templateValue } : s
      ));

      setEditingTemplate(null);
      toast.success('Template updated');
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const startEditingTemplate = (setting: NotificationSetting) => {
    setEditingTemplate(setting.id);
    setTemplateValue(setting.sms_template || '');
  };

  const cancelEditingTemplate = () => {
    setEditingTemplate(null);
    setTemplateValue('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6 shadow-modern">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <BellIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notification Settings</h2>
            <p className="text-gray-600">Manage SMS, email, and in-app notification flows</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Template Variables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div><code className="bg-blue-100 px-2 py-1 rounded">{'{{first_name}}'}</code> - User's first name</div>
            <div><code className="bg-blue-100 px-2 py-1 rounded">{'{{talent_name}}'}</code> - Talent's full name</div>
            <div><code className="bg-blue-100 px-2 py-1 rounded">{'{{order_link}}'}</code> - Direct link to order</div>
            <div><code className="bg-blue-100 px-2 py-1 rounded">{'{{hours}}'}</code> - Hours remaining</div>
            <div><code className="bg-blue-100 px-2 py-1 rounded">{'{{amount}}'}</code> - Order amount</div>
          </div>
        </div>
      </div>

      {/* Notification Settings List */}
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="glass rounded-2xl shadow-modern overflow-hidden">
            {/* Setting Header */}
            <div className="p-6 border-b border-white/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {setting.display_name}
                    </h3>
                    {setting.sms_enabled && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <DevicePhoneMobileIcon className="h-3 w-3" />
                        SMS Active
                      </span>
                    )}
                  </div>
                  {setting.description && (
                    <p className="text-sm text-gray-600">{setting.description}</p>
                  )}
                </div>

                {/* SMS Toggle */}
                <button
                  onClick={() => toggleSMS(setting.id, setting.sms_enabled)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    setting.sms_enabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      setting.sms_enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* SMS Template */}
            <div className="p-6 bg-gray-50/50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Template
              </label>
              {editingTemplate === setting.id ? (
                <div className="space-y-3">
                  <textarea
                    value={templateValue}
                    onChange={(e) => setTemplateValue(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter SMS template..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveTemplate(setting.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Save Template
                    </button>
                    <button
                      onClick={cancelEditingTemplate}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-gray-900 whitespace-pre-wrap font-mono text-sm">
                      {setting.sms_template || 'No template set'}
                    </p>
                  </div>
                  <button
                    onClick={() => startEditingTemplate(setting)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit Template
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSettings;

