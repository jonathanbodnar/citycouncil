import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ArchiveBoxIcon,
  CurrencyDollarIcon,
  GiftIcon,
  XMarkIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { HelpMessage } from '../types';
import { refundService } from '../services/refundService';
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

interface UserOrder {
  id: string;
  created_at: string;
  amount: number;
  status: string;
  payment_transaction_id: string;
  request_details: string;
  recipient_name?: string;
  refund_id?: string;
  discount_amount?: number;
  original_amount?: number;
  talent_profiles: {
    users: {
      full_name: string;
    };
  } | null;
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef<boolean>(false);
  const selectedConversationRef = useRef<ConversationGroup | null>(null);
  
  // Credits modal state
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [processingCredits, setProcessingCredits] = useState(false);
  
  // Orders modal state
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  // Keep ref in sync with state for use in subscription callback
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    fetchConversations(true); // Show loading on initial fetch only
    
    // Set up real-time subscription for new messages only
    let refreshTimeout: NodeJS.Timeout | null = null;
    const subscription = supabase
      .channel('admin_help_messages')
      .on('postgres_changes', 
        { 
          event: 'INSERT',
          schema: 'public', 
          table: 'help_messages'
        }, 
        (payload) => {
          const newMsg = payload.new as any;
          
          // Only refresh if it's a new message from a user (not admin-initiated)
          if (newMsg && newMsg.message !== '[Admin initiated conversation]') {
            // Debounce to prevent rapid refreshes
            if (refreshTimeout) clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
              // Update conversations list silently (no scroll, no loading)
              fetchConversations(false);
              
              // If this message is for the currently selected conversation, refresh it
              if (selectedConversationRef.current && newMsg.user_id === selectedConversationRef.current.user_id) {
                shouldScrollRef.current = true;
                refreshSelectedConversation();
              }
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, []);

  // Only scroll when explicitly requested (new message or conversation selected)
  useEffect(() => {
    if (shouldScrollRef.current && messagesContainerRef.current) {
      // Scroll within the messages container, not the whole page
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      shouldScrollRef.current = false;
    }
  }, [selectedConversation?.messages]);

  const markConversationAsRead = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('help_messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSelectConversation = async (conversation: ConversationGroup) => {
    shouldScrollRef.current = true; // Scroll to bottom when selecting conversation
    setSelectedConversation(conversation);
    // Mark all messages in this conversation as read (async, don't wait)
    markConversationAsRead(conversation.user_id);
    // Update unread count locally without full refresh
    setConversations(prev => prev.map(c => 
      c.user_id === conversation.user_id ? { ...c, unread_count: 0 } : c
    ));
  };

  const fetchConversations = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
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
        
        // Set latest message info - prefer actual messages over admin-initiated placeholders
        if (!acc[userId].latest_message_time || message.created_at > acc[userId].latest_message_time) {
          // If it's an admin-initiated conversation, show the response instead of the placeholder
          acc[userId].latest_message = message.message === '[Admin initiated conversation]' && message.response 
            ? message.response 
            : message.message;
          acc[userId].latest_message_time = message.created_at;
        }
        
        // Check if conversation is resolved (all messages resolved)
        acc[userId].is_resolved = acc[userId].messages.every(m => m.is_resolved);
        
        // Count unread messages (messages without admin response)
        acc[userId].unread_count = acc[userId].messages.filter(m => !m.response && !m.is_resolved).length;
        
        return acc;
      }, {});

      // Sort messages within each conversation by created_at ascending (oldest first)
      (Object.values(grouped) as ConversationGroup[]).forEach((conv) => {
        conv.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

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

    const messages = data || [];
    const newUnreadCount = messages.filter(m => !m.response && !m.is_resolved).length;
    
    const updatedConversation = { 
      ...selectedConversation, 
      messages,
      unread_count: newUnreadCount
    };
    setSelectedConversation(updatedConversation);
    
    // Sync unread count to conversations list
    setConversations(prev => prev.map(c => 
      c.user_id === selectedConversation.user_id 
        ? { ...c, unread_count: newUnreadCount }
        : c
    ));
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
        // Create a placeholder user message and immediately respond to it
        const { error: insertError } = await supabase
          .from('help_messages')
          .insert([
            {
              user_id: selectedConversation.user_id,
              message: '[Admin initiated conversation]',
              response: newMessage.trim(),
              is_resolved: false,
              is_human_takeover: true,
              updated_at: new Date().toISOString()
            }
          ])
          .select()
          .single();

        if (insertError) throw insertError;
      }

      // Send SMS notification to user if they have a phone number
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('phone, phone_number')
          .eq('id', selectedConversation.user_id)
          .single();

        const userPhone = userData?.phone || userData?.phone_number;
        if (userPhone) {
          const smsMessage = `ShoutOut Support: ${newMessage.trim().substring(0, 140)}${newMessage.trim().length > 140 ? '...' : ''}\n\nReply in app: https://shoutout.us/dashboard`;
          
          const { error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              to: userPhone,
              message: smsMessage,
              recipientType: 'user'  // Help desk messages go to users (659 number)
            }
          });

          if (smsError) {
            console.error('Failed to send SMS notification:', smsError);
            // Don't fail the response if SMS fails
          } else {
            console.log('SMS notification sent to user:', userPhone);
          }
        }
      } catch (smsErr) {
        console.error('Error sending SMS notification:', smsErr);
        // Don't fail the response if SMS fails
      }

      const sentMessage = newMessage.trim();
      setNewMessage('');
      toast.success('Response sent!');
      
      // Update locally immediately for instant feedback
      if (selectedConversation) {
        const updatedMessages = selectedConversation.messages.map(m => {
          if (m.id === unrespondedMessage?.id) {
            return { ...m, response: sentMessage, updated_at: new Date().toISOString() };
          }
          return m;
        });
        
        // If it was an admin-initiated message, add it to the list
        if (!unrespondedMessage) {
          updatedMessages.push({
            id: `temp-${Date.now()}`,
            user_id: selectedConversation.user_id,
            message: '[Admin initiated conversation]',
            response: sentMessage,
            is_resolved: false,
            is_human_takeover: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_read: true
          } as any);
        }
        
        const newUnreadCount = updatedMessages.filter(m => !m.response && !m.is_resolved).length;
        
        setSelectedConversation({
          ...selectedConversation,
          messages: updatedMessages,
          unread_count: newUnreadCount
        });
        
        // Also update the conversations list unread count
        setConversations(prev => prev.map(c => 
          c.user_id === selectedConversation.user_id 
            ? { ...c, unread_count: newUnreadCount }
            : c
        ));
        
        shouldScrollRef.current = true;
      }
      
      // Silently refresh in background to sync with server
      setTimeout(() => {
        refreshSelectedConversation();
        fetchConversations(false); // Also refresh conversations list
      }, 500);

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
      
      // Update locally without full refresh
      setConversations(prev => prev.map(c => 
        c.user_id === conversationUserId ? { ...c, is_resolved: true } : c
      ));
      
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

  // Issue credits to user
  const handleIssueCredits = async () => {
    if (!selectedConversation || !creditAmount || !creditReason.trim()) {
      toast.error('Please enter amount and reason');
      return;
    }

    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    setProcessingCredits(true);
    try {
      // Get current user credits
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('credits')
        .eq('id', selectedConversation.user_id)
        .single();

      if (userError) throw userError;

      const currentCredits = parseInt(userData?.credits || '0');
      const newCredits = currentCredits + (amount * 100); // Store in cents

      // Update user credits
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits: newCredits.toString() })
        .eq('id', selectedConversation.user_id);

      if (updateError) throw updateError;

      // Log the credit transaction
      await supabase.from('credit_transactions').insert({
        user_id: selectedConversation.user_id,
        amount: amount * 100,
        type: 'admin_grant',
        description: creditReason,
        created_at: new Date().toISOString()
      });

      toast.success(`$${amount} credits issued to ${selectedConversation.user_name}`);
      setShowCreditsModal(false);
      setCreditAmount('');
      setCreditReason('');
    } catch (error: any) {
      console.error('Error issuing credits:', error);
      toast.error(error.message || 'Failed to issue credits');
    } finally {
      setProcessingCredits(false);
    }
  };

  // Fetch user's orders
  const fetchUserOrders = async (userId: string) => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          amount,
          status,
          payment_transaction_id,
          request_details,
          recipient_name,
          refund_id,
          discount_amount,
          original_amount,
          talent_profiles!orders_talent_id_fkey (
            users!talent_profiles_user_id_fkey (
              full_name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserOrders((data || []) as unknown as UserOrder[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const openOrdersModal = () => {
    if (selectedConversation) {
      fetchUserOrders(selectedConversation.user_id);
      setShowOrdersModal(true);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder || !refundReason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    setProcessingRefund(true);
    try {
      // Check if this is a free/coupon order (no payment to refund)
      const discountAmount = selectedOrder.discount_amount || 0;
      const originalAmount = selectedOrder.original_amount || 0;
      const isFreeOrder = !selectedOrder.payment_transaction_id || 
        (discountAmount > 0 && originalAmount > 0 && discountAmount >= originalAmount);

      if (isFreeOrder) {
        // Just update the order status without processing a refund
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'refunded',
            denial_reason: refundReason,
            denied_by: 'admin',
            denied_at: new Date().toISOString(),
          })
          .eq('id', selectedOrder.id);

        if (error) throw error;
        toast.success('Order cancelled (no refund needed - free/coupon order)');
      } else {
        // Process actual refund
        const result = await refundService.processRefund({
          orderId: selectedOrder.id,
          transactionId: selectedOrder.payment_transaction_id,
          reason: refundReason,
          deniedBy: 'admin',
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to process refund');
        }
        toast.success('Refund processed successfully');
      }

      setShowRefundModal(false);
      setSelectedOrder(null);
      setRefundReason('');
      
      // Refresh orders
      if (selectedConversation) {
        fetchUserOrders(selectedConversation.user_id);
      }
    } catch (error: any) {
      console.error('Error processing refund:', error);
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setProcessingRefund(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'denied':
      case 'refunded': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[80vh] min-h-[500px] max-h-[900px] flex flex-col md:flex-row">
      {/* Conversations List - Left Side */}
      <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col h-1/3 md:h-full">
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
                onClick={() => handleSelectConversation(conversation)}
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
                    
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {conversation.latest_message}
                    </p>
                    
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(conversation.latest_message_time).toLocaleDateString()} at {new Date(conversation.latest_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                
                <div className="flex items-center gap-2">
                  {/* Issue Credits Button */}
                  <button
                    onClick={() => setShowCreditsModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    title="Issue Credits"
                  >
                    <GiftIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Credits</span>
                  </button>
                  
                  {/* View Orders Button */}
                  <button
                    onClick={openOrdersModal}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    title="View Orders"
                  >
                    <ShoppingBagIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Orders</span>
                  </button>
                  
                  {/* Mark Resolved Button */}
                  {!selectedConversation.is_resolved && (
                    <button
                      onClick={() => markAsResolved(selectedConversation.user_id)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <CheckIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Resolved</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 bg-gray-50">
              {[...selectedConversation.messages]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((message) => (
                <div key={message.id} className="space-y-3">
                  {/* User Message - Hide if it's an admin-initiated conversation placeholder */}
                  {message.message !== '[Admin initiated conversation]' && (
                    <div className="flex justify-start">
                      <div className="bg-white rounded-2xl px-4 py-3 max-w-[85%] md:max-w-[70%] shadow-sm border border-gray-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {selectedConversation.user_name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            selectedConversation.user_type === 'talent' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {selectedConversation.user_type}
                          </span>
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                        <p className="text-xs text-gray-500 mt-3">
                          {new Date(message.created_at).toLocaleString([], { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Admin Response */}
                  {message.response && (
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white rounded-2xl px-4 py-3 max-w-[85%] md:max-w-[70%] shadow-md">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-semibold">Admin</span>
                          <span className="px-2 py-0.5 bg-blue-500 rounded-full text-xs font-medium">
                            Support
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.response}</p>
                        <p className="text-xs text-blue-100 mt-3">
                          {message.updated_at ? new Date(message.updated_at).toLocaleString([], { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : ''}
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
              <div className="p-3 md:p-4 border-t border-gray-200 bg-white">
                <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    rows={3}
                    maxLength={1000}
                  />
                  <button
                    onClick={sendResponse}
                    disabled={!newMessage.trim() || sending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-colors flex-shrink-0 self-end font-medium flex items-center justify-center space-x-2 min-h-[48px]"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="h-5 w-5" />
                        <span className="hidden md:inline">Send</span>
                      </>
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

      {/* Issue Credits Modal */}
      {showCreditsModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <GiftIcon className="h-6 w-6 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Issue Credits</h3>
              </div>
              <button onClick={() => setShowCreditsModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                <strong>User:</strong> {selectedConversation.user_name}
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credit Amount ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount (e.g., 25)"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                disabled={processingCredits}
              />

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Why are you issuing these credits?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={processingCredits}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreditsModal(false)}
                disabled={processingCredits}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueCredits}
                disabled={processingCredits || !creditAmount || !creditReason.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {processingCredits ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                    Issue Credits
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Orders Modal */}
      {showOrdersModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center">
                <ShoppingBagIcon className="h-6 w-6 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Orders for {selectedConversation.user_name}
                </h3>
              </div>
              <button onClick={() => setShowOrdersModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingOrders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : userOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No orders found for this user
                </div>
              ) : (
                <div className="space-y-3">
                  {userOrders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              ${(order.amount / 100).toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            <strong>Talent:</strong> {order.talent_profiles?.users?.full_name || 'Unknown'}
                          </p>
                          {order.recipient_name && (
                            <p className="text-sm text-gray-600">
                              <strong>For:</strong> {order.recipient_name}
                            </p>
                          )}
                          {order.request_details && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {order.request_details}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          {/* Cancel & Refund for pending orders */}
                          {(order.status === 'pending' || order.status === 'in_progress') && !order.refund_id && (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowRefundModal(true);
                              }}
                              className="px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
                            >
                              Cancel & Refund
                            </button>
                          )}
                          {/* Refund for any non-refunded order */}
                          {!order.refund_id && order.status !== 'denied' && order.status !== 'refunded' && order.status !== 'pending' && order.status !== 'in_progress' && (
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowRefundModal(true);
                              }}
                              className="px-3 py-1.5 text-xs border border-orange-300 text-orange-700 rounded hover:bg-orange-50 transition-colors"
                            >
                              Refund
                            </button>
                          )}
                          {/* Refunded badge */}
                          {(order.refund_id || order.status === 'denied' || order.status === 'refunded') && (
                            <span className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded">
                              Refunded
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowOrdersModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Order Modal */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-6 w-6 text-orange-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedOrder.status === 'pending' || selectedOrder.status === 'in_progress' 
                    ? 'Cancel & Refund Order' 
                    : 'Refund Order'}
                </h3>
              </div>
              <button onClick={() => { setShowRefundModal(false); setSelectedOrder(null); }} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Talent:</strong> {selectedOrder.talent_profiles?.users?.full_name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Amount:</strong> ${(selectedOrder.amount / 100).toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Status:</strong> {selectedOrder.status}
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Why are you refunding this order?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={processingRefund}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>Warning:</strong> This will process a refund through the payment processor and notify the customer.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRefundModal(false); setSelectedOrder(null); setRefundReason(''); }}
                disabled={processingRefund}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundOrder}
                disabled={processingRefund || !refundReason.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {processingRefund ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Process Refund'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHelpDesk;
