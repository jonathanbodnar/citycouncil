import React, { useState, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

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
}

interface Message {
  id: string;
  talent_id: string;
  from_admin: boolean;
  message: string;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed';
}

const CommsCenterManagement: React.FC = () => {
  const [talents, setTalents] = useState<TalentWithPhone[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<TalentWithPhone | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [massMessageText, setMassMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMassMessage, setShowMassMessage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTalentsWithPhone();
  }, []);

  useEffect(() => {
    if (selectedTalent) {
      fetchMessages(selectedTalent.id);
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => fetchMessages(selectedTalent.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTalent]);

  const fetchTalentsWithPhone = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          full_name,
          temp_full_name,
          username,
          temp_avatar_url,
          user_id,
          users!inner (
            phone,
            full_name,
            avatar_url
          )
        `)
        .not('users.phone', 'is', null)
        .order('temp_full_name', { ascending: true });

      if (error) throw error;
      
      // Type assertion to fix PostgREST foreign key type inference
      // TypeScript doesn't correctly infer one-to-one foreign key relations
      const typedData = (data || []) as unknown as TalentWithPhone[];
      setTalents(typedData);
    } catch (error) {
      console.error('Error fetching talents:', error);
      toast.error('Failed to load talents');
    } finally {
      setLoading(false);
    }
  };

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

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedTalent) return;

    setSending(true);
    try {
      // Call Twilio Edge Function to send SMS
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: selectedTalent.users.phone,
          message: messageText,
          talentId: selectedTalent.id
        }
      });

      if (error) throw error;

      // Save message to database
      const { error: dbError } = await supabase
        .from('sms_messages')
        .insert({
          talent_id: selectedTalent.id,
          from_admin: true,
          message: messageText,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      toast.success('Message sent!');
      setMessageText('');
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
      for (const talent of talents) {
        try {
          // Call Twilio Edge Function
          const { error } = await supabase.functions.invoke('send-sms', {
            body: {
              to: talent.users.phone,
              message: massMessageText,
              talentId: talent.id
            }
          });

          if (error) throw error;

          // Save to database
          await supabase
            .from('sms_messages')
            .insert({
              talent_id: talent.id,
              from_admin: true,
              message: massMessageText,
              status: 'sent',
              sent_at: new Date().toISOString()
            });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Communications Center</h2>
          <p className="text-gray-600">Send SMS messages to talent</p>
        </div>
        <button
          onClick={() => setShowMassMessage(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserGroupIcon className="h-5 w-5" />
          Mass Text ({talents.length})
        </button>
      </div>

      {/* Mass Message Modal */}
      {showMassMessage && (
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
              This will send a text message to all {talents.length} talent(s) with phone numbers on file.
            </p>
            <textarea
              value={massMessageText}
              onChange={(e) => setMassMessageText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              rows={4}
              placeholder="Type your announcement here..."
              maxLength={160}
            />
            <div className="text-xs text-gray-500 mb-4 text-right">
              {massMessageText.length}/160 characters
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
                {sending ? 'Sending...' : `Send to ${talents.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Talent List */}
        <div className="md:col-span-1 glass rounded-2xl shadow-modern border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Talent ({talents.length})</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {talents.map((talent) => (
              <button
                key={talent.id}
                onClick={() => setSelectedTalent(talent)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  selectedTalent?.id === talent.id
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : 'hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  {(talent.temp_avatar_url || talent.users.avatar_url) ? (
                    <img
                      src={talent.temp_avatar_url || talent.users.avatar_url}
                      alt={talent.temp_full_name || talent.full_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-blue-600 font-medium">
                      {(talent.temp_full_name || talent.full_name).charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">
                    {talent.temp_full_name || talent.full_name}
                  </div>
                  <div className="text-xs text-gray-500">@{talent.username}</div>
                </div>
              </button>
            ))}
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
                        <p className="text-sm">{msg.message}</p>
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
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                    placeholder="Type a message..."
                    maxLength={160}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() || sending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {messageText.length}/160 characters
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
    </div>
  );
};

export default CommsCenterManagement;

