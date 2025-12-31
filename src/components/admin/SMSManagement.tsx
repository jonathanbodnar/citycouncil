import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { PhoneIcon, UserGroupIcon, CheckCircleIcon, XCircleIcon, ClockIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface SMSStats {
  total_campaigns: number;
  total_sent: number;
  total_failed: number;
  beta_subscribers: number;
  registered_subscribers: number;
  total_subscribers: number;
  holiday_popup_subscribers: number;
}

interface SMSCampaign {
  id: string;
  created_at: string;
  campaign_name: string;
  message: string;
  target_audience: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
}

interface User {
  id: string;
  full_name: string;
  phone_number: string;
  email: string;
  user_tags: string[];
}

const SMSManagement: React.FC = () => {
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'beta' | 'registered' | 'all' | 'talent' | 'holiday_popup'>('beta');
  const [recipientCount, setRecipientCount] = useState(0);
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(new Set());
  
  // Direct SMS state
  const [directPhone, setDirectPhone] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);
  
  // Media state for direct SMS
  const [directMediaFile, setDirectMediaFile] = useState<File | null>(null);
  const [directMediaPreview, setDirectMediaPreview] = useState<string | null>(null);
  const [uploadingDirectMedia, setUploadingDirectMedia] = useState(false);
  const directFileInputRef = useRef<HTMLInputElement>(null);
  
  // Media state for mass SMS
  const [massMediaFile, setMassMediaFile] = useState<File | null>(null);
  const [massMediaPreview, setMassMediaPreview] = useState<string | null>(null);
  const [uploadingMassMedia, setUploadingMassMedia] = useState(false);
  const massFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStats();
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (targetAudience) {
      fetchRecipients();
      // Reset exclusions when audience changes
      setExcludedUserIds(new Set());
    }
  }, [targetAudience]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_sms_stats');
      if (error) throw error;
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching SMS stats:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const { data, error } = await supabase.rpc('get_users_by_segment', {
        segment: targetAudience
      });

      if (error) throw error;
      setUsers(data || []);
      setRecipientCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      setUsers([]);
      setRecipientCount(0);
    }
  };

  const toggleExcludeUser = (userId: string) => {
    setExcludedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const excludeAllUsers = () => {
    setExcludedUserIds(new Set(users.map(u => u.id)));
  };

  const includeAllUsers = () => {
    setExcludedUserIds(new Set());
  };

  // Calculate active recipient count (total - excluded)
  const activeRecipientCount = users.length - excludedUserIds.size;

  const sendCampaign = async () => {
    if (!campaignName.trim() || (!message.trim() && !massMediaFile)) {
      toast.error('Please fill in campaign name and message or attach media');
      return;
    }

    if (message.length > 160 && !massMediaFile) {
      toast.error('Message must be 160 characters or less (or attach media for MMS)');
      return;
    }

    if (activeRecipientCount === 0) {
      toast.error('No recipients selected (all excluded or no users found)');
      return;
    }

    const confirm = window.confirm(
      `Send "${campaignName}" to ${activeRecipientCount} ${targetAudience} users?\n\n` +
      `${excludedUserIds.size > 0 ? `(${excludedUserIds.size} users excluded)\n\n` : ''}` +
      `Message: ${message}\n` +
      `${massMediaFile ? `\n📎 Attached: ${massMediaFile.name}\n` : ''}` +
      `\nThis action cannot be undone.`
    );

    if (!confirm) return;

    setSending(true);

    try {
      let mediaUrl: string | null = null;

      // Upload media if present
      if (massMediaFile) {
        setUploadingMassMedia(true);
        mediaUrl = await uploadMedia(massMediaFile);
        setUploadingMassMedia(false);
        if (!mediaUrl && !message.trim()) {
          setSending(false);
          return;
        }
      }

      // Call Edge Function to send mass SMS
      const { data, error } = await supabase.functions.invoke('send-mass-sms', {
        body: {
          campaign_name: campaignName,
          message: message || (mediaUrl ? '📎 Media message' : ''),
          target_audience: targetAudience,
          excluded_user_ids: Array.from(excludedUserIds),
          media_url: mediaUrl
        }
      });

      if (error) throw error;

      toast.success(`Campaign "${campaignName}" sent to ${data.sent_count} users!`);
      
      // Reset form
      setCampaignName('');
      setMessage('');
      setTargetAudience('beta');
      setRecipientCount(0);
      setExcludedUserIds(new Set());
      setShowPreview(false);
      clearMassMedia();
      
      // Refresh data
      await fetchStats();
      await fetchCampaigns();
    } catch (error: any) {
      console.error('Error sending campaign:', error);
      toast.error('Failed to send campaign: ' + (error.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'sending': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="h-5 w-5" />;
      case 'sending': return <ClockIcon className="h-5 w-5" />;
      case 'failed': return <XCircleIcon className="h-5 w-5" />;
      default: return null;
    }
  };

  const getAudienceLabel = (audience: string) => {
    switch (audience) {
      case 'beta': return 'Beta Users';
      case 'registered': return 'Registered Users';
      case 'all': return 'All Phone Numbers';
      case 'talent': return 'Talent';
      case 'holiday_popup': return 'Holiday Promo';
      default: return audience;
    }
  };

  // Handle media file selection for direct SMS
  const handleDirectMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setDirectMediaFile(file);
    setDirectMediaPreview(URL.createObjectURL(file));
  };

  // Handle media file selection for mass SMS
  const handleMassMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setMassMediaFile(file);
    setMassMediaPreview(URL.createObjectURL(file));
  };

  // Upload media to Supabase storage
  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `sms-media/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('platform-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('platform-assets')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Failed to upload media');
      return null;
    }
  };

  // Clear direct media selection
  const clearDirectMedia = () => {
    setDirectMediaFile(null);
    setDirectMediaPreview(null);
    if (directFileInputRef.current) {
      directFileInputRef.current.value = '';
    }
  };

  // Clear mass media selection
  const clearMassMedia = () => {
    setMassMediaFile(null);
    setMassMediaPreview(null);
    if (massFileInputRef.current) {
      massFileInputRef.current.value = '';
    }
  };

  // Send direct SMS to a specific phone number
  const sendDirectSMS = async () => {
    if (!directPhone.trim() || (!directMessage.trim() && !directMediaFile)) {
      toast.error('Please enter a phone number and message or attach media');
      return;
    }

    // Clean phone number
    let cleanedPhone = directPhone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) {
      cleanedPhone = '1' + cleanedPhone;
    }
    if (!cleanedPhone.startsWith('+')) {
      cleanedPhone = '+' + cleanedPhone;
    }

    setSendingDirect(true);
    try {
      let mediaUrl: string | null = null;

      // Upload media if present
      if (directMediaFile) {
        setUploadingDirectMedia(true);
        mediaUrl = await uploadMedia(directMediaFile);
        setUploadingDirectMedia(false);
        if (!mediaUrl && !directMessage.trim()) {
          setSendingDirect(false);
          return;
        }
      }

      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: cleanedPhone,
          message: directMessage || (mediaUrl ? '📎 Media message' : ''),
          recipientType: 'user', // Use user number (659) for admin direct messages
          mediaUrl: mediaUrl
        }
      });

      if (error) throw error;

      toast.success(mediaUrl ? `MMS sent to ${directPhone}` : `SMS sent to ${directPhone}`);
      setDirectPhone('');
      setDirectMessage('');
      clearDirectMedia();
    } catch (error: any) {
      console.error('Error sending direct SMS:', error);
      toast.error('Failed to send SMS: ' + (error.message || 'Unknown error'));
    } finally {
      setSendingDirect(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Direct SMS */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">📱 Send Direct SMS/MMS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={directPhone}
              onChange={(e) => setDirectPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message ({directMessage.length}/160) {directMediaFile && <span className="text-blue-600">+ Media attached</span>}
            </label>
            
            {/* Media Preview */}
            {directMediaPreview && (
              <div className="mb-3 relative inline-block">
                {directMediaFile?.type.startsWith('image/') ? (
                  <img src={directMediaPreview} alt="Preview" className="max-h-24 rounded-lg" />
                ) : (
                  <video src={directMediaPreview} className="max-h-24 rounded-lg" />
                )}
                <button
                  onClick={clearDirectMedia}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <div className="flex gap-2">
              {/* Hidden file input */}
              <input
                type="file"
                ref={directFileInputRef}
                onChange={handleDirectMediaSelect}
                accept="image/*,video/*"
                className="hidden"
              />
              
              {/* Media button */}
              <button
                onClick={() => directFileInputRef.current?.click()}
                disabled={uploadingDirectMedia}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Attach image or video"
              >
                <PhotoIcon className="h-5 w-5 text-gray-600" />
              </button>
              
              <input
                type="text"
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                placeholder="Enter your message..."
                maxLength={directMediaFile ? 1600 : 160}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={sendDirectSMS}
                disabled={sendingDirect || uploadingDirectMedia || !directPhone.trim() || (!directMessage.trim() && !directMediaFile)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploadingDirectMedia ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Uploading...
                  </>
                ) : sendingDirect ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <PhoneIcon className="h-4 w-4" />
                    {directMediaFile ? 'Send MMS' : 'Send'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Beta Subscribers</p>
              <p className="text-3xl font-bold text-blue-600">{stats?.beta_subscribers || 0}</p>
              <p className="text-xs text-gray-500 mt-1">From landing page</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">🎄 Holiday Promo</p>
              <p className="text-3xl font-bold text-red-600">{stats?.holiday_popup_subscribers || 0}</p>
              <p className="text-xs text-gray-500 mt-1">From popup</p>
            </div>
            <span className="text-4xl">🎅</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Registered Users</p>
              <p className="text-3xl font-bold text-green-600">{stats?.registered_subscribers || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Active accounts</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total SMS Sent</p>
              <p className="text-3xl font-bold text-purple-600">{stats?.total_sent || 0}</p>
              <p className="text-xs text-gray-500 mt-1">All campaigns</p>
            </div>
            <PhoneIcon className="h-12 w-12 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Send SMS Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Send Mass SMS</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Beta Launch Announcement"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">📱 All Phone Numbers (except talent) - {stats?.total_subscribers || 0}</option>
              <option value="holiday_popup">🎄 Holiday Promo (from popup) - {stats?.holiday_popup_subscribers || 0}</option>
              <option value="beta">Beta Users (from landing page) - {stats?.beta_subscribers || 0}</option>
              <option value="registered">Registered Users (with accounts) - {stats?.registered_subscribers || 0}</option>
              <option value="talent">🎬 Talent Only</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              📱 This will send to <span className="font-semibold text-blue-600">{activeRecipientCount} users</span>
              {excludedUserIds.size > 0 && (
                <span className="text-orange-600 ml-2">({excludedUserIds.size} excluded)</span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message ({message.length}/{massMediaFile ? 1600 : 160}) {massMediaFile && <span className="text-blue-600">+ Media attached (MMS)</span>}
            </label>
            
            {/* Mass Media Preview */}
            {massMediaPreview && (
              <div className="mb-3 relative inline-block">
                {massMediaFile?.type.startsWith('image/') ? (
                  <img src={massMediaPreview} alt="Preview" className="max-h-32 rounded-lg" />
                ) : (
                  <video src={massMediaPreview} className="max-h-32 rounded-lg" />
                )}
                <button
                  onClick={clearMassMedia}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <div className="flex gap-2 mb-2">
              {/* Hidden file input */}
              <input
                type="file"
                ref={massFileInputRef}
                onChange={handleMassMediaSelect}
                accept="image/*,video/*"
                className="hidden"
              />
              
              {/* Media button */}
              <button
                onClick={() => massFileInputRef.current?.click()}
                disabled={uploadingMassMedia}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Attach image or video for MMS"
              >
                <PhotoIcon className="h-5 w-5 text-gray-600" />
                {massMediaFile ? 'Change Media' : 'Add Media'}
              </button>
              {massMediaFile && (
                <span className="text-sm text-gray-600 self-center">
                  📎 {massMediaFile.name.length > 30 ? massMediaFile.name.substring(0, 30) + '...' : massMediaFile.name}
                </span>
              )}
            </div>
            
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your SMS message..."
              maxLength={massMediaFile ? 1600 : 160}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {!massMediaFile && message.length > 140 && (
              <p className="text-sm text-orange-600 mt-1">
                ⚠️ Warning: {160 - message.length} characters remaining
              </p>
            )}
            {massMediaFile && (
              <p className="text-sm text-blue-600 mt-1">
                📱 MMS mode: Up to 1600 characters allowed with media attachment
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              disabled={users.length === 0}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {showPreview ? 'Hide Recipients' : `View Recipients (${users.length})`}
            </button>
            
            <button
              onClick={sendCampaign}
              disabled={sending || uploadingMassMedia || !campaignName || (!message && !massMediaFile) || activeRecipientCount === 0}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {uploadingMassMedia ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Uploading Media...
                </>
              ) : sending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  {massMediaFile ? 'Send MMS' : 'Send SMS'} to {activeRecipientCount} Users
                  <PhoneIcon className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recipients Preview */}
        {showPreview && users.length > 0 && (
          <div className="mt-6 border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Recipients ({activeRecipientCount} of {users.length} selected)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={includeAllUsers}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  Include All
                </button>
                <button
                  onClick={excludeAllUsers}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Exclude All
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {users.map((user) => {
                const isExcluded = excludedUserIds.has(user.id);
                return (
                  <div 
                    key={user.id} 
                    className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                      isExcluded 
                        ? 'bg-red-50 border border-red-200 opacity-60' 
                        : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => toggleExcludeUser(user.id)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className={`font-medium ${isExcluded ? 'line-through text-gray-400' : ''}`}>
                          {user.full_name || 'Unnamed User'}
                        </p>
                        <p className="text-sm text-gray-600">{user.phone_number}</p>
                        {user.email && (
                          <p className="text-xs text-gray-400">{user.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.user_tags && user.user_tags.length > 0 && (
                        <div className="flex gap-1">
                          {user.user_tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => toggleExcludeUser(user.id)}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                          isExcluded
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {isExcluded ? 'Include' : 'Exclude'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Campaign History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Campaign History</h2>
        
        {campaigns.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No campaigns sent yet</p>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{campaign.campaign_name}</h3>
                      <span className={`flex items-center gap-1 text-sm ${getStatusColor(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{campaign.message}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4" />
                        {getAudienceLabel(campaign.target_audience)}
                      </span>
                      <span>Sent: {campaign.sent_count}/{campaign.recipient_count}</span>
                      {campaign.failed_count > 0 && (
                        <span className="text-red-600 font-medium">Failed: {campaign.failed_count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {new Date(campaign.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SMSManagement;

