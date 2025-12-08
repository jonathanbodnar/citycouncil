import React, { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon, 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BellIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  PhotoIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import SMSManagement from './admin/SMSManagement';

// SMS segment limits
const SMS_SEGMENT_LIMIT = 160; // Standard SMS limit
const SMS_CONCAT_LIMIT = 153; // When concatenated, each segment is 153 chars (7 chars for header)
const MAX_CHAR_LIMIT = 1600; // Allow up to ~10 segments

interface TalentWithPhone {
  id: string;
  full_name: string;
  temp_full_name: string;
  username: string;
  temp_avatar_url?: string;
  user_id: string;
  users: {
    phone: string;
    full_name: string;
    avatar_url?: string;
  };
  unreadCount?: number;
}

interface Message {
  id: string;
  talent_id: string;
  from_admin: boolean;
  message: string;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed';
  media_url?: string;
}

interface SystemNotification {
  id: string;
  created_at: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  users: {
    full_name: string;
    email: string;
    user_type: string;
  };
}

const CommsCenterManagement: React.FC = () => {
  const [activeView, setActiveView] = useState<'talent-sms' | 'user-sms' | 'notifications'>('talent-sms');
  const [talents, setTalents] = useState<TalentWithPhone[]>([]);
  const [filteredTalents, setFilteredTalents] = useState<TalentWithPhone[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<TalentWithPhone | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [massMessageText, setMassMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMassMessage, setShowMassMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'coming_soon' | 'other'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [notificationSearch, setNotificationSearch] = useState('');
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>('all');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeView === 'talent-sms') {
      fetchTalentsWithPhone();
      // Poll for unread counts every 5 seconds
      const interval = setInterval(() => fetchUnreadCounts(), 5000);
      return () => clearInterval(interval);
    } else if (activeView === 'notifications') {
      fetchNotifications();
    }
    // user-sms view handled by SMSManagement component
  }, [activeView]);

  useEffect(() => {
    if (selectedTalent) {
      fetchMessages(selectedTalent.id);
      markMessagesAsRead(selectedTalent.id);
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => {
        fetchMessages(selectedTalent.id);
        fetchUnreadCounts();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTalent]);

  const fetchTalentsWithPhone = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching talents with phone numbers...');
      
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          full_name,
          temp_full_name,
          username,
          temp_avatar_url,
          user_id,
          is_active,
          is_coming_soon,
          users!inner (
            phone,
            full_name,
            avatar_url
          )
        `)
        .not('users.phone', 'is', null)
        .neq('users.phone', '')  // Also exclude empty strings
        .order('temp_full_name', { ascending: true });

      if (error) {
        console.error('❌ Query error:', error);
        throw error;
      }
      
      console.log(`✅ Found ${data?.length || 0} talents with phone numbers`);
      console.log('📱 Talent phone numbers:', data?.map(t => ({
        name: (t as any).temp_full_name,
        phone: (t as any).users?.phone
      })));
      
      // Type assertion to fix PostgREST foreign key type inference
      // TypeScript doesn't correctly infer one-to-one foreign key relations
      const typedData = (data || []) as unknown as TalentWithPhone[];
      setTalents(typedData);
      setFilteredTalents(typedData); // Initially show all
      
      if (typedData.length === 0) {
        console.warn('⚠️  No talents with phone numbers found. Make sure:');
        console.warn('   1. Phone numbers are saved to users.phone column');
        console.warn('   2. Phone is not null or empty string');
        console.warn('   3. Foreign key relationship users!inner is working');
      }

      // Fetch unread counts after loading talents
      fetchUnreadCounts();
    } catch (error) {
      console.error('Error fetching talents:', error);
      toast.error('Failed to load talents');
    } finally {
      setLoading(false);
    }
  };

  // Filter talents based on status and unread messages
  useEffect(() => {
    let filtered = talents;

    // Apply status filter
    if (statusFilter === 'live') {
      filtered = filtered.filter(t => (t as any).is_active === true && !(t as any).is_coming_soon);
    } else if (statusFilter === 'coming_soon') {
      filtered = filtered.filter(t => (t as any).is_coming_soon === true);
    } else if (statusFilter === 'other') {
      filtered = filtered.filter(t => (t as any).is_active === false && !(t as any).is_coming_soon);
    }

    // Apply unread filter
    if (showUnreadOnly) {
      filtered = filtered.filter(t => (t.unreadCount || 0) > 0);
    }

    setFilteredTalents(filtered);
  }, [statusFilter, talents, showUnreadOnly]);

  const fetchMessages = async (talentId: string) => {
    try {
      const { data, error } = await supabase
        .from('sms_messages')
        .select('*')
        .eq('talent_id', talentId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      // Get unread message counts for each talent
      const { data, error } = await supabase
        .from('sms_messages')
        .select('talent_id')
        .eq('from_admin', false)
        .eq('read_by_admin', false);

      if (error) throw error;

      // Count unread messages per talent
      const unreadCounts: Record<string, number> = {};
      data?.forEach((msg: any) => {
        unreadCounts[msg.talent_id] = (unreadCounts[msg.talent_id] || 0) + 1;
      });

      // Update talents with unread counts
      setTalents(prevTalents => 
        prevTalents.map(talent => ({
          ...talent,
          unreadCount: unreadCounts[talent.id] || 0
        }))
      );

      setFilteredTalents(prevFiltered =>
        prevFiltered.map(talent => ({
          ...talent,
          unreadCount: unreadCounts[talent.id] || 0
        }))
      );
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const markMessagesAsRead = async (talentId: string) => {
    try {
      await supabase
        .from('sms_messages')
        .update({ read_by_admin: true })
        .eq('talent_id', talentId)
        .eq('from_admin', false)
        .eq('read_by_admin', false);

      // Update local state
      fetchUnreadCounts();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Calculate SMS segments
  const calculateSegments = (text: string): { segments: number; breakdown: string[] } => {
    if (!text || text.length === 0) return { segments: 0, breakdown: [] };
    
    if (text.length <= SMS_SEGMENT_LIMIT) {
      return { segments: 1, breakdown: [text] };
    }
    
    // For longer messages, each segment is 153 chars (7 chars reserved for concatenation header)
    const segments: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= SMS_CONCAT_LIMIT) {
        segments.push(remaining);
        break;
      }
      segments.push(remaining.substring(0, SMS_CONCAT_LIMIT));
      remaining = remaining.substring(SMS_CONCAT_LIMIT);
    }
    
    return { segments: segments.length, breakdown: segments };
  };

  // Handle media file selection
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file');
      return;
    }

    // Check file size (10MB limit for MMS)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  // Upload media to Supabase storage
  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      setUploadingMedia(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `sms-media/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('platform-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('platform-assets')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Failed to upload media');
      return null;
    } finally {
      setUploadingMedia(false);
    }
  };

  // Clear media selection
  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      // First, get all talent user IDs
      const { data: talentUsers, error: talentError } = await supabase
        .from('users')
        .select('id')
        .eq('user_type', 'talent');

      if (talentError) throw talentError;

      const talentUserIds = talentUsers?.map(u => u.id) || [];

      if (talentUserIds.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Then fetch notifications for those users
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          created_at,
          user_id,
          type,
          title,
          message,
          is_read,
          users!notifications_user_id_fkey (
            full_name,
            email,
            user_type
          )
        `)
        .in('user_id', talentUserIds)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setNotifications(data as unknown as SystemNotification[] || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !mediaFile) || !selectedTalent) return;

    setSending(true);
    try {
      let mediaUrl: string | null = null;

      // Upload media if present
      if (mediaFile) {
        mediaUrl = await uploadMedia(mediaFile);
        if (!mediaUrl && !messageText.trim()) {
          // If media upload failed and no text, abort
          setSending(false);
          return;
        }
      }

      // Call Twilio Edge Function to send SMS/MMS
      // The Edge Function handles database logging
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: selectedTalent.users.phone,
          message: messageText || (mediaUrl ? '📎 Media message' : ''),
          talentId: selectedTalent.id,
          mediaUrl: mediaUrl
        }
      });

      if (error) throw error;

      toast.success(mediaUrl ? 'MMS sent!' : 'Message sent!');
      setMessageText('');
      clearMedia();
      fetchMessages(selectedTalent.id);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const sendMassMessage = async () => {
    if (!massMessageText.trim()) return;

    const confirm = window.confirm(
      `Send this message to ${talents.length} talent(s)?\n\n"${massMessageText}"`
    );
    if (!confirm) return;

    setSending(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const talent of filteredTalents) {
        try {
          // Call Twilio Edge Function - it handles database logging
          const { error } = await supabase.functions.invoke('send-sms', {
            body: {
              to: talent.users.phone,
              message: massMessageText,
              talentId: talent.id
            }
          });

          if (error) throw error;

          successCount++;
        } catch (error) {
          console.error(`Failed to send to ${talent.temp_full_name || talent.full_name}:`, error);
          failCount++;
        }
      }

      toast.success(`Sent to ${successCount} talent(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setMassMessageText('');
      setShowMassMessage(false);
    } catch (error: any) {
      console.error('Error sending mass message:', error);
      toast.error('Failed to send mass message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Filter notifications based on search and type
  const filteredNotifications = notifications.filter(notif => {
    const matchesSearch = 
      notif.users.full_name.toLowerCase().includes(notificationSearch.toLowerCase()) ||
      notif.users.email.toLowerCase().includes(notificationSearch.toLowerCase()) ||
      notif.title.toLowerCase().includes(notificationSearch.toLowerCase()) ||
      notif.message.toLowerCase().includes(notificationSearch.toLowerCase());
    
    const matchesType = notificationTypeFilter === 'all' || notif.type === notificationTypeFilter;
    
    return matchesSearch && matchesType;
  });

  // Get unique notification types for filter
  const notificationTypes = ['all', ...Array.from(new Set(notifications.map(n => n.type)))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Communications Center</h2>
            <p className="text-gray-600">
              {activeView === 'talent-sms' && 'Send SMS messages to talent'}
              {activeView === 'user-sms' && 'Send mass SMS campaigns to users'}
              {activeView === 'notifications' && 'View system notifications sent to talent'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                toast.loading('Refreshing talent list...');
                fetchTalentsWithPhone().then(() => {
                  toast.dismiss();
                  toast.success('Talent list refreshed!');
                });
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh talent list"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh
            </button>
            <button
              onClick={() => setShowMassMessage(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={filteredTalents.length === 0}
            >
              <UserGroupIcon className="h-5 w-5" />
              Mass Text ({filteredTalents.length})
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
          <button
            onClick={() => setActiveView('talent-sms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'talent-sms'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
            Talent SMS
          </button>
          <button
            onClick={() => setActiveView('user-sms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'user-sms'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PhoneIcon className="h-5 w-5" />
            User SMS
          </button>
          <button
            onClick={() => setActiveView('notifications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'notifications'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BellIcon className="h-5 w-5" />
            System Notifications
          </button>
        </div>

        {/* Status Filter Tabs (only for Talent SMS view) */}
        {activeView === 'talent-sms' && (
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              statusFilter === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({talents.length})
          </button>
          <button
            onClick={() => setStatusFilter('live')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              statusFilter === 'live'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Live on /home ({talents.filter(t => (t as any).is_active === true && !(t as any).is_coming_soon).length})
          </button>
          <button
            onClick={() => setStatusFilter('coming_soon')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              statusFilter === 'coming_soon'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Coming Soon ({talents.filter(t => (t as any).is_coming_soon === true).length})
          </button>
          <button
            onClick={() => setStatusFilter('other')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              statusFilter === 'other'
                ? 'border-gray-600 text-gray-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Other ({talents.filter(t => (t as any).is_active === false && !(t as any).is_coming_soon).length})
          </button>
        </div>
        )}
      </div>

      {/* User SMS View */}
      {activeView === 'user-sms' && (
        <SMSManagement />
      )}

      {/* Mass Message Modal */}
      {activeView === 'talent-sms' && showMassMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Send Mass Text</h3>
              <button
                onClick={() => setShowMassMessage(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will send a text message to {filteredTalents.length} talent(s) 
              {statusFilter !== 'all' && <span className="font-medium"> ({statusFilter === 'live' ? 'Live on /home' : statusFilter === 'coming_soon' ? 'Coming Soon' : 'Other'})</span>}.
            </p>
            <textarea
              value={massMessageText}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHAR_LIMIT) {
                  setMassMessageText(e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
              rows={4}
              placeholder="Type your announcement here..."
            />
            <div className="mb-4 space-y-1">
              <div className={`text-xs ${massMessageText.length > SMS_SEGMENT_LIMIT ? 'text-amber-600 font-medium' : 'text-gray-500'} text-right`}>
                {massMessageText.length}/{MAX_CHAR_LIMIT} characters
                {massMessageText.length > 0 && (
                  <span className="ml-2">
                    ({calculateSegments(massMessageText).segments} SMS segment{calculateSegments(massMessageText).segments !== 1 ? 's' : ''})
                  </span>
                )}
              </div>

              {/* Segment breakdown visualization for mass message */}
              {massMessageText.length > SMS_SEGMENT_LIMIT && (
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1 font-medium">Message will be split into {calculateSegments(massMessageText).segments} segments:</div>
                  <div className="space-y-1">
                    {calculateSegments(massMessageText).breakdown.map((segment, index) => (
                      <div key={index} className="text-xs">
                        <span className="inline-block bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-2 font-medium">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 break-all">
                          {segment}
                          {index < calculateSegments(massMessageText).breakdown.length - 1 && (
                            <span className="text-red-400 font-bold"> |</span>
                          )}
                        </span>
                        <span className="text-gray-400 ml-1">({segment.length} chars)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMassMessage(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendMassMessage}
                disabled={!massMessageText.trim() || sending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : `Send to ${filteredTalents.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Talent SMS View */}
      {activeView === 'talent-sms' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Talent List */}
        <div className="md:col-span-1 glass rounded-2xl shadow-modern border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Talent ({filteredTalents.length})</h3>
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showUnreadOnly
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${showUnreadOnly ? 'bg-white' : 'bg-red-500'}`}></div>
              Unread
            </button>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredTalents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">
                  {showUnreadOnly ? 'No unread messages' : 'No talents found'}
                </p>
              </div>
            ) : (
              filteredTalents.map((talent) => (
              <button
                key={talent.id}
                onClick={() => setSelectedTalent(talent)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all relative ${
                  selectedTalent?.id === talent.id
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50'
                    : 'hover:bg-gray-100 hover:shadow-md'
                }`}
              >
                {/* Red dot for unread messages */}
                {talent.unreadCount && talent.unreadCount > 0 && selectedTalent?.id !== talent.id && (
                  <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>
                )}
                
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 relative">
                  {(talent.temp_avatar_url || talent.users.avatar_url) ? (
                    <img
                      src={talent.temp_avatar_url || talent.users.avatar_url}
                      alt={talent.temp_full_name || talent.full_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className={`font-medium ${
                      selectedTalent?.id === talent.id ? 'text-white' : 'text-blue-600'
                    }`}>
                      {(talent.temp_full_name || talent.full_name).charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-medium flex items-center gap-2 ${
                    selectedTalent?.id === talent.id ? 'text-white' : 'text-gray-900'
                  }`}>
                    {talent.temp_full_name || talent.full_name}
                    {(talent.unreadCount || 0) > 0 && selectedTalent?.id !== talent.id && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                        {talent.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs ${
                    selectedTalent?.id === talent.id ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    @{talent.username}
                  </div>
                </div>
              </button>
            )))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="md:col-span-2 glass rounded-2xl shadow-modern border border-gray-200 flex flex-col h-[600px]">
          {selectedTalent ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    {(selectedTalent.temp_avatar_url || selectedTalent.users.avatar_url) ? (
                      <img
                        src={selectedTalent.temp_avatar_url || selectedTalent.users.avatar_url}
                        alt={selectedTalent.temp_full_name || selectedTalent.full_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-blue-600 font-medium text-lg">
                        {(selectedTalent.temp_full_name || selectedTalent.full_name).charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {selectedTalent.temp_full_name || selectedTalent.full_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedTalent.users.phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from_admin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          msg.from_admin
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        {/* Media attachment */}
                        {msg.media_url && (
                          <div className="mb-2">
                            {msg.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img 
                                src={msg.media_url} 
                                alt="Media attachment" 
                                className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                                onClick={() => window.open(msg.media_url, '_blank')}
                              />
                            ) : msg.media_url.match(/\.(mp4|mov|webm)$/i) ? (
                              <video 
                                src={msg.media_url} 
                                controls 
                                className="max-w-full rounded-lg"
                              />
                            ) : (
                              <a 
                                href={msg.media_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 underline ${msg.from_admin ? 'text-blue-100' : 'text-blue-600'}`}
                              >
                                <PhotoIcon className="h-4 w-4" />
                                View attachment
                              </a>
                            )}
                          </div>
                        )}
                        {msg.message && msg.message !== '📎 Media message' && (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        )}
                        <div className={`text-xs mt-1 ${msg.from_admin ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(msg.sent_at).toLocaleTimeString()}
                          {msg.from_admin && (
                            <>
                              {' • '}
                              {msg.status === 'sent' && 'Sent'}
                              {msg.status === 'delivered' && <CheckCircleIcon className="h-3 w-3 inline" />}
                              {msg.status === 'failed' && 'Failed'}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                {/* Media Preview */}
                {mediaPreview && (
                  <div className="mb-3 relative inline-block">
                    {mediaFile?.type.startsWith('image/') ? (
                      <img src={mediaPreview} alt="Preview" className="max-h-32 rounded-lg" />
                    ) : (
                      <video src={mediaPreview} className="max-h-32 rounded-lg" />
                    )}
                    <button
                      onClick={clearMedia}
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
                    ref={fileInputRef}
                    onChange={handleMediaSelect}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  
                  {/* Media button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Attach image or video"
                  >
                    <PhotoIcon className="h-5 w-5 text-gray-600" />
                  </button>

                  <textarea
                    value={messageText}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_CHAR_LIMIT) {
                        setMessageText(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="Type a message... (Shift+Enter for new line)"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={(!messageText.trim() && !mediaFile) || sending || uploadingMedia}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                    {uploadingMedia ? 'Uploading...' : sending ? 'Sending...' : 'Send'}
                  </button>
                </div>

                {/* Character count and segment indicator */}
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`${messageText.length > SMS_SEGMENT_LIMIT ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                      {messageText.length}/{MAX_CHAR_LIMIT} characters
                      {messageText.length > 0 && (
                        <span className="ml-2">
                          ({calculateSegments(messageText).segments} SMS segment{calculateSegments(messageText).segments !== 1 ? 's' : ''})
                        </span>
                      )}
                    </span>
                    {mediaFile && (
                      <span className="text-blue-600 font-medium">
                        📎 {mediaFile.name.length > 20 ? mediaFile.name.substring(0, 20) + '...' : mediaFile.name}
                      </span>
                    )}
                  </div>

                  {/* Segment breakdown visualization */}
                  {messageText.length > SMS_SEGMENT_LIMIT && (
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <div className="text-xs text-gray-600 mb-1 font-medium">Message will be split into {calculateSegments(messageText).segments} segments:</div>
                      <div className="space-y-1">
                        {calculateSegments(messageText).breakdown.map((segment, index) => (
                          <div key={index} className="text-xs">
                            <span className="inline-block bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mr-2 font-medium">
                              {index + 1}
                            </span>
                            <span className="text-gray-700 break-all">
                              {segment}
                              {index < calculateSegments(messageText).breakdown.length - 1 && (
                                <span className="text-red-400 font-bold"> |</span>
                              )}
                            </span>
                            <span className="text-gray-400 ml-1">({segment.length} chars)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p>Select a talent to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Main Content - Notifications View */}
      {activeView === 'notifications' && (
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={notificationSearch}
                onChange={(e) => setNotificationSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={notificationTypeFilter}
              onChange={(e) => setNotificationTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {notificationTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            <button
              onClick={fetchNotifications}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh notifications"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh
            </button>
          </div>

          {/* Notifications Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass rounded-lg p-4">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-bold text-gray-900">{notifications.length}</div>
            </div>
            <div className="glass rounded-lg p-4">
              <div className="text-sm text-gray-600">Unread</div>
              <div className="text-2xl font-bold text-blue-600">
                {notifications.filter(n => !n.is_read).length}
              </div>
            </div>
            <div className="glass rounded-lg p-4">
              <div className="text-sm text-gray-600">Read</div>
              <div className="text-2xl font-bold text-green-600">
                {notifications.filter(n => n.is_read).length}
              </div>
            </div>
            <div className="glass rounded-lg p-4">
              <div className="text-sm text-gray-600">Types</div>
              <div className="text-2xl font-bold text-purple-600">
                {new Set(notifications.map(n => n.type)).size}
              </div>
            </div>
          </div>

          {/* Notifications Table */}
          <div className="glass rounded-2xl shadow-modern border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Talent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <BellIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No notifications found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map((notif) => (
                      <tr key={notif.id} className={!notif.is_read ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(notif.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{notif.users.full_name}</div>
                          <div className="text-sm text-gray-500">{notif.users.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            {notif.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {notif.title}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                          {notif.message}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {notif.is_read ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              Read
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              <BellIcon className="h-4 w-4 mr-1" />
                              Unread
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="text-sm text-gray-600 text-center">
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </div>
        </div>
      )}
    </div>
  );
};

export default CommsCenterManagement;

