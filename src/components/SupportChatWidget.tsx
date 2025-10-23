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
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!user) return;
    
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
    if (!newMessage.trim() || sending || !user) return;

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
      // No need to fetch - real-time subscription will add the message

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
      // Set up real-time subscription for new messages and updates
      console.log('Setting up real-time subscription for user:', user.id);
      const subscription = supabase
        .channel(`help_messages_${user.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'help_messages',
            filter: `user_id=eq.${user.id}`
          }, 
          (payload) => {
            console.log('Talent real-time update received:', payload);
            
            // Handle different event types for smoother updates
            console.log('Payload event type:', payload.eventType, 'Payload:', payload);
            
            if (payload.eventType === 'INSERT') {
              // Add new message directly to state
              const newMessage = payload.new as HelpMessage;
              console.log('Adding new message to talent chat:', newMessage);
              setMessages(prev => {
                // Avoid duplicates
                if (prev.find(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
            } else if (payload.eventType === 'UPDATE') {
              // Update existing message (admin response)
              const updatedMessage = payload.new as HelpMessage;
              console.log('Updating message in talent chat:', updatedMessage);
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === updatedMessage.id ? updatedMessage : msg
                )
              );
              
              // Show notification for new admin responses
              if (!isOpen && updatedMessage.response) {
                setHasNewMessage(true);
                toast.success('💬 Admin replied to your message!', {
                  duration: 4000,
                  position: 'bottom-right',
                });
              }
            } else {
              // Fallback to full refetch for DELETE or other events
              console.log('Falling back to fetchMessages for event:', payload.eventType);
              fetchMessages();
            }
          }
        )
        .subscribe((status) => {
          console.log('Talent chat subscription status:', status);
        });

      return () => {
        console.log('Unsubscribing talent chat subscription');
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

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setHasNewMessage(false);
          }}
          className={`relative text-white p-4 rounded-2xl shadow-modern-lg transition-all duration-300 hover:scale-110 glow-blue ${
            hasNewMessage 
              ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 animate-pulse' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
          }`}
          title="Need help? Chat with support"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
          {hasNewMessage && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
              !
            </div>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="glass-strong rounded-2xl shadow-modern-xl border border-white/30 w-80 h-96 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
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
                  {/* Check if this is an admin-initiated message */}
                  {message.message.startsWith('Admin:') || message.message === '[Admin initiated conversation]' ? (
                    /* Admin Message */
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 max-w-[70%] border-l-4 border-blue-500">
                        <div className="flex items-center space-x-1 mb-1">
                          <UserCircleIcon className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">Admin</span>
                        </div>
                        <p className="text-sm">
                          {message.message.startsWith('Admin:') 
                            ? message.message.replace('Admin:', '').trim()
                            : message.response || 'Message sent'
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
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
                        <div className="flex justify-start animate-fade-in">
                          <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 max-w-[70%] border-l-4 border-blue-500">
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
                    </>
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
