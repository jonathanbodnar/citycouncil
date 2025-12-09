import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { HelpMessage } from '../types';
import toast from 'react-hot-toast';

const HelpDesk: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      fetchMessages();

      // Set up real-time subscription for this user's messages
      const subscription = supabase
        .channel(`help_messages_${user.id}`)
        .on('postgres_changes', 
          { 
            event: '*', // Listen for INSERT and UPDATE (for responses)
            schema: 'public', 
            table: 'help_messages',
            filter: `user_id=eq.${user.id}`
          }, 
          (payload) => {
            console.log('Help message update received:', payload);
            
            if (payload.eventType === 'INSERT') {
              // New message added (could be admin-initiated)
              const newMsg = payload.new as HelpMessage;
              setMessages(prev => {
                // Check if message already exists to avoid duplicates
                if (prev.some(m => m.id === newMsg.id)) {
                  return prev;
                }
                return [...prev, newMsg];
              });
            } else if (payload.eventType === 'UPDATE') {
              // Message updated (admin responded)
              const updatedMsg = payload.new as HelpMessage;
              setMessages(prev => 
                prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
              );
              
              // Show toast notification for new response
              if (updatedMsg.response) {
                toast.success('Support team replied!', {
                  icon: '💬',
                  duration: 4000
                });
              }
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('help_messages')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('help_messages')
        .insert([
          {
            user_id: user.id,
            message: newMessage.trim(),
            is_resolved: false,
            is_human_takeover: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setNewMessage('');
      toast.success('Message sent! Our support team will respond soon.');

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };


  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-96 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Help & Support</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Get instant help or chat with our support team
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id} className="space-y-3">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="max-w-xs lg:max-w-md bg-primary-600 text-white rounded-lg px-4 py-2">
                  <p className="text-sm">{message.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Support Team Response */}
              {message.response && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <UserIcon className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600">Support Team</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{message.response}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
            <p className="text-gray-600">Ask us anything about ShoutOut!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <PaperAirplaneIcon className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default HelpDesk;
