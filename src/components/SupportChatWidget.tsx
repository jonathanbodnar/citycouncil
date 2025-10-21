import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  XMarkIcon, 
  PaperAirplaneIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { HelpMessage } from '../types';
import toast from 'react-hot-toast';

interface SupportChatWidgetProps {
  showForUserTypes?: ('talent' | 'user')[];
}

const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({ 
  showForUserTypes = ['talent'] 
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
      // Set up real-time subscription for new messages
      const subscription = supabase
        .channel('help_messages')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'help_messages',
            filter: `user_id=eq.${user.id}`
          }, 
          () => {
            fetchMessages();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Don't show widget if user type not in allowed list
  if (!user || !showForUserTypes.includes(user.user_type as any)) {
    return null;
  }

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('help_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const { error } = await supabase
        .from('help_messages')
        .insert([
          {
            user_id: user.id,
            message: newMessage.trim(),
            is_resolved: false,
            is_human_takeover: false
          }
        ]);

      if (error) throw error;

      setNewMessage('');
      toast.success('Message sent! Admin will respond soon.');
      fetchMessages();

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          title="Need help? Chat with support"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-80 h-96 flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              <h3 className="font-semibold">Support Chat</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : messages.length > 0 ? (
              messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-lg px-3 py-2 max-w-[70%]">
                      <p className="text-sm">{message.message}</p>
                      <p className="text-xs text-blue-100 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {/* Admin Response */}
                  {message.response && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 max-w-[70%]">
                        <div className="flex items-center space-x-1 mb-1">
                          <UserCircleIcon className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">Admin</span>
                        </div>
                        <p className="text-sm">{message.response}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {message.updated_at ? new Date(message.updated_at).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">No messages yet</p>
                  <p className="text-gray-500 text-xs">Send a message to get help!</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                maxLength={500}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors flex-shrink-0"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <PaperAirplaneIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {newMessage.length}/500 characters • Press Enter to send
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportChatWidget;
