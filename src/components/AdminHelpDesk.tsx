import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ArchiveBoxIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { HelpMessage } from '../types';
import toast from 'react-hot-toast';

interface ConversationWithUser extends HelpMessage {
  users: {
    full_name: string;
    avatar_url?: string;
    user_type: string;
  };
}

interface ConversationGroup {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  user_type: string;
  messages: HelpMessage[];
  latest_message: string;
  latest_message_time: string;
  unread_count: number;
  is_resolved: boolean;
}

const AdminHelpDesk: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationGroup[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    
      // Set up real-time subscription
    const subscription = supabase
      .channel('admin_help_messages')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'help_messages'
        }, 
        (payload) => {
          console.log('Admin real-time update:', payload);
          
          // Only refresh selected conversation if it's the updated one
          if (selectedConversation && payload.new && (payload.new as any)?.user_id === selectedConversation.user_id) {
            refreshSelectedConversation();
          }
          
          // Always refresh conversations list for sidebar updates
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('help_messages')
        .select(`
          *,
          users!help_messages_user_id_fkey (
            full_name,
            avatar_url,
            user_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by user
      const grouped = (data || []).reduce((acc: { [key: string]: ConversationGroup }, message: ConversationWithUser) => {
        const userId = message.user_id;
        
        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            user_name: message.users.full_name,
            user_avatar: message.users.avatar_url,
            user_type: message.users.user_type,
            messages: [],
            latest_message: '',
            latest_message_time: '',
            unread_count: 0,
            is_resolved: false
          };
        }
        
        acc[userId].messages.push(message);
        
        // Set latest message info
        if (!acc[userId].latest_message_time || message.created_at > acc[userId].latest_message_time) {
          acc[userId].latest_message = message.message;
          acc[userId].latest_message_time = message.created_at;
        }
        
        // Check if conversation is resolved (all messages resolved)
        acc[userId].is_resolved = acc[userId].messages.every(m => m.is_resolved);
        
        // Count unread messages (messages without admin response)
        acc[userId].unread_count = acc[userId].messages.filter(m => !m.response && !m.is_resolved).length;
        
        return acc;
      }, {});

      const conversationList = (Object.values(grouped) as ConversationGroup[]).sort((a, b) => 
        new Date(b.latest_message_time).getTime() - new Date(a.latest_message_time).getTime()
      );

      setConversations(conversationList);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedConversation = async () => {
    if (!selectedConversation) return;
    
    const { data, error } = await supabase
      .from('help_messages')
      .select('*')
      .eq('user_id', selectedConversation.user_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error refreshing conversation:', error);
      return;
    }

    const updatedConversation = { ...selectedConversation, messages: data || [] };
    setSelectedConversation(updatedConversation);
  };

  const sendResponse = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    try {
      setSending(true);

      // Find the most recent unresponded message
      const unrespondedMessage = selectedConversation.messages
        .filter(m => !m.response)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (unrespondedMessage) {
        // Update the message with admin response
        const { error } = await supabase
          .from('help_messages')
          .update({
            response: newMessage.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', unrespondedMessage.id);

        if (error) throw error;
      } else {
        // Create new admin message
        const { error } = await supabase
          .from('help_messages')
          .insert([
            {
              user_id: selectedConversation.user_id,
              message: `Admin: ${newMessage.trim()}`,
              response: null,
              is_resolved: false,
              is_human_takeover: true
            }
          ]);

        if (error) throw error;
      }

      setNewMessage('');
      toast.success('Response sent!');
      
      // Don't refresh everything, just the selected conversation
      refreshSelectedConversation();

    } catch (error) {
      console.error('Error sending response:', error);
      toast.error('Failed to send response');
    } finally {
      setSending(false);
    }
  };

  const markAsResolved = async (conversationUserId: string) => {
    try {
      const { error } = await supabase
        .from('help_messages')
        .update({ is_resolved: true })
        .eq('user_id', conversationUserId);

      if (error) throw error;

      toast.success('Conversation marked as resolved');
      fetchConversations();
      
      // Clear selected conversation if it was the resolved one
      if (selectedConversation?.user_id === conversationUserId) {
        setSelectedConversation(null);
      }

    } catch (error) {
      console.error('Error resolving conversation:', error);
      toast.error('Failed to resolve conversation');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      sendResponse();
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchQuery || 
      conv.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.latest_message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesArchive = showArchived ? conv.is_resolved : !conv.is_resolved;
    
    return matchesSearch && matchesArchive;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[600px] flex">
      {/* Conversations List - Left Side */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Support Conversations</h3>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                showArchived 
                  ? 'bg-gray-100 text-gray-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {showArchived ? 'Show Active' : 'Show Archived'}
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.user_id}
                onClick={() => setSelectedConversation(conversation)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedConversation?.user_id === conversation.user_id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {conversation.user_avatar ? (
                      <img
                        src={conversation.user_avatar}
                        alt={conversation.user_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <UserCircleIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">
                        {conversation.user_name}
                      </p>
                      {conversation.unread_count > 0 && (
                        <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        conversation.user_type === 'talent' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {conversation.user_type}
                      </span>
                      
                      {conversation.is_resolved && (
                        <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.latest_message}
                    </p>
                    
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(conversation.latest_message_time).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {showArchived ? 'No archived conversations' : 'No active conversations'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window - Right Side */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {selectedConversation.user_avatar ? (
                      <img
                        src={selectedConversation.user_avatar}
                        alt={selectedConversation.user_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <UserCircleIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedConversation.user_name}</h3>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedConversation.user_type === 'talent' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {selectedConversation.user_type}
                      </span>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedConversation.is_resolved ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedConversation.is_resolved ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {!selectedConversation.is_resolved && (
                  <button
                    onClick={() => markAsResolved(selectedConversation.user_id)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages.map((message) => (
                <div key={message.id} className="space-y-3">
                  {/* User Message */}
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-[70%]">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {selectedConversation.user_name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          selectedConversation.user_type === 'talent' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {selectedConversation.user_type}
                        </span>
                      </div>
                      <p className="text-gray-800">{message.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Admin Response */}
                  {message.response && (
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[70%]">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium">Admin</span>
                          <span className="px-1.5 py-0.5 bg-blue-500 rounded text-xs font-medium">
                            Support
                          </span>
                        </div>
                        <p>{message.response}</p>
                        <p className="text-xs text-blue-100 mt-2">
                          {message.updated_at ? new Date(message.updated_at).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {!selectedConversation.is_resolved && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex space-x-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    maxLength={1000}
                  />
                  <button
                    onClick={sendResponse}
                    disabled={!newMessage.trim() || sending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors flex-shrink-0 self-end"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <PaperAirplaneIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {newMessage.length}/1000 characters • Press Enter to send
                </p>
              </div>
            )}
          </>
        ) : (
          /* No Conversation Selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Conversation</h3>
              <p className="text-gray-600">
                Choose a conversation from the left to start helping customers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminHelpDesk;
