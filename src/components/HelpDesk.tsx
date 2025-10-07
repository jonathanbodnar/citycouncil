import React, { useState, useEffect } from 'react';
import { 
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserIcon,
  ComputerDesktopIcon
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

  useEffect(() => {
    if (user) {
      fetchMessages();
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

      // Simulate AI response (in production, this would call your AI service)
      setTimeout(async () => {
        const aiResponse = generateAIResponse(newMessage);
        
        const { data: responseData, error: responseError } = await supabase
          .from('help_messages')
          .update({ response: aiResponse })
          .eq('id', data.id)
          .select()
          .single();

        if (!responseError) {
          setMessages(prev => 
            prev.map(msg => msg.id === data.id ? responseData : msg)
          );
        }
      }, 1500);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const generateAIResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    // Route talent-related questions to human
    if (message.includes('talent') || message.includes('creator') || message.includes('payment') || message.includes('payout')) {
      return "Thank you for your message! This appears to be a talent-related inquiry. I'm connecting you with our human support team who can better assist you with talent-specific questions. Someone will respond within 24 hours.";
    }
    
    // General responses for common questions
    if (message.includes('order') || message.includes('shoutout')) {
      return "I'd be happy to help with your order! You can track your order status in your dashboard, and you'll receive email notifications when your ShoutOut is ready. Orders typically take 24-48 hours to fulfill. Is there something specific about your order I can help with?";
    }
    
    if (message.includes('refund') || message.includes('cancel')) {
      return "We offer a 100% money-back guarantee! If you're not satisfied with your ShoutOut or if it's not delivered on time, you can request a refund. For orders past their fulfillment deadline, you can cancel directly from your dashboard. Would you like me to help you with a specific order?";
    }
    
    if (message.includes('payment') || message.includes('billing')) {
      return "For payment and billing questions, you can manage your payment methods in your profile settings. We accept all major credit cards and use secure Stripe processing. If you're having trouble with a payment, please let me know the specific issue!";
    }
    
    return "Thank you for reaching out! I'm here to help with any questions about ShoutOut. I can assist with orders, payments, account settings, and general platform questions. For talent-specific inquiries, I'll connect you with our human support team. How can I help you today?";
  };

  const requestHumanTakeover = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('help_messages')
        .update({ is_human_takeover: true })
        .eq('id', messageId);

      if (error) throw error;

      toast.success('Connected to human support. Someone will respond within 24 hours.');
      fetchMessages();
    } catch (error) {
      console.error('Error requesting human takeover:', error);
      toast.error('Failed to connect to human support');
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

              {/* AI/Human Response */}
              {message.response && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      {message.is_human_takeover ? (
                        <>
                          <UserIcon className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">Human Support</span>
                        </>
                      ) : (
                        <>
                          <ComputerDesktopIcon className="h-4 w-4 text-gray-600" />
                          <span className="text-xs font-medium text-gray-600">AI Assistant</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-800">{message.response}</p>
                    {!message.is_human_takeover && !message.is_resolved && (
                      <button
                        onClick={() => requestHumanTakeover(message.id)}
                        className="text-xs text-primary-600 hover:text-primary-700 mt-2 underline"
                      >
                        Connect to human support
                      </button>
                    )}
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
